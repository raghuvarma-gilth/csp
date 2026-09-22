import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Flame,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  useCurriculum,
  useMastery,
  useMisconceptions,
  useRecommendations,
  useStreak,
} from "@/hooks/useLearning";
import { PageHeader, RecommendationCard, StatTile, recommendationHref } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { callFunction, errorMessage } from "@/lib/api";
import { decayRisk, formatMinutes } from "@/lib/mastery";
import { toast } from "@/hooks/use-toast";

/**
 * Home — what to do next, and why.
 *
 * Every number on this page is counted from rows the student produced. The
 * prototype's version of this screen showed "95% success rate" and "10K+
 * learners" on a database with no attempts in it; there is nothing like that
 * here. When there is no evidence yet the page says so and offers the one
 * action that would create some.
 */

const Home = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const curriculum = useCurriculum();
  const mastery = useMastery();
  const recommendations = useRecommendations();
  const streak = useStreak();
  const misconceptions = useMisconceptions();

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split("@")[0] ?? "there";

  const concepts = useMemo(
    () => (curriculum.data ?? []).flatMap((course) => course.chapters).flatMap((chapter) => chapter.concepts),
    [curriculum.data],
  );

  const stats = useMemo(() => {
    const records = [...(mastery.data?.values() ?? [])];
    const measured = records.filter((record) => record.attempts > 0);
    const mastered = measured.filter((record) => record.mastery >= 85);
    const atRisk = measured.filter(
      (record) => decayRisk(record.peak_mastery, record.mastery, record.last_practiced_at) >= 40,
    );
    const seconds = records.reduce((total, record) => total + record.total_time_seconds, 0);

    return {
      total: concepts.length,
      measured: measured.length,
      mastered: mastered.length,
      atRisk: atRisk.length,
      seconds,
      averageMastery:
        measured.length > 0
          ? Math.round(measured.reduce((total, record) => total + record.mastery, 0) / measured.length)
          : null,
    };
  }, [mastery.data, concepts.length]);

  const plan = useMutation({
    mutationFn: () => callFunction<{ recommendations: unknown[] }>("learning-plan"),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
      toast({
        title: "Plan updated",
        description: `${result.recommendations.length} recommendation${
          result.recommendations.length === 1 ? "" : "s"
        } based on your latest work.`,
      });
    },
    onError: (error) => {
      toast({ title: "Could not rebuild your plan", description: errorMessage(error), variant: "destructive" });
    },
  });

  const isLoading = curriculum.isLoading || mastery.isLoading || recommendations.isLoading;
  const error = curriculum.error ?? mastery.error ?? recommendations.error;

  if (isLoading) return <LoadingState label="Loading your learning state…" />;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void curriculum.refetch();
          void mastery.refetch();
          void recommendations.refetch();
        }}
      />
    );
  }

  const items = recommendations.data ?? [];
  const hasCurriculum = concepts.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home"
        title={`Welcome back, ${displayName}`}
        description={
          stats.measured > 0
            ? `You have measured evidence on ${stats.measured} of ${stats.total} concepts. Everything below is derived from those answers.`
            : "Nothing has been measured yet. The placement check is the fastest way to find your starting point."
        }
        actions={
          <Button
            variant="outline"
            onClick={() => plan.mutate()}
            disabled={plan.isPending || !hasCurriculum}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${plan.isPending ? "animate-spin" : ""}`} aria-hidden />
            {plan.isPending ? "Rebuilding…" : "Rebuild my plan"}
          </Button>
        }
      />

      {!hasCurriculum ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<BookOpen className="h-8 w-8" aria-hidden />}
              title="No published material yet"
              description="A faculty member has to publish at least one concept before there is anything to learn or measure. Until then this page has nothing real to show you."
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Concepts mastered"
          value={stats.measured > 0 ? `${stats.mastered} / ${stats.total}` : "—"}
          hint={stats.measured > 0 ? "85% or above" : "No attempts recorded yet"}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          tone="primary"
        />
        <StatTile
          label="Average mastery"
          value={stats.averageMastery === null ? "—" : `${stats.averageMastery}%`}
          hint={
            stats.averageMastery === null
              ? "Answer something to create a measurement"
              : `Across ${stats.measured} measured concept${stats.measured === 1 ? "" : "s"}`
          }
          icon={<Brain className="h-4 w-4" aria-hidden />}
          tone="accent"
        />
        <StatTile
          label="Day streak"
          value={streak.data?.current_streak ?? 0}
          hint={
            streak.data?.longest_streak
              ? `Longest: ${streak.data.longest_streak} days`
              : "Study on two consecutive days to start one"
          }
          icon={<Flame className="h-4 w-4" aria-hidden />}
          tone="warning"
        />
        <StatTile
          label="Time on task"
          value={stats.seconds > 0 ? formatMinutes(stats.seconds) : "—"}
          hint={stats.seconds > 0 ? "Recorded from real sessions" : "Nothing logged yet"}
          icon={<Target className="h-4 w-4" aria-hidden />}
        />
      </section>

      {stats.atRisk > 0 ? (
        <Card className="surface-card border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
              {stats.atRisk} concept{stats.atRisk === 1 ? "" : "s"} slipping
            </CardTitle>
            <CardDescription>
              You reached a higher score on these and have not practised them recently. A short review
              costs far less than relearning them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link to="/progress">See which ones</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">What to do next</h2>
            <p className="text-sm text-muted-foreground">
              Ordered by what your answers show would help most.
            </p>
          </div>
          {items.length > 0 ? (
            <Badge variant="secondary" className="shrink-0">
              {items.length} item{items.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>

        {items.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<Sparkles className="h-8 w-8" aria-hidden />}
                title="No plan yet"
                description="A plan is built from what you have actually answered — nothing is guessed. Take the placement check, or press “Rebuild my plan” once you have answered a few questions."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm" disabled={!hasCurriculum}>
                      <Link to="/diagnostic">Take the placement check</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/learn">Browse the curriculum</Link>
                    </Button>
                  </div>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const slug = concepts.find((concept) => concept.id === item.concept_id)?.slug ?? null;
              return (
                <RecommendationCard
                  key={item.id}
                  action={item.action}
                  title={item.title}
                  reason={item.reason}
                  estimatedMinutes={item.estimated_minutes}
                  priority={item.priority}
                  href={recommendationHref(item.action, slug)}
                />
              );
            })}
          </div>
        )}
      </section>

      {(misconceptions.data ?? []).length > 0 ? (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Open misconceptions</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Each of these was detected from a specific wrong answer. Answering a question that targets
            it correctly clears it.
          </p>
          <div className="space-y-2">
            {(misconceptions.data ?? []).slice(0, 4).map((row) => {
              const concept = row.concepts as { slug: string; title: string } | null;
              return (
                <Card key={row.id} className="surface-card">
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">“{row.statement}”</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{row.correction}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Seen {row.detected_count} time{row.detected_count === 1 ? "" : "s"}
                        {concept ? ` · ${concept.title}` : ""} · detected in {row.source}
                      </p>
                    </div>
                    {concept ? (
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link to={`/practice/${concept.slug}`}>Practise it</Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default Home;
