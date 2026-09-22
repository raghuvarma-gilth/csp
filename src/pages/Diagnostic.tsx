import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Compass,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurriculum, useRefreshLearningState } from "@/hooks/useLearning";
import { useFeature } from "@/hooks/useApiHealth";
import { PageHeader } from "@/components/learning/primitives";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ApiError, apiTarget, callFunction, getJson } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Diagnostic — the adaptive placement check.
 *
 * It walks the published curriculum in order and adjusts difficulty from each
 * answer. Concepts it never reached are reported as "not assessed" rather than
 * being scored at zero: an unasked question is not a wrong answer, and treating
 * it as one is how a placement check starts lying to a student on day one.
 *
 * Feedback arrives from the server one question at a time, so the answer key is
 * never in the browser ahead of the answer.
 */

interface Question {
  id: string;
  question: string;
  options: string[];
}

interface Feedback {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string | null;
}

interface ConceptRef {
  id: string;
  title: string;
  slug: string;
}

interface StepResponse {
  feedback?: Feedback;
  completed?: boolean;
  position?: number;
  total?: number;
  difficulty?: number;
  conceptTitle?: string;
  question?: Question;
  score?: number;
  questionsAsked?: number;
  correctCount?: number;
  strong?: ConceptRef[];
  weak?: ConceptRef[];
  unassessed?: ConceptRef[];
}

interface StartResponse {
  sessionId: string;
  position: number;
  total: number;
  difficulty: number;
  conceptTitle: string;
  question: Question;
}

const ConceptList = ({
  title,
  description,
  items,
  icon,
  tone,
}: {
  title: string;
  description: string;
  items: ConceptRef[];
  icon: React.ReactNode;
  tone: "success" | "warning" | "muted";
}) => (
  <Card
    className={cn(
      "surface-card",
      tone === "success" && "border-success/40",
      tone === "warning" && "border-warning/40",
    )}
  >
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-sm">
        {icon}
        {title} ({items.length})
      </CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-wrap gap-1.5">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None.</p>
      ) : (
        items.map((item) => (
          <Link key={item.id} to={`/learn/${item.slug}`}>
            <Badge variant="outline" className="text-[11px] hover:border-primary/50">
              {item.title}
            </Badge>
          </Link>
        ))
      )}
    </CardContent>
  </Card>
);

const Diagnostic = () => {
  const curriculum = useCurriculum();
  const diagnostic = useFeature("diagnostic");
  const refreshLearningState = useRefreshLearningState();

  const [chapterId, setChapterId] = useState("all");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [position, setPosition] = useState(1);
  const [total, setTotal] = useState(0);
  const [difficulty, setDifficulty] = useState(2);
  const [conceptTitle, setConceptTitle] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  /** The next question, held back until the student has read the feedback. */
  const [pending, setPending] = useState<Question | null>(null);
  const [summary, setSummary] = useState<StepResponse | null>(null);

  const chapters = useMemo(
    () =>
      (curriculum.data ?? []).flatMap((course) =>
        course.chapters.map((chapter) => ({ ...chapter, courseTitle: course.title })),
      ),
    [curriculum.data],
  );

  const latest = useQuery({
    queryKey: ["diagnostic-latest"],
    enabled: apiTarget === "python",
    queryFn: () =>
      getJson<{
        session: {
          id: string;
          status: string;
          score: number | null;
          questions_asked: number;
          correct_count: number;
          completed_at: string | null;
        } | null;
      }>("diagnostic/latest"),
  });

  const start = useMutation({
    mutationFn: () =>
      callFunction<StartResponse>("diagnostic/start", {
        chapterId: chapterId === "all" ? null : chapterId,
      }),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setQuestion(data.question);
      setPosition(data.position);
      setTotal(data.total);
      setDifficulty(data.difficulty);
      setConceptTitle(data.conceptTitle);
      setSelected(null);
      setFeedback(null);
      setSummary(null);
    },
  });

  const answer = useMutation({
    mutationFn: (answerIndex: number) =>
      callFunction<StepResponse>("diagnostic/answer", {
        sessionId,
        questionId: question!.id,
        answerIndex,
      }),
    onSuccess: (data) => {
      setFeedback(data.feedback ?? null);
      if (data.completed) {
        setSummary(data);
        setQuestion(null);
        refreshLearningState();
        void latest.refetch();
      } else {
        setPosition(data.position ?? position);
        setTotal(data.total ?? total);
        setDifficulty(data.difficulty ?? difficulty);
        setConceptTitle(data.conceptTitle ?? conceptTitle);
        setPending(data.question ?? null);
      }
    },
  });

  const abandon = useMutation({
    mutationFn: () => callFunction<{ status: string }>("diagnostic/abandon", { sessionId }),
    onSuccess: () => {
      setSessionId(null);
      setQuestion(null);
      setPending(null);
      setFeedback(null);
      void latest.refetch();
    },
  });

  const advance = () => {
    setQuestion(pending);
    setPending(null);
    setFeedback(null);
    setSelected(null);
  };

  if (curriculum.isLoading) return <LoadingState label="Loading the curriculum…" />;

  /* ------------------------------------------------------------------ result */
  if (summary) {
    const asked = summary.questionsAsked ?? 0;
    const correct = summary.correctCount ?? 0;

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Placement check"
          title={`${correct} of ${asked} correct`}
          description={`Your starting point, measured. Concepts the check never reached are listed separately — they are unknown, not weak.`}
          actions={
            <Button asChild>
              <Link to="/roadmap">
                See my roadmap
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          }
        />

        <Card className="surface-card">
          <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-xl font-bold tabular-nums">{Math.round(summary.score ?? 0)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Questions asked</p>
              <p className="text-xl font-bold tabular-nums">{asked}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Concepts touched</p>
              <p className="text-xl font-bold tabular-nums">
                {(summary.strong?.length ?? 0) + (summary.weak?.length ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <ConceptList
            title="Strong"
            description="You answered correctly at or above the level expected."
            items={summary.strong ?? []}
            icon={<TrendingUp className="h-4 w-4 text-success" aria-hidden />}
            tone="success"
          />
          <ConceptList
            title="Needs work"
            description="Wrong answers here. These lead your roadmap."
            items={summary.weak ?? []}
            icon={<TrendingDown className="h-4 w-4 text-warning" aria-hidden />}
            tone="warning"
          />
          <ConceptList
            title="Not assessed"
            description="The check ended before these. Nothing is claimed about them."
            items={summary.unassessed ?? []}
            icon={<Info className="h-4 w-4 text-muted-foreground" aria-hidden />}
            tone="muted"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => start.mutate()} disabled={start.isPending}>
            Run it again
          </Button>
          <Button asChild variant="outline">
            <Link to="/learn">Browse the curriculum</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------------- running */
  if (sessionId && (question || feedback)) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Question {position} of {total} · {conceptTitle} · level {difficulty}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abandon.mutate()}
            disabled={abandon.isPending}
          >
            End check
          </Button>
        </div>

        <Progress value={(position / Math.max(total, 1)) * 100} className="h-1.5" />

        {question ? (
          <Card className="surface-card">
            <CardContent className="space-y-4 p-5">
              <p className="text-base font-medium leading-relaxed">{question.question}</p>
              <div className="space-y-2" role="radiogroup" aria-label="Answer options">
                {question.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={selected === index}
                    disabled={answer.isPending}
                    onClick={() => setSelected(index)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-60",
                      selected === index
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                        selected === index
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                      aria-hidden
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="leading-relaxed">{option}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {feedback ? (
          <Card
            className={cn(
              "surface-card",
              feedback.isCorrect ? "border-success/40" : "border-destructive/40",
            )}
          >
            <CardContent className="space-y-2 p-4">
              <p
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  feedback.isCorrect ? "text-success" : "text-destructive",
                )}
              >
                {feedback.isCorrect ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <X className="h-4 w-4" aria-hidden />
                )}
                {feedback.isCorrect ? "Correct" : "Not quite"}
              </p>
              {feedback.explanation ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{feedback.explanation}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {answer.error ? (
          <ErrorState
            error={answer.error}
            onRetry={selected !== null ? () => answer.mutate(selected) : undefined}
          />
        ) : null}

        <div className="flex justify-end">
          {feedback && pending ? (
            <Button onClick={advance}>
              Next question
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={() => selected !== null && answer.mutate(selected)}
              disabled={selected === null || answer.isPending || Boolean(feedback)}
            >
              {answer.isPending ? "Checking…" : "Submit answer"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ intro */
  const previous = latest.data?.session;
  const startError = start.error;
  const noConcepts = startError instanceof ApiError && startError.code === "no_concepts";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Placement check"
        title="Find your starting point"
        description="Up to ten questions that get harder when you are right and easier when you are not. It takes about ten minutes, and it is the fastest way to turn an empty progress page into a real one."
      />

      {diagnostic.available === false ? <ConfigNotice message={diagnostic.message ?? ""} /> : null}

      {previous && previous.status === "completed" ? (
        <Card className="surface-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">
                Last check: {previous.correct_count}/{previous.questions_asked} correct
              </p>
              <p className="text-xs text-muted-foreground">
                {previous.completed_at
                  ? `Completed ${new Date(previous.completed_at).toLocaleDateString()}`
                  : "Completed"}
                {previous.score !== null ? ` · ${Math.round(previous.score)}%` : ""}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/roadmap">View roadmap</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {noConcepts ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8" aria-hidden />}
              title="Nothing to assess yet"
              description="The placement check reads from published concepts. None exist yet, so there is nothing real to measure you against."
            />
          </CardContent>
        </Card>
      ) : startError ? (
        <ErrorState error={startError} onRetry={() => start.mutate()} />
      ) : null}

      {chapters.length > 0 ? (
        <div className="space-y-1.5">
          <label htmlFor="scope" className="text-xs font-medium">
            Scope
          </label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger id="scope" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything published</SelectItem>
              {chapters.map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  {chapter.courseTitle} — {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Card className="surface-card border-primary/20">
        <CardContent className="space-y-2 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-start gap-2">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Each answer is scored immediately and the next question's difficulty moves with it.
          </p>
          <p className="flex items-start gap-2">
            <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Results feed your roadmap. Concepts the check never reaches are marked "not assessed", not
            scored zero.
          </p>
        </CardContent>
      </Card>

      <Button
        size="lg"
        onClick={() => start.mutate()}
        disabled={start.isPending || diagnostic.available === false || noConcepts}
      >
        {start.isPending ? "Preparing the first question…" : "Start the check"}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
};

export default Diagnostic;
