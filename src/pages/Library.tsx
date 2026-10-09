import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  Code2,
  Library as LibraryIcon,
  Link2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ROLE_NAME, type AppRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Markdown } from "@/components/learning/Markdown";
import { RESEARCH_TYPE_LABEL, researchTypeLabel } from "@/components/workspace/pipeline";
import { cn } from "@/lib/utils";

/**
 * What faculty, researchers and industry professionals have published, read by
 * students.
 *
 * This is the other half of the faculty and industry registration forms:
 * registering at `/register/faculty` or `/register/industry` is worth nothing
 * unless the work those people write actually arrives in front of a student. It
 * arrives here.
 *
 * Everything on this page has passed `draft → submitted → approved → published`,
 * and the approval was recorded by somebody other than the author — a CHECK
 * constraint on `research_content` refuses a row whose reviewer is its author.
 * Nothing else is reachable: the page reads `published_contributions()`, a
 * SECURITY DEFINER function that takes no arguments and filters on
 * `status = 'published'`, so there is no parameter a caller could widen. The
 * table's own SELECT policy limits students to published rows independently, so
 * the two agree even if this file is wrong.
 *
 * The function exists at all because of an RLS gap rather than convenience: a
 * student cannot read other people's `profiles` rows and cannot read
 * `user_roles` at all, so "written by Professor X" is not something the browser
 * is able to assemble. The join happens server-side or not at all.
 */

type Contribution =
  Database["public"]["Functions"]["published_contributions"]["Returns"][number];

const isHttp = (value: string): boolean => /^https?:\/\//i.test(value.trim());

interface Citation {
  title: string;
  url: string | null;
}

/**
 * Citations are free-form JSON — a contributor typed them into a textarea — so
 * nothing about the shape is guaranteed. Entries that make no sense are dropped
 * rather than rendered as "[object Object]", and only http(s) survives as a
 * link, so a pasted `javascript:` URL cannot become a clickable one.
 */
const readCitations = (raw: unknown): Citation[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap<Citation>((entry) => {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (!text) return [];
      return [{ title: text, url: isHttp(text) ? text : null }];
    }

    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;

    const title = [record.title, record.name, record.source, record.url].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    if (!title) return [];

    const url = typeof record.url === "string" && isHttp(record.url) ? record.url.trim() : null;
    return [{ title: title.trim(), url }];
  });
};

/**
 * A plain-text opening line for a collapsed card.
 *
 * Deliberately crude: it drops what reads badly on one line — code fences,
 * figures, tables, callout markers — and keeps the first real sentences. The
 * full body is one click away, so a rough excerpt costs nothing, whereas
 * rendering two hundred markdown documents to produce a neat one costs plenty.
 */
const excerpt = (content: string, limit = 260): string => {
  const flat = (content ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^:::.*$/gm, " ")
    .replace(/^\s*\|.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+]+/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date unknown"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** Role colours match the staff badges in Admin, so one person reads the same everywhere. */
const ROLE_BADGE: Partial<Record<AppRole, string>> = {
  faculty: "border-primary/40 bg-primary/10 text-primary",
  research_expert: "border-info/40 bg-info/10 text-info",
  industry_expert: "border-accent/40 bg-accent/10 text-accent",
  admin: "border-warning/40 bg-warning/10 text-warning",
};

const Library = () => {
  const [type, setType] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());

  const list = useQuery({
    queryKey: ["published-contributions"],
    queryFn: async (): Promise<Contribution[]> => {
      const { data, error } = await supabase.rpc("published_contributions");
      // Thrown as-is: a PostgrestError carries the code ErrorState uses to tell
      // "the migration is not applied" apart from "try again in a moment".
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Memoised rather than `list.data ?? []` inline: the fallback would be a new
     array on every render, so both memos below would recompute forever. */
  const rows = useMemo(() => list.data ?? [], [list.data]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.content_type, (map.get(row.content_type) ?? 0) + 1);
    return map;
  }, [rows]);

  /* Chips are built from what is actually published, in the canonical order,
     with anything the database grew later appended. A chip reading "Datasets 0"
     would be a filter that can only ever empty the page. */
  const types = useMemo(() => {
    const known = Object.keys(RESEARCH_TYPE_LABEL).filter((key) => counts.has(key));
    const extra = [...counts.keys()].filter((key) => !(key in RESEARCH_TYPE_LABEL)).sort();
    return [...known, ...extra];
  }, [counts]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return rows.filter((row) => {
      if (type && row.content_type !== type) return false;
      if (!needle) return true;
      return [row.title, row.author_name, row.concept_title, row.content].some((field) =>
        field?.toLowerCase().includes(needle),
      );
    });
  }, [rows, type, term]);

  const filtered = Boolean(type) || term.trim().length > 0;

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearFilters = () => {
    setType(null);
    setTerm("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contributions"
        title="From faculty and industry"
        description="Case studies, research notes and worked examples written by professors, researchers and industry professionals — alongside the course material, not instead of it."
      />

      <Card className="surface-card border-primary/20">
        <CardContent className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Every piece here was reviewed and approved by someone other than the person who wrote
            it before it reached this page. Drafts and submissions are not visible to you, and an
            author cannot sign off their own work.
          </span>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <LoadingState label="Loading published contributions…" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<LibraryIcon className="h-8 w-8" aria-hidden />}
              title="Nothing has been published yet"
              description="Faculty and industry contributors write here, a reviewer approves it, and it appears on this page. Until something clears that review there is genuinely nothing to show — so this page shows nothing rather than filling itself with examples."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={type === null ? "default" : "outline"}
                onClick={() => setType(null)}
              >
                Everything
                <span className="ml-1.5 tabular-nums opacity-70">{rows.length}</span>
              </Button>
              {types.map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={type === key ? "default" : "outline"}
                  onClick={() => setType(key)}
                >
                  {researchTypeLabel(key)}
                  <span className="ml-1.5 tabular-nums opacity-70">{counts.get(key) ?? 0}</span>
                </Button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search title, author or text"
                aria-label="Search contributions"
                className="pl-9"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Search className="h-8 w-8" aria-hidden />}
                  title="Nothing matches that"
                  description="No published contribution matches the filter you have set. Clear it to see everything again."
                  action={
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {filtered ? (
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {rows.length} published{" "}
                  {rows.length === 1 ? "contribution" : "contributions"}.
                </p>
              ) : null}

              <div className="space-y-3">
                {visible.map((row) => {
                  const open = expanded.has(row.id);
                  const bodyId = `contribution-body-${row.id}`;
                  const authorName = row.author_name?.trim() || null;
                  const roleLabel = row.author_role ? ROLE_NAME[row.author_role] : null;
                  const citations = readCitations(row.citations);
                  const preview = excerpt(row.content);

                  return (
                    <Card key={row.id} className="surface-card">
                      <CardContent className="space-y-3 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {researchTypeLabel(row.content_type)}
                          </Badge>
                          {row.code_language ? (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Code2 className="h-3 w-3" aria-hidden />
                              {row.code_language}
                            </Badge>
                          ) : null}
                          {roleLabel ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                row.author_role ? ROLE_BADGE[row.author_role] : undefined,
                              )}
                            >
                              {roleLabel}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <h2 className="text-base font-semibold leading-snug">{row.title}</h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {authorName ? <span className="font-medium">{authorName}</span> : null}
                            {authorName ? " · " : null}
                            updated {formatDate(row.updated_at)}
                          </p>
                        </div>

                        {row.concept_slug ? (
                          <Link
                            to={`/learn/${row.concept_slug}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                          >
                            {row.concept_title ?? "Related concept"}
                            <ArrowRight className="h-3 w-3" aria-hidden />
                          </Link>
                        ) : null}

                        {open ? (
                          <div id={bodyId}>
                            <Markdown content={row.content} variant="lesson" />
                          </div>
                        ) : preview ? (
                          <p id={bodyId} className="text-sm leading-relaxed text-muted-foreground">
                            {preview}
                          </p>
                        ) : null}

                        {open && citations.length > 0 ? (
                          <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <Link2 className="h-3 w-3" aria-hidden />
                              Sources
                            </p>
                            <ul className="space-y-1 text-xs">
                              {citations.map((citation, index) => (
                                <li key={`${row.id}-citation-${index}`}>
                                  {citation.url ? (
                                    <a
                                      href={citation.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline underline-offset-2 hover:no-underline"
                                    >
                                      {citation.title}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">{citation.title}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="-ml-2 h-8 gap-1.5 px-2 text-xs"
                          aria-expanded={open}
                          /* Only when that element exists. A body is NOT NULL in
                             the database, so an empty preview is close to
                             impossible — but pointing at a missing id is the kind
                             of thing a screen reader announces as nothing. */
                          aria-controls={open || preview ? bodyId : undefined}
                          onClick={() => toggle(row.id)}
                        >
                          {open ? "Show less" : "Read it"}
                          <ChevronDown
                            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                            aria-hidden
                          />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Library;
