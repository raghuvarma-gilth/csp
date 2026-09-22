import { ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The four states every data surface in EduVerse has to be able to show.
 *
 * They live in one file so no screen is tempted to invent a fifth — for
 * instance, rendering an empty chart as if it were a real zero, which is what
 * the prototype did in several places.
 */

export const LoadingState = ({ label = "Loading…", className }: { label?: string; className?: string }) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)}>
    <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
    <p className="text-sm">{label}</p>
    <span className="sr-only" role="status">
      {label}
    </span>
  </div>
);

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
    {icon ? <div className="mb-1 text-muted-foreground/70">{icon}</div> : null}
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);

/**
 * Pull a human-readable message out of whatever was thrown.
 *
 * Callers pass three different shapes: an `Error`, a bare string (several
 * hooks store `someResult.error.message` in state), and a PostgrestError
 * object, which is a plain object and therefore not an `instanceof Error`.
 * The previous version tested only for `Error`, so a Supabase failure showed
 * the generic fallback and threw the actual reason away — the one piece of
 * information that would have explained the screen.
 */
const readMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === "string") return error.trim() || null;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

/**
 * True when the failure is a deployment problem rather than a bad moment.
 *
 * PostgREST reports a missing table as PGRST205 and a missing function as
 * PGRST202. Both mean the database schema this build expects has not been
 * applied — a permanent condition. Offering "Try again" for it invites
 * someone to click a button that cannot ever succeed, which is the same
 * dishonesty as faking the data would be, just quieter.
 */
const SCHEMA_ERROR_CODES = new Set(["PGRST202", "PGRST205", "42P01", "42883"]);

const isSchemaError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && SCHEMA_ERROR_CODES.has(code)) return true;
  const message = readMessage(error) ?? "";
  return /Could not find the (table|function)|does not exist/i.test(message);
};

export const ErrorState = ({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) => {
  const schemaMissing = isSchemaError(error);
  const isConfig = (error instanceof ApiError && error.isConfiguration) || schemaMissing;

  const detail = readMessage(error);
  const message = schemaMissing
    ? `This screen needs a database table that does not exist yet. Apply the migrations in supabase/migrations/ and reload.${
        detail ? ` (${detail})` : ""
      }`
    : (detail ?? "Something went wrong. Please try again.");

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center",
        isConfig ? "border-warning/40 bg-warning/5" : "border-destructive/30 bg-destructive/5",
        className,
      )}
    >
      {isConfig ? (
        <Settings2 className="h-6 w-6 text-warning" aria-hidden />
      ) : (
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      )}
      <h3 className="text-base font-semibold">
        {schemaMissing
          ? "The database is not set up yet"
          : isConfig
            ? "This feature is not configured yet"
            : "That did not work"}
      </h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      {onRetry && !isConfig ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
};

/**
 * Inline banner for a feature that is present but unusable because a key is
 * missing. Says so plainly instead of leaving a dead button on screen.
 */
export const ConfigNotice = ({ message, className }: { message: string; className?: string }) => (
  <div
    role="status"
    className={cn(
      "flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm",
      className,
    )}
  >
    <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
    <p className="text-muted-foreground">{message}</p>
  </div>
);

/** A labelled experiment. Used where the spec requires honesty about scope. */
export const ExperimentalBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-info",
      className,
    )}
  >
    Experimental
  </span>
);
