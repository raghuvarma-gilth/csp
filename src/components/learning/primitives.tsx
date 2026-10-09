import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  GraduationCap,
  ListChecks,
  type LucideIcon,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tilt } from "@/components/ui/depth";
import { ModuleCover, moduleArt } from "@/components/learning/moduleArt";
import { cn } from "@/lib/utils";
import {
  ACTION_LABEL,
  CONFIDENT_MASTERY,
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

/**
 * One icon per thing being measured, for the same reason the mastery colours
 * are centralised: Home and the progress page draw the same four numbers, and
 * drawing them with different glyphs makes a student re-learn the dashboard
 * every time they move between the two.
 *
 * Before this existed, `Brain` meant "average mastery" on Home and "concepts
 * measured" on /progress, and `Target` meant "time on task" on Home and
 * "mastered" on /progress — so two of the four tiles contradicted each other
 * across the two pages that a student is most likely to compare.
 *
 * Each glyph is also the conventional one for its job: a flame for a streak
 * (as GitHub and Duolingo use it), a clock for elapsed time, a dial for a
 * measured level, a tick for something finished. Navigation icons live in
 * AppShell and are deliberately disjoint from these — `Timer` there means a
 * focus session, which is why time-on-task here is a `Clock`.
 */
export const METRIC_ICON = {
  /** Concepts at the mastery bar — a finished, verified result. */
  mastered: CheckCircle2,
  /** Concepts with any evidence at all — the dial has a reading. */
  measured: Gauge,
  /** Consecutive active days. */
  streak: Flame,
  /** Time spent, as opposed to a timed focus session. */
  time: Clock,
  /** Mastery that has slipped from its peak. */
  slipping: TrendingDown,
  /** The warning a student should act on. */
  warning: AlertTriangle,
  /** A plan — a list of things to work through. */
  plan: ListChecks,
  /** A course, wherever one is named rather than drawn. */
  course: GraduationCap,
} satisfies Record<string, LucideIcon>;

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

/**
 * A count drawn as a ring, for module progress.
 *
 * `value` and `secondary` are fractions between 0 and 1 and must both come from
 * counting real rows — how many concepts in this module are at 60%+, and how
 * many have been attempted at all. The ring deliberately does not average
 * mastery across the module, because an unmeasured concept has no score to
 * average in and treating it as a zero would turn "not started" into "failed".
 */
export const ProgressRing = ({
  value,
  secondary = 0,
  size = 52,
  label,
  className,
}: {
  value: number;
  secondary?: number;
  size?: number;
  label?: ReactNode;
  className?: string;
}) => {
  const stroke = size >= 64 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamp = (input: number) => Math.min(Math.max(input, 0), 1);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        {secondary > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamp(secondary))}
            className="stroke-primary/25"
          />
        ) : null}
        {value > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamp(value))}
            className="stroke-primary transition-[stroke-dashoffset] duration-700"
          />
        ) : null}
      </svg>
      {label ? (
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
          {label}
        </span>
      ) : null}
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
        "surface-card sheen h-full transition-shadow",
        locked ? "opacity-60" : "group-hover:depth-3",
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

  // A locked card is not a destination, so it does not tilt either — motion
  // that promises interaction where there is none is worse than no motion.
  if (locked) return <div aria-disabled>{body}</div>;

  return (
    <Tilt className="h-full" max={5} lift={8}>
      <Link to={`/learn/${slug}`} className="group block h-full rounded-2xl focus-visible:outline-none">
        {body}
      </Link>
    </Tilt>
  );
};

/**
 * One module in a course — a chapter, presented as a destination of its own
 * rather than an accordion row. Cover art and icon come from the slug, so a
 * module created next week looks as finished as the ones seeded today.
 */
export const ModuleCard = ({
  href,
  slug,
  position,
  title,
  description,
  conceptCount,
  confident,
  started,
  minutes,
}: {
  href: string;
  slug: string;
  position: number;
  title: string;
  description: string | null;
  conceptCount: number;
  /** Concepts in this module measured at 60% or better. A count, not an average. */
  confident: number;
  /** Concepts attempted at least once. */
  started: number;
  minutes: number;
}) => {
  const art = moduleArt(slug);
  const Icon = art.icon;
  const fraction = conceptCount > 0 ? confident / conceptCount : 0;

  return (
    <Tilt className="h-full" max={6} lift={14}>
      <Link to={href} className="group block h-full rounded-2xl focus-visible:outline-none">
        <Card className="surface-card sheen flex h-full flex-col transition-shadow group-hover:depth-3 group-focus-visible:ring-2 group-focus-visible:ring-ring">
          <ModuleCover slug={slug} className="h-16 rounded-t-2xl" />
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="-mt-9 flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card depth-2",
                  art.cls.ink,
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <ProgressRing
                value={fraction}
                secondary={conceptCount > 0 ? started / conceptCount : 0}
                label={
                  <span className={confident > 0 ? undefined : "text-muted-foreground"}>
                    {confident}/{conceptCount}
                  </span>
                }
                className="mt-1"
              />
            </div>

            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Module {position}
              </p>
              <h3 className="text-[0.95rem] font-semibold leading-snug">{title}</h3>
              {description ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span>
                {conceptCount} concept{conceptCount === 1 ? "" : "s"}
              </span>
              <span aria-hidden>·</span>
              <span>{minutes} min</span>
              <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
                {started === 0 ? "Start" : confident === conceptCount ? "Review" : "Continue"}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </Tilt>
  );
};

/**
 * A course, as the dashboard shows it: where you are and the one module to
 * open next.
 *
 * The ring uses the same encoding as ModuleCard and the Learn page — concepts
 * counted at CONFIDENT_MASTERY, with attempted-at-all behind it — so the same
 * course reads the same on both pages. It is a count of rows, never an average
 * over concepts the student has not touched.
 */
export const CourseProgressCard = ({
  href,
  slug,
  code,
  subject,
  title,
  moduleCount,
  conceptCount,
  confident,
  started,
  nextModule,
}: {
  href: string;
  slug: string;
  code: string | null;
  subject: string;
  title: string;
  moduleCount: number;
  conceptCount: number;
  /** Concepts in this course at CONFIDENT_MASTERY or better. A count. */
  confident: number;
  /** Concepts attempted at least once. */
  started: number;
  /** The module the CTA opens, named so the button says where it goes. */
  nextModule: string | null;
}) => {
  const art = moduleArt(slug);
  const Icon = art.icon;
  const fraction = conceptCount > 0 ? confident / conceptCount : 0;
  const verb = started === 0 ? "Start" : confident >= conceptCount ? "Review" : "Continue";

  return (
    <Tilt className="h-full" max={5} lift={12}>
      <Link to={href} className="group block h-full rounded-2xl focus-visible:outline-none">
        <Card className="surface-card sheen flex h-full flex-col transition-shadow group-hover:depth-3 group-focus-visible:ring-2 group-focus-visible:ring-ring">
          <ModuleCover slug={slug} className="h-14 rounded-t-2xl" />
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="-mt-8 flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card depth-2",
                  art.cls.ink,
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <ProgressRing
                value={fraction}
                secondary={conceptCount > 0 ? started / conceptCount : 0}
                size={56}
                label={
                  <span className={confident > 0 ? undefined : "text-muted-foreground"}>
                    {confident}/{conceptCount}
                  </span>
                }
                className="mt-1"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {code ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {code}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="text-[10px]">
                  {subject}
                </Badge>
              </div>
              <h3 className="text-[0.95rem] font-semibold leading-snug">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {started === 0
                  ? `${moduleCount} module${moduleCount === 1 ? "" : "s"} · ${conceptCount} concept${
                      conceptCount === 1 ? "" : "s"
                    }`
                  : `${confident} of ${conceptCount} concept${
                      conceptCount === 1 ? "" : "s"
                    } at ${CONFIDENT_MASTERY}%+`}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                {nextModule ?? "No modules published"}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                {verb}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </Tilt>
  );
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
  <Tilt className="h-full" max={5} lift={8}>
    <Link to={href} className="group block h-full rounded-2xl focus-visible:outline-none">
      <Card className="surface-card sheen h-full transition-shadow group-hover:depth-3">
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
  </Tilt>
);
