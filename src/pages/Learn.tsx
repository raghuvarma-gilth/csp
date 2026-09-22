import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCurriculum, useMastery, usePrerequisites } from "@/hooks/useLearning";
import { ConceptCard, PageHeader } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

/**
 * Learn — the curriculum, as published.
 *
 * Only `published` courses, chapters and concepts appear, and that is enforced
 * by RLS rather than by this filter: a draft cannot reach the browser even if
 * the query forgot to exclude it.
 *
 * A concept is shown as locked when a prerequisite is genuinely below 60%
 * mastery. Locking is advisory — the lesson is still readable — because hiding
 * material a student wants to read helps nobody. It exists to say "this will
 * make more sense after that one", with the reason named.
 */

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
      if ((record?.mastery ?? 0) >= 60) continue;
      const name = titleById.get(edge.prerequisite_id);
      if (!name) continue;
      map.set(edge.concept_id, [...(map.get(edge.concept_id) ?? []), name]);
    }
    return map;
  }, [prerequisites.data, mastery.data, titleById]);

  const needle = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      (curriculum.data ?? [])
        .map((course) => ({
          ...course,
          chapters: course.chapters
            .map((chapter) => ({
              ...chapter,
              concepts: needle
                ? chapter.concepts.filter(
                    (concept) =>
                      concept.title.toLowerCase().includes(needle) ||
                      (concept.summary ?? "").toLowerCase().includes(needle),
                  )
                : chapter.concepts,
            }))
            .filter((chapter) => chapter.concepts.length > 0),
        }))
        .filter((course) => course.chapters.length > 0),
    [curriculum.data, needle],
  );

  if (curriculum.isLoading) return <LoadingState label="Loading the curriculum…" />;
  if (curriculum.error) return <ErrorState error={curriculum.error} onRetry={() => void curriculum.refetch()} />;

  const totalConcepts = (curriculum.data ?? [])
    .flatMap((course) => course.chapters)
    .reduce((total, chapter) => total + chapter.concepts.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Curriculum"
        description={
          totalConcepts > 0
            ? `${totalConcepts} published concept${totalConcepts === 1 ? "" : "s"}. Your mastery is shown on each one — an empty bar means you have not been measured on it yet, not that you scored zero.`
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
              placeholder="Search concepts…"
              className="pl-9"
              aria-label="Search concepts"
            />
          </div>

          {filtered.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Search className="h-8 w-8" aria-hidden />}
                  title="No concept matches that"
                  description={`Nothing published contains “${query.trim()}”. Try a shorter phrase, or clear the search to see everything.`}
                />
              </CardContent>
            </Card>
          ) : (
            filtered.map((course) => (
              <section key={course.id} className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold">{course.title}</h2>
                  {course.code ? (
                    <Badge variant="outline" className="text-[10px]">
                      {course.code}
                    </Badge>
                  ) : null}
                  <Badge variant="secondary" className="text-[10px]">
                    {course.subject}
                  </Badge>
                </div>
                {course.description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {course.description}
                  </p>
                ) : null}

                <Accordion
                  type="multiple"
                  defaultValue={needle ? course.chapters.map((chapter) => chapter.id) : [course.chapters[0]?.id]}
                  className="space-y-2"
                >
                  {course.chapters.map((chapter) => {
                    const measured = chapter.concepts.filter(
                      (concept) => (mastery.data?.get(concept.id)?.attempts ?? 0) > 0,
                    ).length;

                    return (
                      <AccordionItem
                        key={chapter.id}
                        value={chapter.id}
                        className="rounded-xl border border-border/70 bg-card/60 px-4"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2 text-left">
                            <span className="truncate text-sm font-semibold">{chapter.title}</span>
                            <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                              {measured}/{chapter.concepts.length} measured
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          {chapter.description ? (
                            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                              {chapter.description}
                            </p>
                          ) : null}
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {chapter.concepts.map((concept) => (
                              <ConceptCard
                                key={concept.id}
                                slug={concept.slug}
                                title={concept.title}
                                summary={concept.summary}
                                estimatedMinutes={concept.estimated_minutes}
                                difficulty={concept.difficulty}
                                record={mastery.data?.get(concept.id)}
                                lockedBy={lockedBy.get(concept.id)}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default Learn;
