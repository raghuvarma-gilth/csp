import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The content pipeline, mirrored from the server.
 *
 * `backend/app/routers/content.py` holds the authoritative transition table and
 * the self-review rule. This copy exists so the UI does not offer a button the
 * server is going to refuse — it is not the gate. If the two ever disagree the
 * server wins, and the screen shows the server's message.
 *
 * The order matters and is the whole point of the feature: nothing reaches a
 * student without passing through `approved`, which is the record that somebody
 * other than the author read it.
 */

export type ContentStatus = "draft" | "submitted" | "approved" | "published" | "archived";

export const STATUS_ORDER: ContentStatus[] = [
  "draft",
  "submitted",
  "approved",
  "published",
  "archived",
];

/** The four stages drawn as a strip. `archived` is a siding, not a stage. */
const PIPELINE: ContentStatus[] = ["draft", "submitted", "approved", "published"];

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export const STATUS_HINT: Record<ContentStatus, string> = {
  draft: "Only you and other staff can see this.",
  submitted: "Waiting for a reviewer who is not the author.",
  approved: "Reviewed and signed off, but not yet visible to students.",
  published: "Live. Students can read this now.",
  archived: "Withdrawn. Students can no longer reach it.",
};

/** Mirrors TRANSITIONS in content.py. Anything not listed is refused there. */
export const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["submitted", "archived"],
  submitted: ["approved", "draft", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["archived"],
  archived: ["draft"],
};

/** Moves that are a review decision, and so need someone other than the author. */
export const REVIEW_TRANSITIONS: ContentStatus[] = ["approved", "published"];

export const TRANSITION_LABEL: Record<ContentStatus, string> = {
  draft: "Return to draft",
  submitted: "Submit for review",
  approved: "Approve",
  published: "Publish",
  archived: "Archive",
};

/**
 * The kinds of research a contributor can write, in the order they are offered.
 *
 * Mirrors the CHECK constraint on `research_content.content_type`. Three screens
 * render this vocabulary — the editor, the staff workspace and the student
 * library — and a private copy in each is how one of them ends up showing a
 * reader the words "case_study".
 */
export const RESEARCH_TYPE_LABEL: Record<string, string> = {
  research_note: "Research note",
  case_study: "Case study",
  real_world_application: "Real-world application",
  code_example: "Code example",
  dataset: "Dataset",
  reference: "Reference",
};

/**
 * A readable name for a kind. Falls back to the raw value with its underscores
 * opened out, because the database may grow a kind before this build knows it.
 */
export const researchTypeLabel = (type: string): string =>
  RESEARCH_TYPE_LABEL[type] ?? type.replace(/_/g, " ");

/**
 * What an industry professional can post, in the order it is offered.
 *
 * Mirrors the CHECK constraint on `opportunities.kind`. These are five labels
 * on one table rather than five tables, because an internship and a workshop
 * differ in the word on the badge and nothing else that matters to a reader.
 */
export const OPPORTUNITY_KIND_LABEL: Record<string, string> = {
  internship: "Internship",
  job: "Job",
  project: "Project",
  workshop: "Workshop",
  challenge: "Challenge",
};

export const opportunityKindLabel = (kind: string): string =>
  OPPORTUNITY_KIND_LABEL[kind] ?? kind.replace(/_/g, " ");

const BADGE_STYLE: Record<ContentStatus, string> = {
  draft: "border-border/70 bg-muted text-muted-foreground",
  submitted: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-info/40 bg-info/10 text-info",
  published: "border-success/40 bg-success/10 text-success",
  archived: "border-border/70 bg-transparent text-muted-foreground line-through",
};

export const StatusBadge = ({
  status,
  className,
}: {
  status: ContentStatus;
  className?: string;
}) => (
  <Badge variant="outline" className={cn("text-[10px]", BADGE_STYLE[status], className)}>
    {STATUS_LABEL[status]}
  </Badge>
);

/**
 * Where an item sits, drawn as four steps. A student only ever sees the last
 * one, and saying that on screen is the point — faculty routinely assume
 * "saved" means "live".
 */
export const Pipeline = ({ status }: { status: ContentStatus }) => {
  if (status === "archived") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Archived — out of the pipeline. Return it to draft to work on it again.
      </p>
    );
  }

  const reached = PIPELINE.indexOf(status);

  return (
    <ol className="flex items-center gap-1" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {PIPELINE.map((step, index) => {
        const done = index < reached;
        const here = index === reached;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                here && BADGE_STYLE[step],
                done && "border-success/30 bg-success/5 text-success",
                !here && !done && "border-dashed border-border/60 text-muted-foreground/60",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
              {STATUS_LABEL[step]}
            </span>
            {index < PIPELINE.length - 1 ? (
              <span
                className={cn("h-px w-3", done ? "bg-success/40" : "bg-border")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};
