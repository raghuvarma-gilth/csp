import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, GraduationCap, Layers, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurriculum, useMastery, usePrerequisites } from "@/hooks/useLearning";
import { ConceptCard, ModuleCard, PageHeader, ProgressRing } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { CONFIDENT_MASTERY } from "@/lib/mastery";

/**
 * Learn — the curriculum, as published.
 *
 * Only `published` courses, modules and concepts appear, and that is enforced
 * by RLS rather than by this filter: a draft cannot reach the browser even if
 * the query forgot to exclude it.
 *
 * Structurally this page used to be one accordion per course with every
 * concept card dumped inside, which meant a course of any real size opened as
 * a wall of thirty identical tiles and there was nowhere to *be* inside a
 * course — no page that answered "what is this module about and how far in am
 * I". So a course now shows its modules, each module is its own page, and the
 * concept cards live there. Search still cuts straight through to concepts,
 * because when you are looking for `sliding-window` you do not want to
 * navigate a hierarchy to reach it.
 *
 * The mastery threshold below is a count, not an average: "4 of 9 concepts at
 * 60%+" is a fact about rows that exist. Averaging mastery across a module
 * would have to score the untouched concepts as zero, which reads as failure
 * rather than as not-yet-attempted.
 */

/* Shared with Home, which draws rings over the same courses. See
   CONFIDENT_MASTERY in lib/mastery.ts for why it sits below the mastery bar. */
const CONFIDENT = CONFIDENT_MASTERY;

const Learn = () => {
  const [query, setQuery] = useState("");
  const curriculum = useCurriculum();
  const mastery = useMastery();
  const prerequisites = usePrerequisites();

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

  const needle = query.trim().toLowerCase();

  /** Flat concept hits, each tagged with where it lives, for the search view. */
  const matches = useMemo(() => {
    if (!needle) return [];
    return (curriculum.data ?? []).flatMap((course) =>
      course.chapters.flatMap((chapter) =>
        chapter.concepts
          .filter(
            (concept) =>
              concept.title.toLowerCase().includes(needle) ||
              (concept.summary ?? "").toLowerCase().includes(needle) ||
              chapter.title.toLowerCase().includes(needle),
          )
          .map((concept) => ({ concept, chapter, course })),
      ),
    );
  }, [curriculum.data, needle]);

  if (curriculum.isLoading) return <LoadingState label="Loading the curriculum…" />;
  if (curriculum.error) return <ErrorState error={curriculum.error} onRetry={() => void curriculum.refetch()} />;

  const courses = curriculum.data ?? [];
  const totalConcepts = courses.flatMap((course) => course.chapters).reduce((sum, c) => sum + c.concepts.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Curriculum"
        description={
          totalConcepts > 0
            ? "Work through a course module by module. Each concept shows your own mastery — an empty bar means you have not been measured on it yet, not that you scored zero."
            : undefined
        }
      />

      {totalConcepts === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<BookOpen className="h-8 w-8" aria-hidden />}
              title="Nothing published yet"
              description="Courses appear here once faculty move them through review to published. Drafts are deliberately invisible to students — you would be reading material nobody has checked."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search concepts and modules…"
              className="pl-9"
              aria-label="Search concepts and modules"
            />
          </div>

          {needle ? (
            matches.length === 0 ? (
              <Card className="surface-card">
                <CardContent className="p-0">
                  <EmptyState
                    icon={<Search className="h-8 w-8" aria-hidden />}
                    title="No concept matches that"
                    description={`Nothing published contains “${query.trim()}”. Try a shorter phrase, or clear the search to browse the modules.`}
                    action={
                      <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                        Clear search
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <section className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {matches.length} concept{matches.length === 1 ? "" : "s"} match “{query.trim()}”.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {matches.map(({ concept, chapter, course }) => (
                    <div key={concept.id} className="space-y-1.5">
                      <Link
                        to={`/learn/${course.slug}/${chapter.slug}`}
                        className="inline-block text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-primary"
                      >
                        {chapter.title}
                      </Link>
                      <ConceptCard
                        slug={concept.slug}
                        title={concept.title}
                        summary={concept.summary}
                        estimatedMinutes={concept.estimated_minutes}
                        difficulty={concept.difficulty}
                        record={mastery.data?.get(concept.id)}
                        lockedBy={lockedBy.get(concept.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )
          ) : (
            courses.map((course) => {
              const allConcepts = course.chapters.flatMap((chapter) => chapter.concepts);
              const minutes = allConcepts.reduce((sum, concept) => sum + concept.estimated_minutes, 0);
              const confident = allConcepts.filter(
                (concept) => (mastery.data?.get(concept.id)?.mastery ?? 0) >= CONFIDENT,
              ).length;
              const started = allConcepts.filter(
                (concept) => (mastery.data?.get(concept.id)?.attempts ?? 0) > 0,
              ).length;

              return (
                <section key={course.id} className="space-y-4">
                  <Card className="surface-card depth-3 relative overflow-hidden">
                    {/* Two light sources rather than a flat wash — the card
                        should read as lit, not tinted. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-[radial-gradient(60rem_20rem_at_0%_0%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(50rem_20rem_at_100%_100%,hsl(var(--accent)/0.16),transparent_58%)]"
                    />
                    <div className="relative">
                      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-card text-primary depth-2">
                              <GraduationCap className="h-4 w-4" aria-hidden />
                            </span>
                            {course.code ? (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {course.code}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary" className="text-[10px]">
                              {course.subject}
                            </Badge>
                          </div>
                          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{course.title}</h2>
                          {course.description ? (
                            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                              {course.description}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5" aria-hidden />
                              {course.chapters.length} module{course.chapters.length === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5" aria-hidden />
                              {allConcepts.length} concept{allConcepts.length === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {Math.round(minutes / 60)} h of reading
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
                          <ProgressRing
                            value={allConcepts.length ? confident / allConcepts.length : 0}
                            secondary={allConcepts.length ? started / allConcepts.length : 0}
                            size={72}
                            label={
                              <span className="text-xs">
                                {confident}/{allConcepts.length}
                              </span>
                            }
                          />
                          <p className="max-w-[9rem] text-[11px] leading-relaxed text-muted-foreground sm:text-right">
                            {started === 0
                              ? "Not started yet"
                              : `${confident} concept${confident === 1 ? "" : "s"} at ${CONFIDENT}%+, ${started} attempted`}
                          </p>
                        </div>
                      </CardContent>
                    </div>
                  </Card>

                  {course.chapters.length === 0 ? (
                    <Card className="surface-card">
                      <CardContent className="p-0">
                        <EmptyState
                          icon={<Layers className="h-7 w-7" aria-hidden />}
                          title="No modules published in this course"
                          description="The course itself is published but none of its modules are yet, so there is nothing to open."
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {course.chapters.map((chapter, index) => (
                        <ModuleCard
                          key={chapter.id}
                          href={`/learn/${course.slug}/${chapter.slug}`}
                          slug={chapter.slug}
                          position={index + 1}
                          title={chapter.title}
                          description={chapter.description}
                          conceptCount={chapter.concepts.length}
                          confident={
                            chapter.concepts.filter(
                              (concept) => (mastery.data?.get(concept.id)?.mastery ?? 0) >= CONFIDENT,
                            ).length
                          }
                          started={
                            chapter.concepts.filter(
                              (concept) => (mastery.data?.get(concept.id)?.attempts ?? 0) > 0,
                            ).length
                          }
                          minutes={chapter.concepts.reduce((sum, concept) => sum + concept.estimated_minutes, 0)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}

          {!needle ? (
            <p className="flex items-start gap-2 pt-2 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              The ring on each module counts concepts you have taken to {CONFIDENT}% mastery. The fainter ring behind
              it counts the ones you have attempted at all.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Learn;
