import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarClock, ExternalLink, MapPin, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ROLE_NAME, type AppRole } from "@/hooks/useUserRole";
import { Markdown } from "@/components/learning/Markdown";
import { opportunityKindLabel } from "@/components/workspace/pipeline";
import { cn } from "@/lib/utils";

/**
 * What faculty and industry have published, as a student reads it.
 *
 * Both the dashboard and `/updates` render these, which is why the queries and
 * the cards live here rather than twice. The reads go through
 * `published_announcements()` and `published_opportunities()` — SECURITY DEFINER
 * functions that take no arguments and filter on `status = 'published'`, so
 * there is no parameter a caller could widen to reach a draft. Both also drop
 * anything that has run out: an expired notice or a closed listing is not
 * shown, and more to the point is not counted.
 *
 * Nothing here has a fallback. If the database has no published announcements
 * the caller gets an empty array and says so — there are no example professors,
 * no sample companies and no "5 new internships" that does not correspond to
 * five rows a student can actually apply to.
 */

export type Announcement =
  Database["public"]["Functions"]["published_announcements"]["Returns"][number];

export type Opportunity =
  Database["public"]["Functions"]["published_opportunities"]["Returns"][number];

export const usePublishedAnnouncements = () =>
  useQuery({
    queryKey: ["published-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase.rpc("published_announcements");
      // Thrown as-is: a PostgrestError carries the code ErrorState uses to tell
      // "the migration is not applied" apart from "try again in a moment".
      if (error) throw error;
      return data ?? [];
    },
  });

export const usePublishedOpportunities = () =>
  useQuery({
    queryKey: ["published-opportunities"],
    queryFn: async (): Promise<Opportunity[]> => {
      const { data, error } = await supabase.rpc("published_opportunities");
      if (error) throw error;
      return data ?? [];
    },
  });

const isHttp = (value: string): boolean => /^https?:\/\//i.test(value.trim());

/**
 * A DATE column carries no timezone, and `new Date("2026-03-01")` is parsed as
 * UTC midnight — which prints as the day before in every negative offset. The
 * parts are reassembled as a local date so the closing date a poster typed is
 * the closing date a student reads.
 */
export const formatDay = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatMoment = (value: string): string => {
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? "date unknown"
    : at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** Whole days from today to a DATE string, in local terms. Null if unparseable. */
export const daysUntil = (value: string): number | null => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const then = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
};

/**
 * A plain-text opening line, for the dashboard's compact cards.
 *
 * Deliberately crude: it drops what reads badly on two lines — code fences,
 * tables, figures, callout markers — and keeps the first real sentences. The
 * full text is one click away on `/updates`, so a rough excerpt costs nothing.
 */
const excerpt = (content: string, limit = 180): string => {
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

/** Role colours match the staff badges elsewhere, so one person reads the same. */
const ROLE_BADGE: Partial<Record<AppRole, string>> = {
  faculty: "border-primary/40 bg-primary/10 text-primary",
  research_expert: "border-info/40 bg-info/10 text-info",
  industry_expert: "border-accent/40 bg-accent/10 text-accent",
  admin: "border-warning/40 bg-warning/10 text-warning",
};

const AuthorLine = ({
  name,
  role,
  trailing,
}: {
  name: string | null;
  role: AppRole | null;
  trailing: string;
}) => (
  <p className="text-xs text-muted-foreground">
    {name?.trim() ? <span className="font-medium">{name.trim()}</span> : null}
    {name?.trim() && role ? (
      <span className={cn("ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px]", ROLE_BADGE[role])}>
        {ROLE_NAME[role]}
      </span>
    ) : null}
    {name?.trim() ? " · " : null}
    {trailing}
  </p>
);

/**
 * `compact` is the dashboard form: the same row, with the body reduced to an
 * excerpt so a section of two cards stays a section rather than a page.
 */
export const AnnouncementCard = ({
  row,
  compact = false,
}: {
  row: Announcement;
  compact?: boolean;
}) => (
  <Card className={cn("surface-card", row.pinned && "border-primary/30")}>
    <CardContent className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {row.pinned ? (
          <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-[10px] text-primary">
            <Pin className="h-3 w-3" aria-hidden />
            Pinned
          </Badge>
        ) : null}
        {row.course_title ? (
          <Badge variant="outline" className="text-[10px]">
            {row.course_title}
          </Badge>
        ) : null}
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug">{row.title}</h3>
        <AuthorLine
          name={row.author_name}
          role={row.author_role}
          trailing={`posted ${formatMoment(row.updated_at)}`}
        />
      </div>

      {compact ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{excerpt(row.body)}</p>
      ) : (
        <Markdown content={row.body} />
      )}
    </CardContent>
  </Card>
);

export const OpportunityCard = ({
  row,
  compact = false,
}: {
  row: Opportunity;
  compact?: boolean;
}) => {
  const left = row.deadline ? daysUntil(row.deadline) : null;
  /* `published_opportunities()` already drops anything past its deadline, so a
     negative number here would mean the page has been open since yesterday. */
  const closing = left !== null && left >= 0 && left <= 7;

  return (
    <Card className="surface-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-[10px] text-accent">
            {opportunityKindLabel(row.kind)}
          </Badge>
          {row.deadline ? (
            <Badge
              variant="outline"
              className={cn("gap-1 text-[10px]", closing && "border-warning/40 bg-warning/10 text-warning")}
            >
              <CalendarClock className="h-3 w-3" aria-hidden />
              {left === 0
                ? "Closes today"
                : left === 1
                  ? "Closes tomorrow"
                  : `Closes ${formatDay(row.deadline)}`}
            </Badge>
          ) : null}
          {row.location ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <MapPin className="h-3 w-3" aria-hidden />
              {row.location}
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{row.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
            {row.organisation_url && isHttp(row.organisation_url) ? (
              <a
                href={row.organisation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                {row.organisation}
              </a>
            ) : (
              <span className="font-medium">{row.organisation}</span>
            )}
          </p>
          {compact ? null : (
            <AuthorLine
              name={row.author_name}
              role={row.author_role}
              trailing={`posted ${formatMoment(row.updated_at)}`}
            />
          )}
        </div>

        {compact ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{excerpt(row.description)}</p>
        ) : (
          <Markdown content={row.description} />
        )}

        {row.skills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {compact ? null : (
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Asks for
              </span>
            )}
            {row.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-[10px] font-normal">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {row.apply_url && isHttp(row.apply_url) ? (
            <Button asChild size="sm">
              <a href={row.apply_url} target="_blank" rel="noopener noreferrer">
                Apply
                <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No application link was given — ask your department for details.
            </span>
          )}

          {row.concept_slug && !compact ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/learn/${row.concept_slug}`}>
                {row.concept_title ?? "Related concept"}
                <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
