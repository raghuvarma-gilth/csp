import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Info, Keyboard, Play, Square, Timer } from "lucide-react";
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
import { PageHeader, StatTile } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiTarget, callFunction, getJson } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Focus sessions.
 *
 * This screen replaces the prototype's "MindPulse", which displayed a
 * wellbeing score, an energy level and an emotional state — all of them
 * `Math.random()`. Nothing here is inferred about how a student feels.
 *
 * Four things are recorded, and every one of them is something the browser can
 * actually observe:
 *
 *   · present time — seconds this tab was visible (Page Visibility API)
 *   · away events  — how many times it stopped being visible
 *   · interactions — real keystrokes, clicks and scrolls
 *   · completed    — whether the target the student set was reached
 *
 * The server clamps present time to the session's wall-clock age, so this page
 * cannot report more focused time than has elapsed. "Present" means the tab was
 * on screen. It is not a measure of attention, and the copy says so rather than
 * letting a number imply more than it knows.
 */

const TARGETS = [15, 25, 45, 60, 90];

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

interface StartResponse {
  sessionId: string;
  startedAt: string;
  targetMinutes: number;
  closedStale: number;
}

interface StopResponse {
  sessionId: string;
  presentSeconds: number;
  elapsedSeconds: number;
  awayEvents: number;
  interactionCount: number;
  durationMinutes: number;
  completed: boolean;
  presentPercent: number | null;
}

interface HistoryRow {
  id: string;
  concept_id: string | null;
  target_minutes: number;
  present_seconds: number;
  away_events: number;
  interaction_count: number;
  duration_minutes: number | null;
  completed: boolean;
  started_at: string;
  ended_at: string | null;
}

interface HistoryResponse {
  sessions: HistoryRow[];
  summary: {
    sessions: number;
    completed: number;
    totalPresentSeconds: number;
    medianAwayEvents: number | null;
  };
}

const FocusSession = () => {
  const curriculum = useCurriculum();
  const refreshLearningState = useRefreshLearningState();

  const [targetMinutes, setTargetMinutes] = useState(25);
  const [conceptId, setConceptId] = useState("none");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<StopResponse | null>(null);

  /* Counters live in refs so a keystroke does not re-render the page; the
     display reads from them once a second. */
  const present = useRef(0);
  const away = useRef(0);
  const interactions = useRef(0);
  const lastInteraction = useRef(0);

  /** Bumped once a second purely to redraw counters that live in refs. */
  const [, redraw] = useState(0);

  const concepts = useMemo(
    () =>
      (curriculum.data ?? []).flatMap((course) =>
        course.chapters.flatMap((chapter) =>
          chapter.concepts.map((concept) => ({ ...concept, courseTitle: course.title })),
        ),
      ),
    [curriculum.data],
  );

  const history = useQuery({
    queryKey: ["focus-history"],
    enabled: apiTarget === "python",
    queryFn: () => getJson<HistoryResponse>("focus/history"),
  });

  const counters = useCallback(
    () => ({
      sessionId: sessionId!,
      presentSeconds: Math.round(present.current),
      awayEvents: away.current,
      interactionCount: interactions.current,
    }),
    [sessionId],
  );

  const start = useMutation({
    mutationFn: () =>
      callFunction<StartResponse>("focus/start", {
        targetMinutes,
        conceptId: conceptId === "none" ? null : conceptId,
        cameraEnabled: false,
      }),
    onSuccess: (data) => {
      present.current = 0;
      away.current = 0;
      interactions.current = 0;
      setSummary(null);
      setSessionId(data.sessionId);
      setStartedAt(Date.parse(data.startedAt) || Date.now());
    },
  });

  const progress = useMutation({
    mutationFn: () => callFunction<{ presentSeconds: number }>("focus/progress", counters()),
  });

  const stop = useMutation({
    mutationFn: () => callFunction<StopResponse>("focus/stop", counters()),
    onSuccess: (data) => {
      setSummary(data);
      setSessionId(null);
      setStartedAt(null);
      refreshLearningState();
      void history.refetch();
    },
  });

  /* ------------------------------------------------------------ measurement */
  useEffect(() => {
    if (!sessionId) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") away.current += 1;
    };
    const onInteract = () => {
      const stamp = Date.now();
      if (stamp - lastInteraction.current < 1000) return;
      lastInteraction.current = stamp;
      interactions.current += 1;
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("scroll", onInteract, { passive: true });

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") present.current += 1;
      redraw((value) => value + 1);
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("scroll", onInteract);
      window.clearInterval(timer);
    };
  }, [sessionId]);

  /* A checkpoint every half minute, so a closed laptop loses at most that. */
  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => progress.mutate(), 30_000);
    return () => window.clearInterval(timer);
    // `progress` is a stable mutation object from react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (curriculum.isLoading) return <LoadingState label="Loading…" />;

  const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const targetSeconds = targetMinutes * 60;
  const presentSeconds = present.current;
  const reached = presentSeconds >= targetSeconds;

  /* ----------------------------------------------------------------- running */
  if (sessionId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          eyebrow="Focus session"
          title={formatDuration(presentSeconds)}
          description={`Present time out of a ${targetMinutes}-minute target. The clock only advances while this tab is on screen.`}
        />

        <Progress value={Math.min((presentSeconds / targetSeconds) * 100, 100)} className="h-2" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Elapsed"
            value={formatDuration(elapsed)}
            hint="Wall clock since start"
            icon={<Timer className="h-4 w-4" aria-hidden />}
          />
          <StatTile
            label="Present"
            value={formatDuration(presentSeconds)}
            hint="Tab visible"
            icon={<Eye className="h-4 w-4" aria-hidden />}
          />
          <StatTile
            label="Away"
            value={String(away.current)}
            hint={away.current === 1 ? "time the tab was hidden" : "times the tab was hidden"}
            icon={<EyeOff className="h-4 w-4" aria-hidden />}
          />
          <StatTile
            label="Interactions"
            value={String(interactions.current)}
            hint="Keys, clicks, scrolls"
            icon={<Keyboard className="h-4 w-4" aria-hidden />}
          />
        </div>

        {reached ? (
          <Card className="surface-card border-success/40">
            <CardContent className="p-4 text-sm text-success">
              Target reached. You can keep going — the extra time still counts.
            </CardContent>
          </Card>
        ) : null}

        {stop.error ? <ErrorState error={stop.error} onRetry={() => stop.mutate()} /> : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => stop.mutate()} disabled={stop.isPending} variant="destructive">
            <Square className="mr-2 h-4 w-4" aria-hidden />
            {stop.isPending ? "Saving…" : "End session"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/learn">Open the curriculum in this tab</Link>
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Leaving this tab pauses the clock and counts an away event. Nothing is recorded about what
          you do elsewhere, and no camera or microphone is used.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ setup */
  const stats = history.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Focus session"
        title="Time you actually spent"
        description="A timer that only counts while this tab is on screen, plus a record of how often you left it. That is all it measures — there is no inference about your mood, stress or attention."
      />

      {summary ? (
        <Card className={cn("surface-card", summary.completed ? "border-success/40" : "border-warning/40")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {summary.completed ? "Target reached" : "Session ended early"}
            </CardTitle>
            <CardDescription className="text-xs">
              {formatDuration(summary.presentSeconds)} present out of{" "}
              {formatDuration(summary.elapsedSeconds)} elapsed
              {summary.presentPercent !== null ? ` · ${summary.presentPercent}% of the session` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Present" value={formatDuration(summary.presentSeconds)} />
            <StatTile label="Away events" value={String(summary.awayEvents)} />
            <StatTile label="Interactions" value={String(summary.interactionCount)} />
            <StatTile label="Duration" value={`${summary.durationMinutes} min`} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-card">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="target" className="text-xs font-medium">
                Target
              </label>
              <Select
                value={String(targetMinutes)}
                onValueChange={(value) => setTargetMinutes(Number(value))}
              >
                <SelectTrigger id="target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGETS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="concept" className="text-xs font-medium">
                Working on (optional)
              </label>
              <Select value={conceptId} onValueChange={setConceptId}>
                <SelectTrigger id="concept">
                  <SelectValue placeholder="Nothing in particular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nothing in particular</SelectItem>
                  {concepts.map((concept) => (
                    <SelectItem key={concept.id} value={concept.id}>
                      {concept.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {start.error ? <ErrorState error={start.error} onRetry={() => start.mutate()} /> : null}

          <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>
            <Play className="mr-2 h-4 w-4" aria-hidden />
            {start.isPending ? "Starting…" : "Start the timer"}
          </Button>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            "Present" means this browser tab was visible. It is not a measure of attention or
            concentration, and this page will never present it as one.
          </p>
        </CardContent>
      </Card>

      {apiTarget === "python" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your sessions
          </h2>

          {history.isLoading ? (
            <LoadingState label="Loading history…" />
          ) : history.error ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : (history.data?.sessions ?? []).length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Timer className="h-8 w-8" aria-hidden />}
                  title="No sessions yet"
                  description="Once you run a timer, the record of it shows up here — real minutes only."
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Sessions" value={String(stats.sessions)} />
                  <StatTile
                    label="Targets met"
                    value={`${stats.completed} / ${stats.sessions}`}
                  />
                  <StatTile
                    label="Total present"
                    value={`${Math.round(stats.totalPresentSeconds / 60)} min`}
                  />
                  <StatTile
                    label="Median away"
                    value={stats.medianAwayEvents === null ? "—" : String(stats.medianAwayEvents)}
                    hint="per finished session"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                {(history.data?.sessions ?? []).map((row) => (
                  <Card key={row.id} className="surface-card">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {new Date(row.started_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(row.present_seconds)} present · target {row.target_minutes}{" "}
                          min · {row.away_events} away · {row.interaction_count} interactions
                        </p>
                      </div>
                      {row.ended_at === null ? (
                        <Badge variant="outline" className="text-[10px]">
                          Not closed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            row.completed
                              ? "border-success/40 text-success"
                              : "border-warning/40 text-warning",
                          )}
                        >
                          {row.completed ? "Target met" : "Ended early"}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default FocusSession;
