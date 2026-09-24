import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Code2,
  Layers,
  Lock,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurriculum, useMastery, useModule, usePrerequisites } from "@/hooks/useLearning";
import { MasteryBar, ProgressRing } from "@/components/learning/primitives";
import { ModuleCover, moduleArt } from "@/components/learning/moduleArt";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * One module of a course.
 *
 * This page exists because a course previously had no inside. The curriculum
 * was a single accordion, so "where am I in Stacks" had no address you could
 * open, link to, or come back to — the only unit of navigation was the whole
 * course or one concept. A module is the unit students actually work in, so it
 * gets a page: what it covers, what you will be able to do afterwards, the
 * concepts in teaching order, and how far through you are.
 *
 * Addressed as /learn/:courseSlug/:moduleSlug. Chapter slugs are only unique
 * within a course, so the course slug is part of the address rather than
 * decoration.
 *
 * Progress here is counted, never averaged. `confident` is the number of
 * concepts measured at 60% or better; `started` is the number attempted at
 * all. Averaging mastery over the module would require scoring untouched
 * concepts as zero, which makes an untouched module look like a failed one.
 */

const CONFIDENT = 60;

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Introductory",
  2: "Foundational",
  3: "Intermediate",
  4: "Advanced",
  5: "Challenging",
};

const ModulePage = () => {
  const { courseSlug, moduleSlug } = useParams<{ courseSlug: string; moduleSlug: string }>();
  const query = useModule(courseSlug, moduleSlug);
  const mastery = useMastery();
  const prerequisites = usePrerequisites();
  const curriculum = useCurriculum();

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of curriculum.data ?? []) {
      for (const chapter of course.chapters) {
        for (const concept of chapter.concepts) map.set(concept.id, concept.title);
      }
    }
    return map;
  }, [curriculum.data]);

  const lockedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of prerequisites.data ?? []) {
      const record = mastery.data?.get(edge.prerequisite_id);
      if ((record?.mastery ?? 0) >= CONFIDENT) continue;
      const name = titleById.get(edge.prerequisite_id);
      if (!name) continue;
      map.set(edge.concept_id, [...(map.get(edge.concept_id) ?? []), name]);
    }
    return map;
  }, [prerequisites.data, mastery.data, titleById]);

  if (query.isLoading) return <LoadingState label="Opening the module…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <EmptyState
        icon={<Layers className="h-8 w-8" aria-hidden />}
        title="Module not found"
        description="Either the address is wrong, or this module has not been published yet."
        action={
          <Button asChild size="sm">
            <Link to="/learn">Back to the curriculum</Link>
          </Button>
        }
      />
    );
  }

  const { course, module, concepts, objectives, problems, siblings } = query.data;
  const art = moduleArt(module.slug);
  const Icon = art.icon;

  const minutes = concepts.reduce((sum, concept) => sum + concept.estimated_minutes, 0);
  const confident = concepts.filter((concept) => (mastery.data?.get(concept.id)?.mastery ?? 0) >= CONFIDENT).length;
  const started = concepts.filter((concept) => (mastery.data?.get(concept.id)?.attempts ?? 0) > 0).length;

  /** Where the main button goes: the first thing not yet at 60%, else the start. */
  const target = concepts.find((concept) => (mastery.data?.get(concept.id)?.mastery ?? 0) < CONFIDENT) ?? concepts[0];

  /** Objectives across the module, deduplicated — two concepts can share one. */
  const outcomes = Array.from(new Set(objectives.map((objective) => objective.objective)));

  const problemsByConcept = new Map<string, typeof problems>();
  for (const problem of problems) {
    problemsByConcept.set(problem.concept_id, [...(problemsByConcept.get(problem.concept_id) ?? []), problem]);
  }

  const index = siblings.findIndex((sibling) => sibling.id === module.id);
  const previousModule = index > 0 ? siblings[index - 1] : null;
  const nextModule = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Curriculum
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate">{course.title}</span>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-foreground">{module.title}</span>
      </nav>

      <Card className="surface-card overflow-hidden">
        <ModuleCover slug={module.slug} className="h-24 border-b border-border/60 sm:h-28" />
        <CardContent className="p-5 sm:p-6">
          <div className="-mt-12 mb-4 flex items-start justify-between gap-4">
            <span
              className={cn(
                "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border/60 bg-card shadow-sm",
                art.cls.ink,
              )}
            >
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div className="mt-2 flex items-center gap-3">
              <ProgressRing
                value={concepts.length ? confident / concepts.length : 0}
                secondary={concepts.length ? started / concepts.length : 0}
                size={64}
                label={
                  <span className="text-xs">
                    {confident}/{concepts.length}
                  </span>
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                {index >= 0 ? `Module ${index + 1} of ${siblings.length}` : "Module"} · {course.title}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{module.title}</h1>
              {module.description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{module.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  {concepts.length} concept{concepts.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {minutes} min of reading
                </span>
                {problems.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5" aria-hidden />
                    {problems.length} coding problem{problems.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </div>

            {target ? (
              <div className="shrink-0">
                <Button asChild size="lg">
                  <Link to={`/learn/${target.slug}`}>
                    {started === 0 ? "Start the module" : confident === concepts.length ? "Review" : "Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <p className="mt-1.5 max-w-[16rem] text-[11px] leading-relaxed text-muted-foreground">
                  {started === 0 ? "Opens " : "Picks up at "}
                  <span className="text-foreground">{target.title}</span>
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          {concepts.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<BookOpen className="h-8 w-8" aria-hidden />}
                  title="No concepts published in this module"
                  description="The module exists and is published, but none of its concepts have been approved and published yet. There is nothing to read here until they are."
                />
              </CardContent>
            </Card>
          ) : (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                In this module
              </h2>
              <ol className="space-y-2.5">
                {concepts.map((concept, position) => {
                  const record = mastery.data?.get(concept.id);
                  const measured = (record?.attempts ?? 0) > 0;
                  const blockers = lockedBy.get(concept.id);
                  const conceptProblems = problemsByConcept.get(concept.id) ?? [];

                  return (
                    <li key={concept.id}>
                      <Link
                        to={`/learn/${concept.slug}`}
                        className="group flex gap-4 rounded-xl border border-border/70 bg-card/60 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                            (record?.mastery ?? 0) >= CONFIDENT
                              ? "border-success/40 bg-success/10 text-success"
                              : measured
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {position + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="text-[0.95rem] font-semibold leading-snug">{concept.title}</h3>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {DIFFICULTY_LABEL[concept.difficulty] ?? `Level ${concept.difficulty}`}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {concept.estimated_minutes} min
                            </span>
                          </div>

                          {concept.summary ? (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{concept.summary}</p>
                          ) : null}

                          {blockers && blockers.length > 0 ? (
                            <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
                              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                              Easier after {blockers.join(", ")} — you can still read it now.
                            </p>
                          ) : null}

                          <div className="mt-2.5 flex items-center gap-3">
                            <MasteryBar
                              value={record?.mastery ?? 0}
                              unmeasured={!measured}
                              showLabel={false}
                              className="max-w-[12rem]"
                            />
                            <span className="text-[11px] text-muted-foreground">
                              {measured ? `${Math.round(record!.mastery)}% mastery` : "Not measured yet"}
                            </span>
                            {conceptProblems.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Code2 className="h-3 w-3" aria-hidden />
                                {conceptProblems.length}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ArrowRight
                          className="mt-1 h-4 w-4 shrink-0 self-start text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {previousModule || nextModule ? (
            <nav className="grid gap-3 sm:grid-cols-2" aria-label="Other modules">
              {previousModule ? (
                <Link
                  to={`/learn/${course.slug}/${previousModule.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/40"
                >
                  <ArrowLeft
                    className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Previous module</p>
                    <p className="truncate text-sm font-semibold">{previousModule.title}</p>
                  </div>
                </Link>
              ) : (
                <span aria-hidden />
              )}
              {nextModule ? (
                <Link
                  to={`/learn/${course.slug}/${nextModule.slug}`}
                  className="group flex items-center justify-end gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-right transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next module</p>
                    <p className="truncate text-sm font-semibold">{nextModule.title}</p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {outcomes.length > 0 ? (
            <Card className="surface-card border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-primary" aria-hidden />
                  By the end of this module
                </CardTitle>
                <CardDescription className="text-xs">
                  Gathered from the objectives on each concept, not written separately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {outcomes.map((outcome) => (
                    <li key={outcome} className="flex gap-2 text-xs leading-relaxed">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your progress here</CardTitle>
              <CardDescription className="text-xs">
                Counted from questions you have answered, not from pages you have opened.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">At {CONFIDENT}%+ mastery</dt>
                  <dd className="tabular-nums font-medium">
                    {confident} of {concepts.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Attempted</dt>
                  <dd className="tabular-nums font-medium">
                    {started} of {concepts.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Not started</dt>
                  <dd className="tabular-nums font-medium">{concepts.length - started}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {problems.length > 0 ? (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code2 className="h-4 w-4" aria-hidden />
                  Coding problems
                </CardTitle>
                <CardDescription className="text-xs">
                  {problems.length} problem{problems.length === 1 ? "" : "s"} attached to this module.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {problems.map((problem) => (
                  <Link
                    key={problem.id}
                    to={`/code/${problem.slug}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-xs transition-colors hover:border-primary/40"
                  >
                    <span className="truncate font-medium">{problem.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      L{problem.difficulty}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default ModulePage;
