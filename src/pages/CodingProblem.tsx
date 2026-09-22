import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  Check,
  CircleAlert,
  Code2,
  Lightbulb,
  Play,
  Send,
  Terminal,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRefreshLearningState } from "@/hooks/useLearning";
import { useApiHealth, useFeature } from "@/hooks/useApiHealth";
import { Markdown } from "@/components/learning/Markdown";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ApiError, callFunction } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * One coding problem, worked the way it would be asked in an interview.
 *
 * Four stages — approach, pseudocode, code, complexity — each reviewed by a
 * mentor that is instructed never to hand over the solution. Hints are a
 * separate, counted action, so "I used three hints" stays true.
 *
 * Running code is real execution on the server against the problem's test
 * cases. A pass is a pass because the tests passed, not because a model said
 * the code looked right. Hidden cases are shown as hidden: the inputs and
 * expectations are withheld, the verdict is not.
 *
 * There is no Monaco/CodeMirror dependency in this project, so the editor is a
 * monospaced textarea with tab handling. That is a deliberate trade: it loads
 * instantly and it works.
 */

const STAGES = [
  { value: "approach", label: "Approach", prompt: "Describe your plan in plain English. No code." },
  { value: "pseudocode", label: "Pseudocode", prompt: "Sketch the control flow. Still no real code." },
  { value: "code", label: "Code", prompt: "Paste the code you want reviewed." },
  { value: "complexity", label: "Complexity", prompt: "State the time and space complexity, and why." },
] as const;

const VERDICT: Record<string, { label: string; className: string }> = {
  on_track: { label: "On track", className: "border-success/40 text-success" },
  needs_work: { label: "Needs work", className: "border-warning/40 text-warning" },
  off_track: { label: "Off track", className: "border-destructive/40 text-destructive" },
};

interface TestResult {
  index: number;
  hidden: boolean;
  passed: boolean;
  args: unknown[] | null;
  expected: unknown;
  received: unknown;
  error: string | null;
}

interface RunResponse {
  timedOut?: boolean;
  compileError?: string;
  message?: string;
  language?: string;
  entry?: string;
  testsPassed: number;
  testsTotal: number;
  isSolved?: boolean;
  coaching?: string | null;
  stdout: string;
  newAchievements?: string[];
  results: TestResult[];
}

const display = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value ?? null);

const CodingProblem = () => {
  const { problemSlug } = useParams<{ problemSlug: string }>();
  const health = useApiHealth();
  const mentorFeature = useFeature("codeMentor");
  const refreshLearningState = useRefreshLearningState();

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<string>("approach");
  const [note, setNote] = useState("");
  const [mentorTurns, setMentorTurns] = useState<
    Array<{ stage: string; text: string; verdict: string; feedback: string; nextQuestion: string | null }>
  >([]);
  const [hints, setHints] = useState<string[]>([]);
  const [hintsTotal, setHintsTotal] = useState<number | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const startedAt = useRef(Date.now());
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const problem = useQuery({
    queryKey: ["coding-problem", problemSlug],
    enabled: Boolean(problemSlug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coding_problems")
        .select(
          "id, slug, title, prompt, difficulty, starter_code, expected_complexity, concept_id, concepts(slug, title)",
        )
        .eq("slug", problemSlug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("That problem could not be found, or it has not been published.");
      return data;
    },
  });

  /* Memoised because it is an effect dependency below: a fresh `[]` on every
     render would re-run the language check forever. */
  const runnable = useMemo(
    () => health.data?.runnableLanguages ?? [],
    [health.data],
  );
  const executionEnabled = runnable.length > 0;

  const starters = useMemo(
    () => (problem.data?.starter_code as Record<string, string> | null) ?? {},
    [problem.data],
  );

  /* Loads the starter for the chosen language, but never over the student's own work. */
  useEffect(() => {
    if (!problem.data) return;
    setCode((current) => (current.trim() ? current : starters[language] ?? ""));
  }, [problem.data, starters, language]);

  useEffect(() => {
    if (runnable.length > 0 && !runnable.includes(language)) setLanguage(runnable[0]);
  }, [runnable, language]);

  const hint = useMutation({
    mutationFn: () =>
      callFunction<{ hint: string; hintsUsed: number; hintsTotal: number }>("code-hint", {
        problemId: problem.data!.id,
        hintsUsed: hints.length,
      }),
    onSuccess: (data) => {
      setHints((current) => [...current, data.hint]);
      setHintsTotal(data.hintsTotal);
    },
  });

  const mentor = useMutation({
    mutationFn: (text: string) =>
      callFunction<{ verdict: string; feedback: string; nextQuestion: string | null }>("code-mentor", {
        problemId: problem.data!.id,
        stage,
        text,
        language,
      }),
    onSuccess: (data, text) => {
      setMentorTurns((current) => [...current, { stage, text, ...data }]);
      setNote("");
    },
  });

  const execute = useMutation({
    mutationFn: () =>
      callFunction<RunResponse>("code-run", {
        problemId: problem.data!.id,
        language,
        code,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      }),
    onSuccess: (data) => {
      setRun(data);
      if (data.isSolved) refreshLearningState();
    },
  });

  if (problem.isLoading) return <LoadingState label="Loading the problem…" />;
  if (problem.error) {
    return (
      <EmptyState
        icon={<Code2 className="h-8 w-8" aria-hidden />}
        title="Problem not found"
        description="That problem is not published, so there is nothing to solve here."
        action={
          <Button asChild size="sm">
            <Link to="/code">Back to the lab</Link>
          </Button>
        }
      />
    );
  }

  const data = problem.data!;
  const concept = data.concepts as { slug: string; title: string } | null;
  const hintError = hint.error;
  const exhausted = hintError instanceof ApiError && hintError.code === "no_more_hints";
  const stageMeta = STAGES.find((item) => item.value === stage) ?? STAGES[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/code" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Coding Lab
        </Link>
        {concept ? (
          <Link to={`/learn/${concept.slug}`} className="text-xs text-primary hover:underline">
            Read {concept.title}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------ problem + mentor */}
        <div className="min-w-0 space-y-4">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{data.title}</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  L{data.difficulty}
                </Badge>
                {data.expected_complexity ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    target {data.expected_complexity}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <Markdown content={data.prompt} />
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-warning" aria-hidden />
                  Hints
                </CardTitle>
                <CardDescription className="text-xs">
                  {hintsTotal !== null
                    ? `${hints.length} of ${hintsTotal} used`
                    : "Revealed one at a time, and counted."}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => hint.mutate()}
                disabled={hint.isPending || exhausted}
              >
                {exhausted ? "No more" : hint.isPending ? "…" : "Reveal a hint"}
              </Button>
            </CardHeader>
            {hints.length > 0 || hintError ? (
              <CardContent className="space-y-2">
                {hints.map((text, index) => (
                  <div key={index} className="rounded-lg bg-warning/5 p-2.5 text-xs leading-relaxed">
                    <span className="font-semibold">Hint {index + 1}. </span>
                    {text}
                  </div>
                ))}
                {hintError && !exhausted ? <ErrorState error={hintError} /> : null}
              </CardContent>
            ) : null}
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mentor</CardTitle>
              <CardDescription className="text-xs">
                It will not give you the solution at any stage. That is the point.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mentorFeature.available === false ? (
                <ConfigNotice message={mentorFeature.message ?? ""} />
              ) : null}

              <Tabs value={stage} onValueChange={setStage}>
                <TabsList className="grid w-full grid-cols-4">
                  {STAGES.map((item) => (
                    <TabsTrigger key={item.value} value={item.value} className="text-xs">
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {mentorTurns.length > 0 ? (
                <div className="space-y-3">
                  {mentorTurns.map((turn, index) => (
                    <div key={index} className="space-y-1.5 rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {turn.stage}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", VERDICT[turn.verdict]?.className)}
                        >
                          {VERDICT[turn.verdict]?.label ?? turn.verdict}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-[11px] italic text-muted-foreground">“{turn.text}”</p>
                      <Markdown content={turn.feedback} className="text-xs" />
                      {turn.nextQuestion ? (
                        <p className="rounded bg-primary/5 p-2 text-xs font-medium text-primary">
                          {turn.nextQuestion}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {mentor.error ? (
                <ErrorState error={mentor.error} onRetry={() => note.trim() && mentor.mutate(note)} />
              ) : null}

              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={stageMeta.prompt}
                  rows={3}
                  disabled={mentorFeature.available === false}
                  className="resize-none text-sm"
                  aria-label={`Your ${stageMeta.label.toLowerCase()}`}
                />
                <div className="flex items-center justify-between gap-2">
                  {stage === "code" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNote(code)}
                      disabled={!code.trim()}
                    >
                      Use my editor code
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    size="sm"
                    onClick={() => mentor.mutate(note)}
                    disabled={!note.trim() || mentor.isPending || mentorFeature.available === false}
                  >
                    {mentor.isPending ? "Reviewing…" : "Ask the mentor"}
                    <Send className="ml-2 h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* -------------------------------------------------- editor + tests */}
        <div className="min-w-0 space-y-4">
          <Card className="surface-card">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Terminal className="h-4 w-4" aria-hidden />
                Your solution
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={language} onValueChange={setLanguage} disabled={!executionEnabled}>
                  <SelectTrigger className="h-8 w-32 text-xs" aria-label="Language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(executionEnabled ? runnable : ["python"]).map((item) => (
                      <SelectItem key={item} value={item} className="text-xs">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => execute.mutate()}
                  disabled={!code.trim() || execute.isPending || !executionEnabled}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {execute.isPending ? "Running…" : "Run tests"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!executionEnabled && health.data ? (
                <ConfigNotice message="Code execution is turned off on this server. You can still use hints and the mentor." />
              ) : null}

              <Textarea
                ref={editorRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Tab") return;
                  event.preventDefault();
                  const element = event.currentTarget;
                  const { selectionStart, selectionEnd } = element;
                  const next = `${code.slice(0, selectionStart)}    ${code.slice(selectionEnd)}`;
                  setCode(next);
                  requestAnimationFrame(() => {
                    element.selectionStart = element.selectionEnd = selectionStart + 4;
                  });
                }}
                spellCheck={false}
                rows={16}
                placeholder={`Write your ${language} solution here.`}
                className="resize-y font-mono text-xs leading-relaxed"
                aria-label="Code editor"
              />

              <p className="text-[11px] text-muted-foreground">
                Tab inserts four spaces. Your function is called by name — keep the signature from the
                starter code.
              </p>

              {execute.error ? <ErrorState error={execute.error} onRetry={() => execute.mutate()} /> : null}
            </CardContent>
          </Card>

          {run ? (
            <Card
              className={cn(
                "surface-card",
                run.isSolved && "border-success/40",
                (run.timedOut || run.compileError) && "border-destructive/40",
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {run.timedOut ? (
                    <>
                      <Timer className="h-4 w-4 text-destructive" aria-hidden />
                      Timed out
                    </>
                  ) : run.compileError ? (
                    <>
                      <CircleAlert className="h-4 w-4 text-destructive" aria-hidden />
                      Did not compile
                    </>
                  ) : run.isSolved ? (
                    <>
                      <Check className="h-4 w-4 text-success" aria-hidden />
                      All {run.testsTotal} tests passed
                    </>
                  ) : (
                    <>
                      <TriangleAlert className="h-4 w-4 text-warning" aria-hidden />
                      {run.testsPassed} of {run.testsTotal} tests passed
                    </>
                  )}
                </CardTitle>
                {run.entry ? (
                  <CardDescription className="font-mono text-[11px]">
                    Called {run.entry}() in {run.language}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {run.timedOut ? (
                  <p className="rounded-lg bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                    {run.message ?? "Execution was stopped. Look for a loop that never ends."}
                  </p>
                ) : null}

                {run.compileError ? (
                  <pre className="overflow-x-auto rounded-lg bg-destructive/5 p-3 font-mono text-[11px] leading-relaxed text-destructive">
                    {run.compileError}
                  </pre>
                ) : null}

                {(run.newAchievements ?? []).length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-accent" aria-hidden />
                    {(run.newAchievements ?? []).map((title) => (
                      <Badge key={title} variant="secondary" className="text-[10px]">
                        {title}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {run.results.length > 0 ? (
                  <ul className="space-y-1.5">
                    {run.results.map((result) => (
                      <li
                        key={result.index}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-[11px]",
                          result.passed ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5",
                        )}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          {result.passed ? (
                            <Check className="h-3 w-3 text-success" aria-hidden />
                          ) : (
                            <X className="h-3 w-3 text-destructive" aria-hidden />
                          )}
                          Test {result.index + 1}
                          {result.hidden ? (
                            <Badge variant="outline" className="text-[9px]">
                              hidden
                            </Badge>
                          ) : null}
                        </div>
                        {!result.hidden ? (
                          <dl className="mt-1 space-y-0.5 font-mono">
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">in</dt>
                              <dd className="min-w-0 break-all">{display(result.args)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">want</dt>
                              <dd className="min-w-0 break-all">{display(result.expected)}</dd>
                            </div>
                            {!result.passed ? (
                              <div className="flex gap-2">
                                <dt className="text-muted-foreground">got</dt>
                                <dd className="min-w-0 break-all">{display(result.received)}</dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : null}
                        {result.error ? (
                          <p className="mt-1 font-mono text-destructive">{result.error}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {run.coaching ? (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Where it went wrong
                    </p>
                    <Markdown content={run.coaching} className="text-xs" />
                  </div>
                ) : null}

                {run.stdout ? (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Output
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
                      {run.stdout}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CodingProblem;
