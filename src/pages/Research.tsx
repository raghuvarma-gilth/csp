import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookMarked, MessageSquareQuote, Pencil, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurriculum } from "@/hooks/useLearning";
import { PageHeader, StatTile } from "@/components/learning/primitives";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ContentEditor,
  type ContentRow,
  type ParentOption,
} from "@/components/workspace/ContentEditor";
import {
  Pipeline,
  REVIEW_TRANSITIONS,
  STATUS_HINT,
  STATUS_LABEL,
  STATUS_ORDER,
  StatusBadge,
  TRANSITIONS,
  TRANSITION_LABEL,
  type ContentStatus,
} from "@/components/workspace/pipeline";
import { apiTarget, callFunction, errorMessage, getJson } from "@/lib/api";

/**
 * The research workspace.
 *
 * A research expert writes and submits. They do not sign off — not their own
 * work and not anyone else's. That is the point of having the role at all, and
 * it is enforced in three places: this screen does not draw the buttons,
 * `transition_content` refuses the request, and a CHECK constraint on
 * `research_content` refuses a row whose reviewer is its author.
 *
 * Research attaches to a *published* concept. The picker below is the published
 * curriculum, read through RLS — a research expert has no authority over the
 * course tree and this page does not pretend otherwise.
 */

const CONTENT_TYPE_LABEL: Record<string, string> = {
  research_note: "Research note",
  case_study: "Case study",
  real_world_application: "Real-world application",
  code_example: "Code example",
  dataset: "Dataset",
  reference: "Reference",
};

interface ListResponse {
  kind: "research";
  items: ContentRow[];
}

const Research = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const curriculum = useCurriculum();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [mine, setMine] = useState(true);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const configured = apiTarget === "python";
  const canReview = role === "admin" || role === "faculty";

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (mine) params.set("mine", "true");
    const suffix = params.toString();
    return suffix ? `?${suffix}` : "";
  }, [status, mine]);

  const list = useQuery({
    queryKey: ["content", "research", status, mine],
    enabled: configured,
    queryFn: () => getJson<ListResponse>(`content/research${query}`),
  });

  const concepts = useMemo<ParentOption[]>(
    () =>
      (curriculum.data ?? []).flatMap((course) =>
        course.chapters.flatMap((chapter) =>
          chapter.concepts.map((concept) => ({
            id: concept.id,
            title: concept.title,
            group: chapter.title,
          })),
        ),
      ),
    [curriculum.data],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["content"] });
    void queryClient.invalidateQueries({ queryKey: ["content-overview"] });
  };

  const transition = useMutation({
    mutationFn: (input: { id: string; to: ContentStatus }) =>
      callFunction("content/transition", { kind: "research", ...input }),
    onSuccess: refresh,
  });

  if (!configured) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Research" title="Research library" />
        <ConfigNotice message="The research workspace talks to the EduVerse API server, which is not configured in this build. Set VITE_API_URL to the address of the backend and reload." />
      </div>
    );
  }

  const items = list.data?.items ?? [];

  /* Counted from the rows on screen, and labelled as such — not a global total
     dressed up as one. */
  const tally = STATUS_ORDER.reduce<Record<string, number>>((acc, key) => {
    acc[key] = items.filter((item) => item.status === key).length;
    return acc;
  }, {});

  const openEditor = (item: ContentRow | null) => {
    setEditing(item);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research"
        title="Research library"
        description="Notes, case studies and worked examples that sit alongside a concept. Everything here is reviewed by someone else before a student sees it."
        actions={
          <Button size="sm" onClick={() => openEditor(null)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New research item
          </Button>
        }
      />

      {!canReview ? (
        <Card className="surface-card border-primary/20">
          <CardContent className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              You can write and submit. Approving and publishing are done by faculty, and nobody —
              including a faculty member — can sign off their own work. The database refuses it
              independently of this screen.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={mine ? "Your items" : "Items shown"}
          value={String(items.length)}
          icon={<BookMarked className="h-4 w-4" aria-hidden />}
          tone="primary"
        />
        <StatTile label="Drafts" value={String(tally.draft ?? 0)} />
        <StatTile
          label="With a reviewer"
          value={String(tally.submitted ?? 0)}
          tone={(tally.submitted ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile label="Published" value={String(tally.published ?? 0)} hint="visible to students" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={status} onValueChange={(value) => setStatus(value as ContentStatus | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every status</SelectItem>
            {STATUS_ORDER.map((option) => (
              <SelectItem key={option} value={option}>
                {STATUS_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="mine" checked={mine} onCheckedChange={setMine} />
          <Label htmlFor="mine" className="text-xs">
            Only what I wrote
          </Label>
        </div>
      </div>

      {transition.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertDescription className="text-xs">{errorMessage(transition.error)}</AlertDescription>
        </Alert>
      ) : null}

      {list.isLoading ? (
        <LoadingState label="Loading the library…" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<BookMarked className="h-8 w-8" aria-hidden />}
              title="Nothing here yet"
              description={
                status !== "all"
                  ? "Nothing matches that status. Clear the filter to see everything."
                  : "Write the first piece. It stays a draft until a reviewer approves it, so nothing you type here reaches a student by accident."
              }
              action={
                <Button size="sm" onClick={() => openEditor(null)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  New research item
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const own = item.created_by === user?.id;
            const moves = (TRANSITIONS[item.status] ?? []).filter(
              (target) => canReview || !REVIEW_TRANSITIONS.includes(target),
            );
            const contentType = String(item.content_type ?? "");
            const reviewNote = item.review_note ? String(item.review_note) : null;

            return (
              <Card key={item.id} className="surface-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <StatusBadge status={item.status} />
                        {own ? (
                          <Badge variant="outline" className="text-[10px]">
                            Yours
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CONTENT_TYPE_LABEL[contentType] ?? contentType.replace(/_/g, " ")} · updated{" "}
                        {new Date(item.updated_at).toLocaleDateString()}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!own || item.status === "published"}
                      title={
                        !own
                          ? "Only the author edits a piece. You can return it to draft with a note instead."
                          : item.status === "published"
                            ? "Return it to draft first, so students are not reading a version nobody reviewed."
                            : undefined
                      }
                      onClick={() => openEditor(item)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden />
                      Edit
                    </Button>
                  </div>

                  <Pipeline status={item.status} />

                  {reviewNote ? (
                    <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs leading-relaxed">
                      <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span>
                        <span className="font-medium">Reviewer:</span> {reviewNote}
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {moves.map((target) => {
                      const blocked = REVIEW_TRANSITIONS.includes(target) && own;
                      return (
                        <Button
                          key={target}
                          size="sm"
                          variant={target === "published" ? "default" : "outline"}
                          disabled={blocked || transition.isPending}
                          title={
                            blocked
                              ? "You wrote this. Another reviewer has to approve or publish it."
                              : STATUS_HINT[target]
                          }
                          onClick={() => transition.mutate({ id: item.id, to: target })}
                        >
                          {TRANSITION_LABEL[target]}
                        </Button>
                      );
                    })}
                    {moves.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        {item.status === "submitted"
                          ? "Waiting for a reviewer. Nothing for you to do here."
                          : "No move is available from this status."}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ContentEditor
        kind="research"
        item={editing}
        parents={concepts}
        parentsNotice={
          curriculum.isLoading
            ? "Loading the published curriculum…"
            : concepts.length === 0
              ? "No concept has been published yet. Research can still be written without one attached."
              : "Only published concepts are listed — research is attached to material students can already reach."
        }
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={refresh}
      />
    </div>
  );
};

export default Research;
