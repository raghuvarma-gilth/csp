import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { dashboardFor, useUserRole } from "@/hooks/useUserRole";
import {
  useCurriculum,
  useMastery,
  useMisconceptions,
  useRecommendations,
  useStreak,
} from "@/hooks/useLearning";
import {
  CourseProgressCard,
  METRIC_ICON,
  RecommendationCard,
  StatTile,
  recommendationHref,
} from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  AnnouncementCard,
  OpportunityCard,
  usePublishedAnnouncements,
  usePublishedOpportunities,
} from "@/components/updates/published";
import { callFunction, errorMessage } from "@/lib/api";
import { ACTION_LABEL, CONFIDENT_MASTERY, decayRisk, formatMinutes } from "@/lib/mastery";
import { toast } from "@/hooks/use-toast";

/**
 * Home — what to do next, and why.
 *
 * Every number on this page is counted from rows the student produced. The
 * prototype's version of this screen showed "95% success rate" and "10K+
 * learners" on a database with no attempts in it; there is nothing like that
 * here. When there is no evidence yet the page says so and offers the one
 * action that would create some.
 *
 * It is ordered as a place to study rather than as a report on a student. The
 * first screen is the one thing to do next and the courses they are partway
 * through; the measurements come after, because a number is useful once you
 * have decided what to work on and a wall of four numbers is not a reason to
 * open anything. The prototype opened on telemetry and buried the lesson.
 *
 * The same honesty rule governs the two sections at the bottom. "From your
 * faculty" and "From industry" read published rows and show the ones that
 * exist. A count there is `rows.length`, never a figure chosen to make the
 * section look inhabited — if no professor has posted anything, the section
 * says that instead of naming a professor.
 *
 * This is the student dashboard, so the three staff roles are sent to their own.
 * The redirect waits for the server to resolve the role; it is navigation only,
 * and `/home` is readable by anybody who types it.
 */

/** How many of each feed the dashboard shows before deferring to /updates. */
const PREVIEW = 2;

/** How many courses get a card before the section defers to /learn. */
const COURSE_PREVIEW = 3;

const Home = () => {
  const { user } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();

  const curriculum = useCurriculum();
  const mastery = useMastery();
  const recommendations = useRecommendations();
  const streak = useStreak();
  const misconceptions = useMisconceptions();
  const announcements = usePublishedAnnouncements();
  const opportunities = usePublishedOpportunities();

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

  /**
   * One row per published course, counted from this student's own mastery rows.
   *
   * `confident` and `started` are counts of concepts, never an average: a course
   * whose concepts have never been attempted has no score to average, and
   * treating those as zeros would draw "not started" as "failed". The card the
   * section links to is the first module that is not finished, so the button
   * goes where the student actually left off rather than back to the top.
   */
  const courses = useMemo(() => {
    return (curriculum.data ?? []).map((course) => {
      const all = course.chapters.flatMap((chapter) => chapter.concepts);
      const confidentIn = (ids: { id: string }[]) =>
        ids.filter((concept) => (mastery.data?.get(concept.id)?.mastery ?? 0) >= CONFIDENT_MASTERY).length;
      const startedIn = (ids: { id: string }[]) =>
        ids.filter((concept) => (mastery.data?.get(concept.id)?.attempts ?? 0) > 0).length;

      const next =
        course.chapters.find(
          (chapter) =>
            chapter.concepts.length > 0 && confidentIn(chapter.concepts) < chapter.concepts.length,
        ) ?? course.chapters[0];

      return {
        course,
        conceptCount: all.length,
        confident: confidentIn(all),
        started: startedIn(all),
        next: next ?? null,
      };
    });
  }, [curriculum.data, mastery.data]);

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

  /* Before the learning queries, because a professor has no business waiting
     for a mastery calculation on their way to their own dashboard. */
  if (roleLoading) return <LoadingState label="Checking your account…" />;
  if (role && role !== "student") return <Navigate to={dashboardFor(role)} replace />;

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
  const notices = announcements.data ?? [];
  const postings = opportunities.data ?? [];

  /* The headline action. The top recommendation if the student has a plan,
     otherwise the placement check — which is the only thing that would create
     one. Never a link to a course picked to fill the space. */
  const lead = items[0] ?? null;
  const leadSlug = lead ? concepts.find((concept) => concept.id === lead.concept_id)?.slug ?? null : null;
  const started = courses.some((entry) => entry.started > 0);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ hero --- */}
      <Card className="surface-card depth-3 relative overflow-hidden">
        {/* Two light sources rather than a flat tint, matching the course
            header on /learn so the two pages read as one product. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60rem_20rem_at_0%_0%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(50rem_20rem_at_100%_100%,hsl(var(--accent)/0.16),transparent_58%)]"
        />
        <div className="relative">
          <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                {stats.measured > 0 ? "Welcome back" : "Welcome"}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {stats.measured > 0 ? `Good to see you, ${displayName}` : `Let’s get started, ${displayName}`}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {!hasCurriculum
                  ? "There is no published material yet, so there is nothing here that could be measured."
                  : stats.measured > 0
                    ? `You have measured evidence on ${stats.measured} of ${stats.total} concepts. Everything below is worked out from those answers.`
                    : "Nothing has been measured yet. The placement check is the quickest way to find where to begin."}
              </p>

              {/* Facts only — each chip is a count of rows, and a chip is absent
                  rather than zero when there is nothing to count. */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {streak.data?.current_streak ? (
                  <Badge variant="outline" className="gap-1.5 border-warning/40 bg-warning/10 text-warning">
                    <METRIC_ICON.streak className="h-3.5 w-3.5" aria-hidden />
                    {streak.data.current_streak} day streak
                  </Badge>
                ) : null}
                {stats.mastered > 0 ? (
                  <Badge variant="outline" className="gap-1.5 border-success/40 bg-success/10 text-success">
                    <METRIC_ICON.mastered className="h-3.5 w-3.5" aria-hidden />
                    {stats.mastered} mastered
                  </Badge>
                ) : null}
                {stats.seconds > 0 ? (
                  <Badge variant="outline" className="gap-1.5">
                    <METRIC_ICON.time className="h-3.5 w-3.5" aria-hidden />
                    {formatMinutes(stats.seconds)} on task
                  </Badge>
                ) : null}
              </div>
            </div>

            {/* The single primary action, sized as such. */}
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
              {lead ? (
                <Button asChild size="lg" className="gradient-primary shadow-primary text-primary-foreground">
                  <Link to={recommendationHref(lead.action, leadSlug)}>
                    {started ? "Continue learning" : "Start learning"}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : hasCurriculum ? (
                <Button asChild size="lg" className="gradient-primary shadow-primary text-primary-foreground">
                  <Link to="/diagnostic">
                    Take the placement check
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
              {hasCurriculum ? (
                <Button variant="outline" size="lg" asChild>
                  <Link to="/learn">Browse the curriculum</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </div>
      </Card>

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

      {/* -------------------------------------------- continue where you were */}
      {lead ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pick up where you left off</h2>
          <Card className="surface-card border-primary/25">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
                    {ACTION_LABEL[lead.action] ?? lead.action}
                  </Badge>
                  {lead.estimated_minutes ? (
                    <span className="text-[11px] text-muted-foreground">{lead.estimated_minutes} min</span>
                  ) : null}
                </div>
                <h3 className="text-base font-semibold leading-snug">{lead.title}</h3>
                {lead.reason ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{lead.reason}</p>
                ) : null}
              </div>
              <Button asChild className="shrink-0">
                <Link to={recommendationHref(lead.action, leadSlug)}>
                  Resume
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* ------------------------------------------------------- your courses */}
      {courses.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <METRIC_ICON.course className="h-4 w-4 text-primary" aria-hidden />
                Your courses
              </h2>
              <p className="text-sm text-muted-foreground">
                The ring counts concepts you have taken to {CONFIDENT_MASTERY}%. The fainter ring behind it
                counts the ones you have attempted at all.
              </p>
            </div>
            {courses.length > COURSE_PREVIEW ? (
              <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1.5">
                <Link to="/learn">
                  All {courses.length}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.slice(0, COURSE_PREVIEW).map(({ course, conceptCount, confident, started: begun, next }) => (
              <CourseProgressCard
                key={course.id}
                href={next ? `/learn/${course.slug}/${next.slug}` : "/learn"}
                slug={course.slug}
                code={course.code}
                subject={course.subject}
                title={course.title}
                moduleCount={course.chapters.length}
                conceptCount={conceptCount}
                confident={confident}
                started={begun}
                nextModule={next?.title ?? null}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------- the rest of it */}
      {items.length > 1 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Also worth doing</h2>
              <p className="text-sm text-muted-foreground">
                Ordered by what your answers show would help most.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {items.length - 1} more
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.slice(1).map((item) => {
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
        </section>
      ) : null}

      {items.length === 0 && hasCurriculum ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<METRIC_ICON.plan className="h-8 w-8" aria-hidden />}
              title="No plan yet"
              description="A plan is built from what you have actually answered — nothing is guessed. Take the placement check, or press “Rebuild my plan” once you have answered a few questions."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm">
                    <Link to="/diagnostic">Take the placement check</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => plan.mutate()}
                    disabled={plan.isPending}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${plan.isPending ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                    {plan.isPending ? "Rebuilding…" : "Rebuild my plan"}
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- slipping */}
      {stats.atRisk > 0 ? (
        <Card className="surface-card border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <METRIC_ICON.warning className="h-4 w-4 text-warning" aria-hidden />
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

      {/* ------------------------------------------------------- the evidence */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Your evidence</h2>
            <p className="text-sm text-muted-foreground">
              Counted from questions you have answered. A dash means nothing has been measured yet, not a
              zero score.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => plan.mutate()}
            disabled={plan.isPending || !hasCurriculum}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${plan.isPending ? "animate-spin" : ""}`} aria-hidden />
            {plan.isPending ? "Rebuilding…" : "Rebuild my plan"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Concepts mastered"
            value={stats.measured > 0 ? `${stats.mastered} / ${stats.total}` : "—"}
            hint={stats.measured > 0 ? "85% or above" : "No attempts recorded yet"}
            icon={<METRIC_ICON.mastered className="h-4 w-4" aria-hidden />}
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
            icon={<METRIC_ICON.measured className="h-4 w-4" aria-hidden />}
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
            icon={<METRIC_ICON.streak className="h-4 w-4" aria-hidden />}
            tone="warning"
          />
          <StatTile
            label="Time on task"
            value={stats.seconds > 0 ? formatMinutes(stats.seconds) : "—"}
            hint={stats.seconds > 0 ? "Recorded from real sessions" : "Nothing logged yet"}
            icon={<METRIC_ICON.time className="h-4 w-4" aria-hidden />}
          />
        </div>
      </section>

      {/* ------------------------------------ what other people have posted */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Megaphone className="h-4 w-4 text-primary" aria-hidden />
                From your faculty
              </h2>
              <p className="text-sm text-muted-foreground">
                Notices your professors have published.
              </p>
            </div>
            {notices.length > PREVIEW ? (
              <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1.5">
                <Link to="/updates">
                  All {notices.length}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          {announcements.isLoading ? (
            <LoadingState label="Loading announcements…" />
          ) : announcements.error ? (
            <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
          ) : notices.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Megaphone className="h-7 w-7" aria-hidden />}
                  title="No announcements"
                  description="Nothing has been posted, or nothing posted has cleared review yet. This space stays empty until a real notice exists."
                />
              </CardContent>
            </Card>
          ) : (
            notices
              .slice(0, PREVIEW)
              .map((row) => <AnnouncementCard key={row.id} row={row} compact />)
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Briefcase className="h-4 w-4 text-accent" aria-hidden />
                From industry
              </h2>
              <p className="text-sm text-muted-foreground">
                Openings that are still open, posted by people working in the field.
              </p>
            </div>
            {postings.length > PREVIEW ? (
              <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1.5">
                <Link to="/updates">
                  All {postings.length}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          {opportunities.isLoading ? (
            <LoadingState label="Loading opportunities…" />
          ) : opportunities.error ? (
            <ErrorState error={opportunities.error} onRetry={() => void opportunities.refetch()} />
          ) : postings.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Briefcase className="h-7 w-7" aria-hidden />}
                  title="No open opportunities"
                  description="Internships, jobs, projects and workshops appear here once an industry account posts one and a reviewer approves it. There are none open right now."
                />
              </CardContent>
            </Card>
          ) : (
            postings
              .slice(0, PREVIEW)
              .map((row) => <OpportunityCard key={row.id} row={row} compact />)
          )}
        </div>
      </section>

      {/* --------------------------------------------------- misconceptions */}
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

      <p className="flex items-start gap-2 pt-2 text-xs leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        Nothing on this page is an estimate. Every count is of rows in the database — your answers, your
        sessions, and material a reviewer has published.
      </p>
    </div>
  );
};

export default Home;
