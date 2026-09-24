import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Code2,
  GraduationCap,
  Layers,
  Lightbulb,
  List,
  MessageSquare,
  Shapes,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useConcept, useCurriculum, useMastery } from "@/hooks/useLearning";
import { MasteryBar } from "@/components/learning/primitives";
import { Markdown, extractHeadings } from "@/components/learning/Markdown";
import { moduleArt } from "@/components/learning/moduleArt";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { STATUS_LABEL, daysSince, decayRisk } from "@/lib/mastery";
import { cn } from "@/lib/utils";

/**
 * One concept: what it says, what it assumes, and what to do with it.
 *
 * The lesson body is rendered from markdown into React elements — never as raw
 * HTML — because this text comes from whatever a faculty member pasted.
 *
 * It renders in the `lesson` variant, which is the long-form reading style:
 * serif at 17px, a measure capped near 68 characters, real tables, worked
 * examples set apart from the prose, and figures drawn inline. The page used to
 * pass `className="text-[0.95rem]"` and nothing else, so a lesson was rendered
 * in the same cramped sans-serif as a chat bubble — which is the main reason
 * reading one felt like reading a tooltip.
 *
 * The mastery panel shows either a real measurement or "Not started". There is
 * no third state where an untouched concept is drawn as 0%, which is what the
 * prototype did and which made every new account look like it had failed
 * everything.
 */

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Introductory",
  2: "Foundational",
  3: "Intermediate",
  4: "Advanced",
  5: "Challenging",
};

const ConceptPage = () => {
  const { conceptSlug } = useParams<{ conceptSlug: string }>();
  const query = useConcept(conceptSlug);
  const mastery = useMastery();
  const curriculum = useCurriculum();

  const concept = query.data?.concept;

  /** The concepts either side of this one, within the same module. */
  const neighbours = useMemo(() => {
    if (!concept) return { previous: null, next: null, position: 0, total: 0 };
    const chapter = (curriculum.data ?? [])
      .flatMap((course) => course.chapters)
      .find((item) => item.id === concept.chapter_id);
    if (!chapter) return { previous: null, next: null, position: 0, total: 0 };
    const index = chapter.concepts.findIndex((item) => item.id === concept.id);
    if (index < 0) return { previous: null, next: null, position: 0, total: chapter.concepts.length };
    return {
      previous: index > 0 ? chapter.concepts[index - 1] : null,
      next: chapter.concepts[index + 1] ?? null,
      position: index + 1,
      total: chapter.concepts.length,
    };
  }, [concept, curriculum.data]);

  /** Headings in the lesson body, for the contents list in the sidebar. */
  const headings = useMemo(() => extractHeadings(concept?.content ?? ""), [concept?.content]);

  if (query.isLoading) return <LoadingState label="Opening the concept…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !concept) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-8 w-8" aria-hidden />}
        title="Concept not found"
        description="Either the address is wrong, or this concept has not been published yet."
        action={
          <Button asChild size="sm">
            <Link to="/learn">Back to the curriculum</Link>
          </Button>
        }
      />
    );
  }

  const { objectives, prerequisites, problems } = query.data;
  const record = mastery.data?.get(concept.id);
  const measured = (record?.attempts ?? 0) > 0;
  const risk = record ? decayRisk(record.peak_mastery, record.mastery, record.last_practiced_at) : 0;

  const chapter = concept.chapters as {
    slug: string;
    title: string;
    courses: { slug: string; title: string } | null;
  } | null;
  const course = chapter?.courses ?? null;
  const moduleHref = course && chapter ? `/learn/${course.slug}/${chapter.slug}` : "/learn";
  const art = chapter ? moduleArt(chapter.slug) : null;
  const ModuleIcon = art?.icon ?? Layers;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Curriculum
        </Link>
        {course ? (
          <>
            <span aria-hidden>/</span>
            <span className="truncate">{course.title}</span>
          </>
        ) : null}
        {chapter ? (
          <>
            <span aria-hidden>/</span>
            <Link to={moduleHref} className="truncate hover:text-foreground">
              {chapter.title}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <header>
            {chapter ? (
              <Link
                to={moduleHref}
                className={cn(
                  "mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-[11px] font-medium transition-colors hover:border-primary/40",
                  art?.cls.ink,
                )}
              >
                <ModuleIcon className="h-3.5 w-3.5" aria-hidden />
                {chapter.title}
                {neighbours.total > 0 ? (
                  <span className="text-muted-foreground">
                    · {neighbours.position} of {neighbours.total}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">{concept.title}</h1>

            {concept.summary ? (
              <p className="mt-2.5 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground">
                {concept.summary}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Level {concept.difficulty} · {DIFFICULTY_LABEL[concept.difficulty] ?? "Unrated"}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden />
                {concept.estimated_minutes} min read
              </span>
            </div>
          </header>

          {objectives.length > 0 ? (
            <Card className="surface-card border-primary/20 bg-primary/[0.03]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-primary" aria-hidden />
                  After this you should be able to
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {objectives.map((objective) => (
                    <li key={objective.id} className="flex gap-2 text-sm leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      {objective.objective}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="surface-card">
            <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
              {concept.content ? (
                <Markdown content={concept.content} variant="lesson" className="max-w-[68ch]" />
              ) : (
                <EmptyState
                  icon={<Lightbulb className="h-8 w-8" aria-hidden />}
                  title="This concept has no written material yet"
                  description="It was published with a title and objectives but no body text. You can still practise it, ask the tutor about it, or work the coding problems below."
                />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/practice/${concept.slug}`}>
                Practise this concept
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/tutor?concept=${concept.id}`}>
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                Ask the tutor about it
              </Link>
            </Button>
            {concept.visual_key ? (
              <Button asChild variant="outline">
                <Link to={`/visual/${concept.visual_key}`}>
                  <Shapes className="mr-2 h-4 w-4" aria-hidden />
                  See it visually
                </Link>
              </Button>
            ) : null}
          </div>

          {neighbours.previous || neighbours.next ? (
            <>
              <Separator />
              <nav className="grid gap-3 sm:grid-cols-2" aria-label="Other concepts in this module">
                {neighbours.previous ? (
                  <Link
                    to={`/learn/${neighbours.previous.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/40"
                  >
                    <ArrowLeft
                      className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:-translate-x-0.5"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Previous</p>
                      <p className="truncate text-sm font-semibold">{neighbours.previous.title}</p>
                    </div>
                  </Link>
                ) : (
                  <span aria-hidden />
                )}
                {neighbours.next ? (
                  <Link
                    to={`/learn/${neighbours.next.slug}`}
                    className="group flex items-center justify-end gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-right transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next</p>
                      <p className="truncate text-sm font-semibold">{neighbours.next.title}</p>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                ) : (
                  <Link
                    to={moduleHref}
                    className="group flex items-center justify-end gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-right transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last in this module</p>
                      <p className="truncate text-sm font-semibold">Back to {chapter?.title ?? "the module"}</p>
                    </div>
                    <Layers className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  </Link>
                )}
              </nav>
            </>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {headings.length >= 2 ? (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <List className="h-4 w-4" aria-hidden />
                  On this page
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 border-l border-border">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={cn(
                          "-ml-px block border-l border-transparent py-1 text-xs leading-snug text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
                          heading.level >= 3 ? "pl-5" : "pl-3",
                        )}
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your mastery</CardTitle>
              <CardDescription className="text-xs">
                {measured
                  ? `${STATUS_LABEL[record!.status]} · ${record!.correct_attempts}/${record!.attempts} correct`
                  : "Measured only from questions you answer — not from opening the page."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MasteryBar value={record?.mastery ?? 0} unmeasured={!measured} />
              {measured ? (
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd className="tabular-nums">{Math.round(record!.confidence)}%</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Peak</dt>
                    <dd className="tabular-nums">{Math.round(record!.peak_mastery)}%</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Last practised</dt>
                    <dd>
                      {record!.last_practiced_at
                        ? `${daysSince(record!.last_practiced_at)} day${
                            daysSince(record!.last_practiced_at) === 1 ? "" : "s"
                          } ago`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {risk >= 40 ? (
                <p className="rounded-lg bg-warning/10 p-2 text-[11px] leading-relaxed text-warning">
                  You scored higher on this before. A short review now is cheaper than relearning it.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {prerequisites.length > 0 ? (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assumes you know</CardTitle>
                <CardDescription className="text-xs">
                  These are not gates. They are what this explanation takes for granted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {prerequisites.map((prerequisite) => {
                  const prerequisiteRecord = mastery.data?.get(prerequisite.id);
                  const prerequisiteMeasured = (prerequisiteRecord?.attempts ?? 0) > 0;
                  return (
                    <Link
                      key={prerequisite.id}
                      to={`/learn/${prerequisite.slug}`}
                      className="block rounded-lg border border-border/60 p-2.5 transition-colors hover:border-primary/40"
                    >
                      <p className="mb-1.5 text-xs font-medium">{prerequisite.title}</p>
                      <MasteryBar
                        value={prerequisiteRecord?.mastery ?? 0}
                        unmeasured={!prerequisiteMeasured}
                        showLabel={false}
                      />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {problems.length > 0 ? (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code2 className="h-4 w-4" aria-hidden />
                  Coding problems
                </CardTitle>
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

export default ConceptPage;
