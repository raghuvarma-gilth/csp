import { useMemo, useState } from "react";
import { Briefcase, Megaphone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  AnnouncementCard,
  OpportunityCard,
  usePublishedAnnouncements,
  usePublishedOpportunities,
} from "@/components/updates/published";
import { OPPORTUNITY_KIND_LABEL, opportunityKindLabel } from "@/components/workspace/pipeline";

/**
 * Everything faculty and industry have said to students, in one place.
 *
 * The two tabs are two tables, both read through the SECURITY DEFINER functions
 * described in `components/updates/published.tsx`. A student reaching this page
 * sees published rows that have not expired, and nothing else — no drafts, no
 * submissions, nothing a reviewer sent back.
 *
 * Every count on this page is `rows.length` on an array that came from the
 * database. When that array is empty the page says the database is empty and
 * explains what would fill it, which is the honest version of a dashboard
 * section. It does not invent a professor, a company or a number.
 */

const Updates = () => {
  const announcements = usePublishedAnnouncements();
  const opportunities = usePublishedOpportunities();

  const [kind, setKind] = useState<string | null>(null);
  const [term, setTerm] = useState("");

  const notices = useMemo(() => announcements.data ?? [], [announcements.data]);
  const postings = useMemo(() => opportunities.data ?? [], [opportunities.data]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of postings) map.set(row.kind, (map.get(row.kind) ?? 0) + 1);
    return map;
  }, [postings]);

  /* Chips are built from what is actually published, in the canonical order,
     with anything the database grew later appended. A chip reading
     "Workshops 0" would be a filter that can only ever empty the page. */
  const kinds = useMemo(() => {
    const known = Object.keys(OPPORTUNITY_KIND_LABEL).filter((key) => counts.has(key));
    const extra = [...counts.keys()].filter((key) => !(key in OPPORTUNITY_KIND_LABEL)).sort();
    return [...known, ...extra];
  }, [counts]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return postings.filter((row) => {
      if (kind && row.kind !== kind) return false;
      if (!needle) return true;
      return [row.title, row.organisation, row.location, row.description, ...row.skills].some(
        (field) => field?.toLowerCase().includes(needle),
      );
    });
  }, [postings, kind, term]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Updates"
        title="From your faculty and from industry"
        description="Notices your professors have posted, and openings people working in the field have put up. Both pass through review by somebody other than the author before they reach this page."
      />

      <Tabs defaultValue="announcements">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="announcements" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" aria-hidden />
            Announcements
            {notices.length > 0 ? (
              <span className="tabular-nums opacity-70">{notices.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" aria-hidden />
            Opportunities
            {postings.length > 0 ? (
              <span className="tabular-nums opacity-70">{postings.length}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------- announcements */}
        <TabsContent value="announcements" className="mt-4 space-y-3">
          {announcements.isLoading ? (
            <LoadingState label="Loading announcements…" />
          ) : announcements.error ? (
            <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
          ) : notices.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Megaphone className="h-8 w-8" aria-hidden />}
                  title="No announcements"
                  description="Your faculty have not posted anything, or nothing they posted has cleared review yet. Nothing is shown here until a real notice exists."
                />
              </CardContent>
            </Card>
          ) : (
            notices.map((row) => <AnnouncementCard key={row.id} row={row} />)
          )}
        </TabsContent>

        {/* --------------------------------------------------- opportunities */}
        <TabsContent value="opportunities" className="mt-4 space-y-3">
          {opportunities.isLoading ? (
            <LoadingState label="Loading opportunities…" />
          ) : opportunities.error ? (
            <ErrorState error={opportunities.error} onRetry={() => void opportunities.refetch()} />
          ) : postings.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Briefcase className="h-8 w-8" aria-hidden />}
                  title="No open opportunities"
                  description="Industry professionals post internships, jobs, projects, workshops and challenges here, a reviewer approves them, and they appear on this page while they are still open. There are none right now — so this page shows none rather than filling itself with examples."
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={kind === null ? "default" : "outline"}
                    onClick={() => setKind(null)}
                  >
                    Everything
                    <span className="ml-1.5 tabular-nums opacity-70">{postings.length}</span>
                  </Button>
                  {kinds.map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={kind === key ? "default" : "outline"}
                      onClick={() => setKind(key)}
                    >
                      {opportunityKindLabel(key)}
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
                    placeholder="Search role, organisation or skill"
                    aria-label="Search opportunities"
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
                      description="No open opportunity matches the filter you have set. Clear it to see everything again."
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setKind(null);
                            setTerm("");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {kind || term.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Showing {visible.length} of {postings.length} open{" "}
                      {postings.length === 1 ? "opportunity" : "opportunities"}.
                    </p>
                  ) : null}
                  {visible.map((row) => (
                    <OpportunityCard key={row.id} row={row} />
                  ))}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Updates;
