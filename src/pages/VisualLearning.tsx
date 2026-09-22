import { lazy, Suspense, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Boxes, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurriculum } from "@/hooks/useLearning";
import { PageHeader } from "@/components/learning/primitives";
import { EmptyState, LoadingState } from "@/components/states";
import { VISUAL_CATALOGUE, VISUAL_GROUPS, visualMeta } from "@/components/visual/catalogue";

/**
 * Visual Learning.
 *
 * What is drawn on these screens is a recording of the algorithm actually
 * running — the frames are produced by executing it over a real input, not by
 * an animation someone drew to look convincing. Change the input and the
 * animation changes, because it was never separate from the code.
 *
 * The player and the trace builders are behind `lazy()`: the gallery is a list
 * of eleven cards, and a student browsing it should not be made to download the
 * visualiser.
 *
 * Concepts are matched to visualisations through `concepts.visual_key`. A
 * concept whose key has no entry in the catalogue simply has no visualiser —
 * it is never linked to a screen that cannot draw it.
 */

const TracePlayer = lazy(() => import("@/components/visual/TracePlayer"));

const GalleryCard = ({
  visualKey,
  concepts,
}: {
  visualKey: string;
  concepts: Array<{ slug: string; title: string }>;
}) => {
  const meta = visualMeta(visualKey)!;

  return (
    <Card className="surface-card h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{meta.title}</h3>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {meta.complexity}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{meta.subtitle}</p>

        {concepts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((concept) => (
              <Link key={concept.slug} to={`/learn/${concept.slug}`}>
                <Badge variant="secondary" className="text-[10px] hover:bg-secondary/80">
                  {concept.title}
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}

        <Button asChild size="sm" className="mt-auto w-full">
          <Link to={`/visual/${visualKey}`}>
            <Play className="mr-2 h-3.5 w-3.5" aria-hidden />
            Watch it run
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

const VisualLearning = () => {
  const { visualKey } = useParams<{ visualKey: string }>();
  const curriculum = useCurriculum();

  /** visual_key → the published concepts that teach it. */
  const conceptsByKey = useMemo(() => {
    const map = new Map<string, Array<{ slug: string; title: string }>>();
    for (const course of curriculum.data ?? []) {
      for (const chapter of course.chapters) {
        for (const concept of chapter.concepts) {
          if (!concept.visual_key) continue;
          const existing = map.get(concept.visual_key) ?? [];
          existing.push({ slug: concept.slug, title: concept.title });
          map.set(concept.visual_key, existing);
        }
      }
    }
    return map;
  }, [curriculum.data]);

  /* ----------------------------------------------------------------- player */
  if (visualKey) {
    const meta = visualMeta(visualKey);

    if (!meta) {
      return (
        <div className="space-y-5">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/visual">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              All visualisations
            </Link>
          </Button>
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<Boxes className="h-8 w-8" aria-hidden />}
                title="No visualisation for that key"
                description={`Nothing is built for “${visualKey}”. The concept it belongs to still has its written explanation and its practice questions.`}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/visual">See what is available</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      );
    }

    const related = conceptsByKey.get(visualKey) ?? [];

    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/visual">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            All visualisations
          </Link>
        </Button>

        <PageHeader
          eyebrow="Visual learning"
          title={meta.title}
          description={meta.subtitle}
          actions={
            related.length > 0 ? (
              <Button asChild variant="outline">
                <Link to={`/learn/${related[0].slug}`}>
                  <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                  Read the lesson
                </Link>
              </Button>
            ) : undefined
          }
        />

        <Suspense fallback={<LoadingState label="Loading the visualiser…" />}>
          <TracePlayer visualKey={visualKey} />
        </Suspense>

        {related.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Also used in:</span>
            {related.slice(1).map((concept) => (
              <Link key={concept.slug} to={`/learn/${concept.slug}`}>
                <Badge variant="outline" className="text-[10px] hover:border-primary/50">
                  {concept.title}
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------------------------------------------------------------- gallery */
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visual learning"
        title="Watch the algorithm, not a cartoon of it"
        description="Every frame here is a step the algorithm really took on a real input. Step through it, scrub backwards, slow it down — the pointers move where the code moves them."
      />

      {VISUAL_GROUPS.map((group) => {
        const entries = VISUAL_CATALOGUE.filter((entry) => entry.group === group);
        if (entries.length === 0) return null;

        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <GalleryCard
                  key={entry.key}
                  visualKey={entry.key}
                  concepts={conceptsByKey.get(entry.key) ?? []}
                />
              ))}
            </div>
          </section>
        );
      })}

      {curriculum.data && conceptsByKey.size === 0 ? (
        <p className="text-xs text-muted-foreground">
          None of the published concepts link to a visualisation yet, so these are shown on their own.
          Once faculty set a concept's visual key, it will appear on that lesson too.
        </p>
      ) : null}
    </div>
  );
};

export default VisualLearning;
