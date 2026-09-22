import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Clock,
  Code,
  Flame,
  GraduationCap,
  Layers,
  Lock,
  RefreshCw,
  Sparkles,
  Target,
  Terminal,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAchievements } from "@/hooks/useLearning";
import { PageHeader, StatTile } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * Achievements.
 *
 * Every badge is defined by a metric and a threshold, and it is granted by
 * `evaluate_achievements()` — a SECURITY DEFINER function that counts rows the
 * student cannot write. Nothing on this page can award anything; if it could,
 * the badges would be worth nothing.
 *
 * The progress numbers below re-count the same things the SQL counts, so a
 * student can see "3 of 5" instead of a locked padlock with no explanation.
 * Where a metric cannot be counted honestly in the browser, the bar is omitted
 * rather than approximated — an invented "62%" would be worse than no bar.
 */

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  layers: Layers,
  "graduation-cap": GraduationCap,
  code: Code,
  terminal: Terminal,
  target: Target,
  "refresh-cw": RefreshCw,
  flame: Flame,
  award: Award,
  clock: Clock,
};

const METRIC_UNIT: Record<string, string> = {
  concepts_mastered: "concepts mastered",
  problems_solved: "problems solved",
  problems_debugged: "solved without hints",
  concepts_recovered: "recovered concepts",
  streak_days: "day streak",
  quizzes_passed: "quizzes at 70%+",
  study_minutes: "minutes studied",
};

/** Mirrors the CASE in public.evaluate_achievements(). */
interface Measurements {
  concepts_mastered: number;
  problems_solved: number;
  problems_debugged: number;
  concepts_recovered: number;
  streak_days: number;
  quizzes_passed: number;
  study_minutes: number;
}

const Achievements = () => {
  const { user } = useAuth();
  const achievements = useAchievements();

  const measured = useQuery({
    queryKey: ["achievement-progress", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Measurements> => {
      const userId = user!.id;
      const [masteryRows, attempts, streaks, quizzes, sessions, resolved] = await Promise.all([
        supabase
          .from("student_concept_mastery")
          .select("concept_id, status, misconception_count")
          .eq("user_id", userId),
        supabase
          .from("coding_attempts")
          .select("problem_id, is_solved, hints_used, tests_total")
          .eq("user_id", userId)
          .eq("is_solved", true),
        supabase.from("learning_streaks").select("longest_streak").eq("user_id", userId).maybeSingle(),
        supabase
          .from("quiz_attempts")
          .select("id, score, completed_at")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("score", 70),
        supabase.from("learning_sessions").select("duration_seconds").eq("user_id", userId),
        supabase
          .from("student_misconceptions")
          .select("concept_id")
          .eq("user_id", userId)
          .eq("resolved", true),
      ]);

      for (const result of [masteryRows, attempts, streaks, quizzes, sessions, resolved]) {
        if (result.error) throw result.error;
      }

      const mastered = (masteryRows.data ?? []).filter((row) => row.status === "mastered");
      const recoveredConcepts = new Set((resolved.data ?? []).map((row) => row.concept_id));

      const solvedIds = new Set<string>();
      const unaidedIds = new Set<string>();
      for (const row of attempts.data ?? []) {
        solvedIds.add(row.problem_id);
        if (row.hints_used === 0 && (row.tests_total ?? 0) > 0) unaidedIds.add(row.problem_id);
      }

      return {
        concepts_mastered: mastered.length,
        problems_solved: solvedIds.size,
        problems_debugged: unaidedIds.size,
        concepts_recovered: mastered.filter(
          (row) => row.misconception_count === 0 && recoveredConcepts.has(row.concept_id),
        ).length,
        streak_days: streaks.data?.longest_streak ?? 0,
        quizzes_passed: (quizzes.data ?? []).length,
        study_minutes: Math.floor(
          (sessions.data ?? []).reduce((total, row) => total + (row.duration_seconds ?? 0), 0) / 60,
        ),
      };
    },
  });

  const summary = useMemo(() => {
    const list = achievements.data ?? [];
    const earned = list.filter((item) => item.earnedAt);
    return {
      total: list.length,
      earned: earned.length,
      points: earned.reduce((sum, item) => sum + item.points, 0),
      possible: list.reduce((sum, item) => sum + item.points, 0),
    };
  }, [achievements.data]);

  if (achievements.isLoading) return <LoadingState label="Loading achievements…" />;
  if (achievements.error) {
    return <ErrorState error={achievements.error} onRetry={() => void achievements.refetch()} />;
  }

  const list = achievements.data ?? [];

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Achievements" title="Nothing to earn yet" />
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<Trophy className="h-8 w-8" aria-hidden />}
              title="No achievements defined"
              description="Achievements are seeded with the curriculum. None exist on this installation, so there is nothing to show."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const earned = list.filter((item) => item.earnedAt);
  const locked = list.filter((item) => !item.earnedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Achievements"
        title={`${summary.earned} of ${summary.total} earned`}
        description="Each of these is granted by the server after counting real activity. None can be awarded from this page, and none are awarded for opening it."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Earned" value={String(summary.earned)} icon={<Trophy className="h-4 w-4" aria-hidden />} />
        <StatTile label="Points" value={`${summary.points} / ${summary.possible}`} />
        <StatTile
          label="Concepts mastered"
          value={measured.data ? String(measured.data.concepts_mastered) : "—"}
        />
        <StatTile
          label="Study time"
          value={measured.data ? `${Math.floor(measured.data.study_minutes / 60)} h` : "—"}
          hint="from recorded sessions"
        />
      </div>

      {measured.error ? (
        <ErrorState error={measured.error} onRetry={() => void measured.refetch()} />
      ) : null}

      {earned.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Earned
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {earned.map((item) => {
              const Icon = ICONS[item.icon] ?? Award;
              return (
                <Card key={item.id} className="surface-card border-success/40">
                  <CardContent className="flex gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {item.points} pts
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="text-[11px] text-success">
                        Earned {new Date(item.earnedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Still to earn
        </h2>

        {locked.length === 0 ? (
          <Card className="surface-card border-success/40">
            <CardContent className="p-4 text-sm">
              Every achievement defined here has been earned.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {locked.map((item) => {
              const Icon = ICONS[item.icon] ?? Award;
              const value = measured.data?.[item.metric as keyof Measurements];
              const known = typeof value === "number";
              const percent = known ? Math.min(100, (value / item.threshold) * 100) : 0;

              return (
                <Card key={item.id} className="surface-card">
                  <CardContent className="flex gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-muted-foreground">
                          {item.title}
                        </h3>
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>

                      {known ? (
                        <>
                          <Progress value={percent} className="h-1.5" />
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {value} / {item.threshold} {METRIC_UNIT[item.metric] ?? item.metric}
                          </p>
                        </>
                      ) : measured.isLoading ? (
                        <p className="text-[11px] text-muted-foreground">Counting…</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Needs {item.threshold} {METRIC_UNIT[item.metric] ?? item.metric}.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card className="surface-card border-primary/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Progress here updates when you finish a quiz or pass a coding problem — the server
            re-counts and grants anything you have reached.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/practice">Practise</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/code">Coding Lab</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Achievements;
