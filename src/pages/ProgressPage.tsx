import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Info, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurriculum, useMastery, useMisconceptions, useStreak } from "@/hooks/useLearning";
import { METRIC_ICON, PageHeader, StatTile, MasteryBar } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  daysSince,
  decayRisk,
  formatMinutes,
  masteryColor,
  masteryLabel,
  STATUS_LABEL,
  type MasteryRecord,
} from "@/lib/mastery";
import { cn } from "@/lib/utils";

/**
 * Learning DNA — the one progress page.
 *
 * The prototype had four of these, each counting something different, and none
 * of them counting anything real. This one reads the same rows the rest of the
 * app writes: `student_concept_mastery`, `student_misconceptions`,
 * `learning_sessions`, `learning_streaks`.
 *
 * Two rules hold everywhere on this page:
 *
 *   · A concept with no attempts is drawn as "not started" — a dashed, colourless
 *     tile. It is never a 0% bar, because 0% is a measurement and this is the
 *     absence of one.
 *   · Every number is counted from rows. Nothing is estimated, projected or
 *     smoothed, and there is no "keep it up!" statistic that means nothing.
 */

const DAYS = 30;

const ActivityStrip = ({ byDay }: { byDay: Map<string, number> }) => {
  const days = useMemo(() => {
    const out: Array<{ key: string; date: Date; seconds: number }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      out.push({ key, date, seconds: byDay.get(key) ?? 0 });
    }
    return out;
  }, [byDay]);

  const peak = Math.max(...days.map((day) => day.seconds), 1);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-end gap-[3px]" role="img" aria-label={`Study time over the last ${DAYS} days`}>
        {days.map((day) => {
          const height = day.seconds === 0 ? 4 : Math.max(6, (day.seconds / peak) * 56);
          return (
            <Tooltip key={day.key}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex-1 rounded-sm transition-colors",
                    day.seconds === 0 ? "bg-muted" : "bg-primary/70 hover:bg-primary",
                  )}
                  style={{ height }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                {day.seconds === 0 ? "nothing recorded" : formatMinutes(day.seconds)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

const ProgressPage = () => {
  const { user } = useAuth();
  const curriculum = useCurriculum();
  const mastery = useMastery();
  const misconceptions = useMisconceptions();
  const streak = useStreak();

  const activity = useQuery({
    queryKey: ["activity", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("learning_sessions")
        .select("activity, duration_seconds, started_at")
        .eq("user_id", user!.id)
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const conceptIndex = useMemo(() => {
    const list: Array<{
      id: string;
      slug: string;
      title: string;
      chapterTitle: string;
      courseTitle: string;
    }> = [];
    for (const course of curriculum.data ?? []) {
      for (const chapter of course.chapters) {
        for (const concept of chapter.concepts) {
          list.push({
            id: concept.id,
            slug: concept.slug,
            title: concept.title,
            chapterTitle: chapter.title,
            courseTitle: course.title,
          });
        }
      }
    }
    return list;
  }, [curriculum.data]);

  const records = mastery.data;

  const stats = useMemo(() => {
    if (!records) return null;
    let measured = 0;
    let mastered = 0;
    let needsReview = 0;
    let totalSeconds = 0;

    for (const concept of conceptIndex) {
      const record = records.get(concept.id);
      if (!record || record.attempts === 0) continue;
      measured += 1;
      totalSeconds += record.total_time_seconds;
      if (record.mastery >= 85) mastered += 1;
      if (decayRisk(record.peak_mastery, record.mastery, record.last_practiced_at) >= 40) {
        needsReview += 1;
      }
    }

    return { measured, mastered, needsReview, totalSeconds, total: conceptIndex.length };
  }, [records, conceptIndex]);

  const decaying = useMemo(() => {
    if (!records) return [];
    const out: Array<{ concept: (typeof conceptIndex)[number]; record: MasteryRecord; risk: number }> = [];
    for (const concept of conceptIndex) {
      const record = records.get(concept.id);
      if (!record || record.attempts === 0) continue;
      const risk = decayRisk(record.peak_mastery, record.mastery, record.last_practiced_at);
      if (risk >= 40) out.push({ concept, record, risk });
    }
    return out.sort((a, b) => b.risk - a.risk);
  }, [records, conceptIndex]);

  const activityByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of activity.data ?? []) {
      const key = row.started_at.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + (row.duration_seconds ?? 0));
    }
    return map;
  }, [activity.data]);

  const activityTotals = useMemo(() => {
    const byKind = new Map<string, number>();
    let seconds = 0;
    for (const row of activity.data ?? []) {
      byKind.set(row.activity, (byKind.get(row.activity) ?? 0) + 1);
      seconds += row.duration_seconds ?? 0;
    }
    return { byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]), seconds };
  }, [activity.data]);

  if (curriculum.isLoading || mastery.isLoading) return <LoadingState label="Reading your record…" />;
  if (mastery.error) return <ErrorState error={mastery.error} onRetry={() => void mastery.refetch()} />;

  const nothingMeasured = (stats?.measured ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learning DNA"
        title="What you actually know"
        description="Per-concept mastery from every question you have answered. Concepts you have not attempted are shown as untouched, not as zero."
        actions={
          <Button asChild variant="outline">
            <Link to="/roadmap">
              <Route className="mr-2 h-4 w-4" aria-hidden />
              What to do next
            </Link>
          </Button>
        }
      />

      {nothingMeasured ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<METRIC_ICON.measured className="h-8 w-8" aria-hidden />}
              title="Nothing measured yet"
              description="This page fills in from real answers. The fastest way to start it is the placement check — ten questions and every tile below gets a real value."
              action={
                <Button asChild size="sm">
                  <Link to="/diagnostic">Take the placement check</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Concepts measured"
            value={`${stats!.measured} / ${stats!.total}`}
            hint="attempted at least once"
            icon={<METRIC_ICON.measured className="h-4 w-4" aria-hidden />}
          />
          <StatTile
            label="Mastered"
            value={String(stats!.mastered)}
            hint="85% or above"
            icon={<METRIC_ICON.mastered className="h-4 w-4" aria-hidden />}
            tone={stats!.mastered > 0 ? "primary" : undefined}
          />
          <StatTile
            label="Needs review"
            value={String(stats!.needsReview)}
            hint="fading since last practised"
            icon={<METRIC_ICON.slipping className="h-4 w-4" aria-hidden />}
            tone={stats!.needsReview > 0 ? "warning" : undefined}
          />
          <StatTile
            label="Time on concepts"
            value={formatMinutes(stats!.totalSeconds)}
            hint="recorded across attempts"
            icon={<METRIC_ICON.time className="h-4 w-4" aria-hidden />}
          />
          <StatTile
            label="Streak"
            value={streak.data ? `${streak.data.current_streak} d` : "—"}
            hint={
              streak.data
                ? `longest ${streak.data.longest_streak} · ${streak.data.total_active_days} active days`
                : "no activity recorded yet"
            }
            icon={<METRIC_ICON.streak className="h-4 w-4" aria-hidden />}
          />
        </div>
      )}

      {/* --------------------------------------------------------- DNA grid */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Concept map
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-border bg-transparent" />
              Not started
            </span>
            {[20, 55, 75, 95].map((value) => (
              <span key={value} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-sm", masteryColor(value))} />
                {masteryLabel(value)}
              </span>
            ))}
          </div>
        </div>

        {curriculum.data && curriculum.data.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<Info className="h-8 w-8" aria-hidden />}
                title="No published curriculum"
                description="There is nothing to map yet. Concepts appear here once faculty publish them."
              />
            </CardContent>
          </Card>
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="space-y-4">
              {(curriculum.data ?? []).map((course) => (
                <Card key={course.id} className="surface-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {course.chapters.map((chapter) => (
                      <div key={chapter.id} className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{chapter.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {chapter.concepts.map((concept) => {
                            const record = records?.get(concept.id);
                            const measured = Boolean(record && record.attempts > 0);
                            return (
                              <Tooltip key={concept.id}>
                                <TooltipTrigger asChild>
                                  <Link
                                    to={`/learn/${concept.slug}`}
                                    className={cn(
                                      "h-8 w-8 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                      measured
                                        ? masteryColor(record!.mastery)
                                        : "border border-dashed border-border/70 bg-transparent",
                                    )}
                                    aria-label={`${concept.title}: ${
                                      measured ? `${Math.round(record!.mastery)}% mastery` : "not started"
                                    }`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  <p className="font-medium">{concept.title}</p>
                                  {measured ? (
                                    <p className="text-muted-foreground">
                                      {Math.round(record!.mastery)}% · {STATUS_LABEL[record!.status]} ·{" "}
                                      {record!.correct_attempts}/{record!.attempts} correct
                                    </p>
                                  ) : (
                                    <p className="text-muted-foreground">
                                      Not started — nothing has been measured here.
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TooltipProvider>
        )}
      </section>

      {/* ------------------------------------------------------------ decay */}
      {decaying.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Fading
          </h2>
          <p className="text-xs text-muted-foreground">
            These were stronger once. The risk figure comes from how far mastery has fallen from its
            peak and how long it has been — not from a guess about memory.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {decaying.slice(0, 8).map(({ concept, record, risk }) => {
              const days = daysSince(record.last_practiced_at);
              return (
                <Card key={concept.id} className="surface-card border-warning/30">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/learn/${concept.slug}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {concept.title}
                      </Link>
                      <Badge variant="outline" className="shrink-0 border-warning/40 text-[10px] text-warning">
                        {Math.round(risk)}% risk
                      </Badge>
                    </div>
                    <MasteryBar value={record.mastery} showLabel />
                    <p className="text-[11px] text-muted-foreground">
                      Peak {Math.round(record.peak_mastery)}%
                      {days !== null ? ` · last practised ${days === 0 ? "today" : `${days} d ago`}` : ""}
                    </p>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to={`/practice/${concept.slug}`}>Practise it</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- misconceptions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Misconceptions
        </h2>
        {misconceptions.isLoading ? (
          <LoadingState label="Loading…" />
        ) : (misconceptions.data ?? []).length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-4 text-xs text-muted-foreground">
              None open. These are recorded when a wrong answer matches a known misconception for a
              concept — not every mistake creates one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(misconceptions.data ?? []).map((item) => {
              const concept = item.concepts as unknown as { slug: string; title: string } | null;
              return (
                <Card key={item.id} className="surface-card border-destructive/25">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                      {item.statement}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {concept ? `${concept.title} · ` : ""}
                      seen {item.detected_count} {item.detected_count === 1 ? "time" : "times"}
                      {item.source ? ` · from ${item.source}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs leading-relaxed">{item.correction}</p>
                    {concept ? (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/learn/${concept.slug}`}>Re-read</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/practice/${concept.slug}`}>Practise</Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Last {DAYS} days
        </h2>
        <Card className="surface-card">
          <CardContent className="space-y-3 p-4">
            {activity.isLoading ? (
              <LoadingState label="Loading activity…" />
            ) : activity.error ? (
              <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
            ) : (activity.data ?? []).length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden />
                No sessions recorded in the last {DAYS} days.
              </p>
            ) : (
              <>
                <ActivityStrip byDay={activityByDay} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span>{formatMinutes(activityTotals.seconds)} total</span>
                  {activityTotals.byKind.map(([kind, count]) => (
                    <span key={kind}>
                      {count} × {kind}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default ProgressPage;
