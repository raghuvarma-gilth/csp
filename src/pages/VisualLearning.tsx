import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronUp,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCurriculum } from "@/hooks/useLearning";
import { PageHeader } from "@/components/learning/primitives";
import { EmptyState, LoadingState } from "@/components/states";
import {
  type VisualMeta,
  VISUAL_CATALOGUE,
  visualMeta,
} from "@/components/visual/catalogue";
import {
  MODULES,
  SECTIONS,
  type ModuleDef,
} from "@/components/visual/lab/registry";
import type { OpDef } from "@/components/visual/lab/types";

/**
 * Visual Learning.
 *
 * What is drawn on these screens is a recording of the algorithm actually
 * running — the frames are produced by executing it over a real input, not by
 * an animation someone drew to look convincing. Change the input and the
 * animation changes, because it was never separate from the code.
 *
 * The lab is behind `lazy()`: the gallery is a list of cards, and a student
 * browsing it should not be made to download a 3-D renderer.
 *
 * Concepts are matched to visualisations through `concepts.visual_key`. A
 * concept whose key has no entry in the catalogue simply has no visualiser —
 * it is never linked to a screen that cannot draw it.
 */

const DsaLab = lazy(() => import("@/components/visual/lab/DsaLab"));

/* ========================================================================== */
/* Operation card                                                              */
/* ========================================================================== */

/** A single operation within a module — links to its visualisation. */
const OpCard = ({
  moduleKey,
  opKey,
  op,
  catalogueEntry,
  concepts,
}: {
  moduleKey: string;
  opKey: string;
  op: OpDef;
  catalogueEntry?: VisualMeta;
  concepts: Array<{ slug: string; title: string }>;
}) => {
  /* Use catalogue entry for a deep link if available, otherwise link to the lab. */
  const linkTo = catalogueEntry
    ? `/visual/${catalogueEntry.key}`
    : `/visual/lab?module=${moduleKey}&op=${opKey}`;

  return (
    <Card className="surface-card h-full transition-all duration-200 hover:shadow-md hover:border-primary/30">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-snug">{op.label}</h4>
          {catalogueEntry && (
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              {catalogueEntry.complexity}
            </Badge>
          )}
        </div>
        {catalogueEntry && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {catalogueEntry.subtitle}
          </p>
        )}
        {/* Complexity info from the operation's own data. */}
        {!catalogueEntry && Object.keys(op.complexity).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(op.complexity).map(([label, value]) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}: {value}
              </Badge>
            ))}
          </div>
        )}

        {concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((concept) => (
              <Link key={concept.slug} to={`/learn/${concept.slug}`}>
                <Badge variant="secondary" className="text-[10px] hover:bg-secondary/80">
                  {concept.title}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        <Button asChild size="sm" className="mt-auto w-full">
          <Link to={linkTo}>
            <Play className="mr-2 h-3.5 w-3.5" aria-hidden />
            Watch it run
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

/* ========================================================================== */
/* Collapsible module section                                                  */
/* ========================================================================== */

/**
 * A single module (e.g. "▦ Array", "🌲 Binary Tree") that can be expanded or
 * collapsed. When open it reveals the operation cards for that module.
 */
const ModuleSection = ({
  moduleKey,
  module,
  conceptsByKey,
  catalogueByModuleOp,
  defaultOpen,
}: {
  moduleKey: string;
  module: ModuleDef;
  conceptsByKey: Map<string, Array<{ slug: string; title: string }>>;
  catalogueByModuleOp: Map<string, VisualMeta>;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const opEntries = Object.entries(module.ops);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="group flex w-full items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-card/90"
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 text-lg">
              {module.icon}
            </span>
            <div>
              <span className="text-sm font-semibold">{module.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {opEntries.length} operation{opEntries.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-muted/50 transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden />
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3">
          {opEntries.map(([opKey, op]) => {
            const catalogueEntry = catalogueByModuleOp.get(`${moduleKey}:${opKey}`);
            return (
              <OpCard
                key={opKey}
                moduleKey={moduleKey}
                opKey={opKey}
                op={op}
                catalogueEntry={catalogueEntry}
                concepts={catalogueEntry ? (conceptsByKey.get(catalogueEntry.key) ?? []) : []}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ========================================================================== */
/* Main page                                                                   */
/* ========================================================================== */

const VisualLearning = () => {
  const { visualKey } = useParams<{ visualKey: string }>();
  const curriculum = useCurriculum();
  const [search, setSearch] = useState("");

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

  /** Quick lookup: "moduleKey:opKey" → catalogue entry. */
  const catalogueByModuleOp = useMemo(() => {
    const map = new Map<string, VisualMeta>();
    for (const entry of VISUAL_CATALOGUE) {
      map.set(`${entry.module}:${entry.op}`, entry);
    }
    return map;
  }, []);

  /** Filter modules based on the search query. */
  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return SECTIONS.map((section) => {
      const modules = section.keys
        .map((key) => ({ key, module: MODULES[key] }))
        .filter(({ module }) => !!module)
        .map(({ key, module }) => {
          if (!query) return { key, module, ops: Object.entries(module.ops) };

          /* Match against the module label, icon, or any op label / catalogue subtitle. */
          const moduleMatches =
            module.label.toLowerCase().includes(query) ||
            module.icon.includes(query);

          if (moduleMatches) {
            return { key, module, ops: Object.entries(module.ops) };
          }

          /* Otherwise filter individual operations. */
          const matchedOps = Object.entries(module.ops).filter(([opKey, op]) => {
            const cat = catalogueByModuleOp.get(`${key}:${opKey}`);
            return (
              op.label.toLowerCase().includes(query) ||
              (cat?.title.toLowerCase().includes(query)) ||
              (cat?.subtitle.toLowerCase().includes(query)) ||
              (cat?.complexity.toLowerCase().includes(query))
            );
          });

          return matchedOps.length > 0
            ? { key, module, ops: matchedOps }
            : null;
        })
        .filter(Boolean) as Array<{
          key: string;
          module: ModuleDef;
          ops: [string, OpDef][];
        }>;

      return { label: section.label, modules };
    }).filter((section) => section.modules.length > 0);
  }, [search, catalogueByModuleOp]);

  const totalModules = filteredSections.reduce((sum, s) => sum + s.modules.length, 0);

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
                description={`Nothing is built for "${visualKey}". The concept it belongs to still has its written explanation and its practice questions.`}
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

        {/*
          The module picker is hidden here: the student arrived from a lesson
          about one specific thing, and a sidebar of twenty-two other structures
          is noise at that moment. Everything else stays live — the input box,
          the parameters, stepping, scrubbing — and the link below opens the
          same component with the picker on.
        */}
        <Suspense fallback={<LoadingState label="Loading the visualiser…" />}>
          <DsaLab
            moduleKey={meta.module}
            opKey={meta.op}
            values={meta.values}
            params={meta.params}
            showModulePicker={false}
          />
        </Suspense>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <Link to="/visual/lab" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Open this in the full lab
          </Link>
          {related.length > 1 ? (
            <>
              <span>Also used in:</span>
              {related.slice(1).map((concept) => (
                <Link key={concept.slug} to={`/learn/${concept.slug}`}>
                  <Badge variant="outline" className="text-[10px] hover:border-primary/50">
                    {concept.title}
                  </Badge>
                </Link>
              ))}
            </>
          ) : null}
        </div>
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

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="visual-search"
          type="search"
          placeholder="Search topics — e.g. binary search, sorting, linked list…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-10"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {totalModules} topic{totalModules === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* No results */}
      {filteredSections.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<Search className="h-8 w-8" aria-hidden />}
              title="No topics match your search"
              description={`Nothing matches "${search}". Try a different keyword like "array", "tree", "sort", or "graph".`}
              action={
                <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        /* Sections: "Data Structures" and "Patterns & Algorithms" */
        filteredSections.map((section) => (
          <section key={section.label} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </h2>
            <div className="space-y-2">
              {section.modules.map(({ key, module }, index) => (
                <ModuleSection
                  key={key}
                  moduleKey={key}
                  module={module}
                  conceptsByKey={conceptsByKey}
                  catalogueByModuleOp={catalogueByModuleOp}
                  /* Open the first module by default, or all when searching. */
                  defaultOpen={!!search || index === 0}
                />
              ))}
            </div>
          </section>
        ))
      )}

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
