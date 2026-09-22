import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ACTION_LABEL,
  MasteryRecord,
  masteryColor,
  masteryLabel,
  masteryTextColor,
} from "@/lib/mastery";

/**
 * The small pieces every learning surface reuses.
 *
 * Centralised so a mastery number looks and reads the same on the roadmap, in
 * the DNA grid and on a concept header — the prototype drew the same value
 * three different ways with three different colour meanings.
 */

export const PageHeader = ({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) => (
  <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow ? (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
  </header>
);

/**
 * A mastery number drawn as a bar. `unmeasured` renders a hatched, empty track
 * with the words "Not started" — never a 0% that looks like a measurement.
 */
export const MasteryBar = ({
  value,
  unmeasured = false,
  showLabel = true,
  className,
}: {
  value: number;
  unmeasured?: boolean;
  showLabel?: boolean;
  className?: string;
}) => {
  const rounded = Math.round(value);

  return (
    <div className={cn("w-full", className)}>
      {showLabel ? (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className={cn("font-medium", unmeasured ? "text-muted-foreground" : masteryTextColor(value))}>
            {unmeasured ? "Not started" : masteryLabel(value)}
          </span>
          {!unmeasured ? <span className="tabular-nums text-muted-foreground">{rounded}%</span> : null}
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={unmeasured ? undefined : rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={unmeasured ? "Not started" : `Mastery ${rounded} percent`}
      >
        {!unmeasured ? (
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", masteryColor(value))}
            style={{ width: `${Math.max(rounded, 2)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
};

export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "accent" | "warning";
}) => (
  <Card className="surface-card">
    <CardContent className="flex items-start gap-3 p-4">
      {icon ? (
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "accent" && "bg-accent/10 text-accent",
            tone === "warning" && "bg-warning/10 text-warning",
            tone === "default" && "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </CardContent>
  </Card>
);

export const ConceptCard = ({
  slug,
  title,
  summary,
  estimatedMinutes,
  difficulty,
  record,
  locked,
  lockedBy,
}: {
  slug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number;
  difficulty: number;
  record?: MasteryRecord;
  locked?: boolean;
  lockedBy?: string[];
}) => {
  const body = (
    <Card
      className={cn(
        "surface-card h-full transition-shadow",
        locked ? "opacity-60" : "hover:shadow-md",
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{title}</h3>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            L{difficulty}
          </Badge>
        </div>
        {summary ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{summary}</p>
        ) : null}
        <div className="mt-auto space-y-2">
          <MasteryBar value={record?.mastery ?? 0} unmeasured={!record || record.attempts === 0} />
          <p className="text-[11px] text-muted-foreground">
            {locked
              ? `Locked — finish ${lockedBy?.join(", ") ?? "the prerequisites"} first`
              : `${estimatedMinutes} min read`}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return locked ? <div aria-disabled>{body}</div> : <Link to={`/learn/${slug}`}>{body}</Link>;
};

const ACTION_ROUTE: Record<string, (slug?: string | null) => string> = {
  learn: (slug) => (slug ? `/learn/${slug}` : "/learn"),
  review: (slug) => (slug ? `/learn/${slug}` : "/learn"),
  practice: (slug) => (slug ? `/practice/${slug}` : "/practice"),
  quiz: (slug) => (slug ? `/practice/${slug}` : "/practice"),
  code: () => "/code",
  visual: () => "/visual",
  diagnostic: () => "/diagnostic",
};

export const recommendationHref = (action: string, slug?: string | null) =>
  (ACTION_ROUTE[action] ?? (() => "/learn"))(slug);

export const RecommendationCard = ({
  action,
  title,
  reason,
  estimatedMinutes,
  href,
  priority,
}: {
  action: string;
  title: string;
  reason: string | null;
  estimatedMinutes: number | null;
  href: string;
  priority: number;
}) => (
  <Link to={href} className="group block">
    <Card className="surface-card h-full transition-shadow group-hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              priority === 1 && "bg-warning/15 text-warning",
              priority === 2 && "bg-primary/10 text-primary",
            )}
          >
            {ACTION_LABEL[action] ?? action}
          </Badge>
          {estimatedMinutes ? (
            <span className="text-[11px] text-muted-foreground">{estimatedMinutes} min</span>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold leading-snug">{title}</h3>
        {reason ? <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p> : null}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
          Start
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  </Link>
);
