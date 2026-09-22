import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCurriculum, useMastery, useRefreshLearningState } from "@/hooks/useLearning";
import { useFeature } from "@/hooks/useApiHealth";
import { ConceptCard, MasteryBar, PageHeader } from "@/components/learning/primitives";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ApiError, callFunction, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Practice — an adaptive quiz on one concept.
 *
 * The questions come from the server, and the correct answers do not: a
 * `quiz-start` response carries no `correctIndex` and no explanation. Both
 * arrive only in the `quiz-submit` reply, so the answer key is never sitting in
 * the browser waiting to be read out of the network tab.
 *
 * Questions are generated from the published lesson material and the concept's
 * misconception catalogue, at a difficulty the server picks from measured
 * mastery — a weak concept gets *easier* questions, not harder ones. If
 * generation produces nothing usable the page says exactly that and offers a
 * retry; it does not fall back to a canned question set.
 *
 * Every number on the result screen is what the server scored, not a
 * client-side recount.
 */

interface Question {
  id: string;
  question: string;
  options: string[];
  type: string;
}

interface StartResponse {
  attemptId: string;
  quizId: string;
  conceptTitle: string;
  difficulty: number;
  questions: Question[];
}

interface ReviewRow {
  questionId: string;
  question: string;
  options: string[];
  answerIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string | null;
}

interface SubmitResponse {
  score: number;
  correctCount: number;
  totalQuestions: number;
  mastery: { value: number; status: string; confidence: number; accuracy: number; attempts: number } | null;
  misconceptions: Array<{ statement: string; correction: string }>;
  newAchievements: Array<{ code: string; title: string; description: string; icon: string; points: number }>;
  review: ReviewRow[];
}

/* -------------------------------------------------------------------------- */
/* Concept picker — /practice                                                  */
/* -------------------------------------------------------------------------- */

const PracticePicker = () => {
  const curriculum = useCurriculum();
  const mastery = useMastery();

  if (curriculum.isLoading) return <LoadingState label="Loading concepts…" />;
  if (curriculum.error) return <ErrorState error={curriculum.error} onRetry={() => void curriculum.refetch()} />;

  const concepts = (curriculum.data ?? [])
    .flatMap((course) => course.chapters)
    .flatMap((chapter) => chapter.concepts);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Pick something to practise"
        description="Five questions, chosen at a difficulty that matches what you have already shown. Answering is what produces a mastery measurement — reading alone does not."
      />

      {concepts.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" aria-hidden />}
              title="Nothing to practise yet"
              description="Practice questions are attached to published concepts. None exist yet, so there is nothing honest to quiz you on."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/learn">Browse the curriculum</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {concepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              slug={concept.slug}
              title={concept.title}
              summary={concept.summary}
              estimatedMinutes={concept.estimated_minutes}
              difficulty={concept.difficulty}
              record={mastery.data?.get(concept.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Quiz runner — /practice/:conceptSlug                                        */
/* -------------------------------------------------------------------------- */

const QuizRunner = ({ conceptSlug }: { conceptSlug: string }) => {
  const navigate = useNavigate();
  const curriculum = useCurriculum();
  const refreshLearningState = useRefreshLearningState();
  const quizzes = useFeature("quizzes");

  const [quiz, setQuiz] = useState<StartResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const shownAt = useRef<number>(Date.now());

  const concept = useMemo(
    () =>
      (curriculum.data ?? [])
        .flatMap((course) => course.chapters)
        .flatMap((chapter) => chapter.concepts)
        .find((item) => item.slug === conceptSlug) ?? null,
    [curriculum.data, conceptSlug],
  );

  /** Adds the time spent looking at the current question to its running total. */
  const flushTime = useCallback(() => {
    const question = quiz?.questions[index];
    if (!question) return;
    const spent = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    setElapsed((current) => ({ ...current, [question.id]: (current[question.id] ?? 0) + spent }));
  }, [quiz, index]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index, quiz]);

  const start = useMutation({
    mutationFn: (conceptId: string) => callFunction<StartResponse>("quiz-start", { conceptId }),
    onSuccess: (data) => {
      setQuiz(data);
      setIndex(0);
      setAnswers({});
      setElapsed({});
      setResult(null);
      shownAt.current = Date.now();
    },
  });

  const submit = useMutation({
    mutationFn: (payload: { attemptId: string; answers: Array<{ questionId: string; answerIndex: number | null; responseTimeMs: number }> }) =>
      callFunction<SubmitResponse>("quiz-submit", payload),
    onSuccess: (data) => {
      setResult(data);
      refreshLearningState();
    },
  });

  const questions = quiz?.questions ?? [];
  const current = questions[index] ?? null;
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;

  const handleSubmit = () => {
    if (!quiz) return;
    const question = questions[index];
    const spent = question ? Date.now() - shownAt.current : 0;

    submit.mutate({
      attemptId: quiz.attemptId,
      answers: questions.map((item) => ({
        questionId: item.id,
        answerIndex: answers[item.id] ?? null,
        responseTimeMs: Math.round((elapsed[item.id] ?? 0) + (question?.id === item.id ? spent : 0)),
      })),
    });
  };

  if (curriculum.isLoading) return <LoadingState label="Loading the concept…" />;

  if (!concept) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" aria-hidden />}
        title="Concept not found"
        description="That concept is not published, so there is nothing to practise."
        action={
          <Button asChild size="sm">
            <Link to="/practice">Pick another</Link>
          </Button>
        }
      />
    );
  }

  /* ---------------------------------------------------------------- results */
  if (result) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Practice"
          title={`${result.correctCount} of ${result.totalQuestions} correct`}
          description={`Scored on the server. ${
            result.mastery
              ? `Your mastery of ${concept.title} is now ${Math.round(result.mastery.value)}%, from ${result.mastery.attempts} recorded attempt${result.mastery.attempts === 1 ? "" : "s"}.`
              : "No mastery update was recorded for this attempt."
          }`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => start.mutate(concept.id)} disabled={start.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                Practise again
              </Button>
              <Button onClick={() => navigate(`/learn/${concept.slug}`)}>Back to the concept</Button>
            </div>
          }
        />

        {result.mastery ? (
          <Card className="surface-card">
            <CardContent className="space-y-3 p-4">
              <MasteryBar value={result.mastery.value} />
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Score</p>
                  <p className="font-semibold tabular-nums">{Math.round(result.score)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Accuracy overall</p>
                  <p className="font-semibold tabular-nums">{Math.round(result.mastery.accuracy)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-semibold tabular-nums">{Math.round(result.mastery.confidence)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Attempts</p>
                  <p className="font-semibold tabular-nums">{result.mastery.attempts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {result.newAchievements.length > 0 ? (
          <Card className="surface-card border-accent/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-accent" aria-hidden />
                Earned just now
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.newAchievements.map((achievement) => (
                <Badge key={achievement.code} variant="secondary" className="gap-1">
                  {achievement.title}
                  <span className="text-muted-foreground">+{achievement.points}</span>
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {result.misconceptions.length > 0 ? (
          <Card className="surface-card border-warning/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 text-warning" aria-hidden />
                Detected from your wrong answers
              </CardTitle>
              <CardDescription className="text-xs">
                Each of these is tied to a specific option you picked, not a guess about you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.misconceptions.map((misconception, position) => (
                <div key={position} className="rounded-lg bg-warning/5 p-3">
                  <p className="text-sm font-medium">“{misconception.statement}”</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {misconception.correction}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Every question, with the answer</h2>
          {result.review.map((row, position) => (
            <Card key={row.questionId} className="surface-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                      row.isCorrect ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                    aria-hidden
                  >
                    {row.isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <p className="text-sm font-medium leading-relaxed">
                    {position + 1}. {row.question}
                  </p>
                </div>

                <ul className="space-y-1.5">
                  {row.options.map((option, optionIndex) => {
                    const isCorrect = optionIndex === row.correctIndex;
                    const isChosen = optionIndex === row.answerIndex;
                    return (
                      <li
                        key={optionIndex}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                          isCorrect && "border-success/50 bg-success/5",
                          isChosen && !isCorrect && "border-destructive/50 bg-destructive/5",
                          !isCorrect && !isChosen && "border-border/60",
                        )}
                      >
                        <span>{option}</span>
                        {isCorrect ? (
                          <span className="ml-2 font-medium text-success">correct</span>
                        ) : null}
                        {isChosen && !isCorrect ? (
                          <span className="ml-2 font-medium text-destructive">your answer</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {row.explanation ? (
                  <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    {row.explanation}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    );
  }

  /* ---------------------------------------------------------------- running */
  if (quiz && current) {
    const selected = answers[current.id];
    const isLast = index === questions.length - 1;

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setQuiz(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            Leave
          </Button>
          <span className="text-xs text-muted-foreground">
            Question {index + 1} of {questions.length} · difficulty {quiz.difficulty}
          </span>
        </div>

        <Progress value={((index + 1) / questions.length) * 100} className="h-1.5" />

        <Card className="surface-card">
          <CardContent className="space-y-4 p-5">
            <p className="text-base font-medium leading-relaxed">{current.question}</p>

            <div className="space-y-2" role="radiogroup" aria-label="Answer options">
              {current.options.map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  type="button"
                  role="radio"
                  aria-checked={selected === optionIndex}
                  onClick={() => setAnswers((state) => ({ ...state, [current.id]: optionIndex }))}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    selected === optionIndex
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                      selected === optionIndex ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                    aria-hidden
                  >
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {submit.error ? <ErrorState error={submit.error} onRetry={handleSubmit} /> : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => {
              flushTime();
              setIndex((value) => Math.max(0, value - 1));
            }}
          >
            Previous
          </Button>

          {isLast ? (
            <Button onClick={handleSubmit} disabled={submit.isPending || answeredCount === 0}>
              {submit.isPending ? "Scoring…" : `Submit ${answeredCount}/${questions.length}`}
              <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={() => {
                flushTime();
                setIndex((value) => Math.min(questions.length - 1, value + 1));
              }}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          You can move back and change an answer. Nothing is scored until you submit.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ intro */
  const startError = start.error;
  const generationFailed = startError instanceof ApiError && startError.code === "quiz_generation_failed";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Practice"
        title={concept.title}
        description="Five multiple-choice questions, written from this concept's published material at a difficulty matched to what you have already shown. Your answers update the mastery figure on this concept."
      />

      {quizzes.available === false ? <ConfigNotice message={quizzes.message ?? ""} /> : null}

      {generationFailed ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" aria-hidden />}
              title="No usable questions came back"
              description="Questions are written from this concept's published material. If that material is thin the generator can come up empty — rather than show you invented questions, this page stops here. Trying again often works."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => start.mutate(concept.id)} disabled={start.isPending}>
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                    Try again
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/learn/${concept.slug}`}>Read the concept</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/tutor?concept=${concept.id}`}>Ask the tutor</Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : startError ? (
        <ErrorState error={startError} onRetry={() => start.mutate(concept.id)} />
      ) : null}

      {!generationFailed ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => start.mutate(concept.id)} disabled={start.isPending || quizzes.available === false}>
            {start.isPending ? "Writing your questions…" : "Start practice"}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
          <Button asChild variant="outline">
            <Link to={`/learn/${concept.slug}`}>Read it first</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const Practice = () => {
  const { conceptSlug } = useParams<{ conceptSlug: string }>();
  return conceptSlug ? <QuizRunner key={conceptSlug} conceptSlug={conceptSlug} /> : <PracticePicker />;
};

export default Practice;
