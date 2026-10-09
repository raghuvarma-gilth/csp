import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarClock,
  ExternalLink,
  FlaskConical,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Plus,
  ShieldAlert,
} from "lucide-react";
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
  opportunityKindLabel,
  type ContentStatus,
} from "@/components/workspace/pipeline";
import { formatDay } from "@/components/updates/published";
import { apiTarget, callFunction, errorMessage, getJson } from "@/lib/api";

/**
 * The industry workspace.
 *
 * An industry account posts opportunities — internships, jobs, projects,
 * workshops, challenges — and writes case studies in the research library. It
 * reviews nothing. Faculty and administrators sign opportunities off, which is
 * why this page draws no approve or publish button for an industry professional
 * and the `AUTHORS` map in `backend/app/routers/content.py` lists faculty as
 * readers of this kind but not authors of it.
 *
 * Everything on screen is this account's own work plus whatever else has
 * reached a status it is allowed to see. Nothing is seeded and no count is an
 * estimate: the tiles count the rows below them and say so.
 */

interface ListResponse {
  kind: "opportunity";
  items: ContentRow[];
}

const Industry = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const curriculum = useCurriculum();
  const queryClient = useQueryClient();

  const configured = apiTarget === "python";
  /* An industry account never signs off. Only an administrator arriving on this
     page can, and the server checks that again regardless of what is drawn. */
  const canReview = role === "admin";

  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [mine, setMine] = useState(true);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (mine) params.set("mine", "true");
    const suffix = params.toString();
    return suffix ? `?${suffix}` : "";
  }, [status, mine]);

  const list = useQuery({
    queryKey: ["content", "opportunity", status, mine],
    enabled: configured,
    queryFn: () => getJson<ListResponse>(`content/opportunity${query}`),
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
    void queryClient.invalidateQueries({ queryKey: ["published-opportunities"] });
  };

  const transition = useMutation({
    mutationFn: (input: { id: string; to: ContentStatus }) =>
      callFunction("content/transition", { kind: "opportunity", ...input }),
    onSuccess: refresh,
  });

  if (!configured) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Industry" title="Opportunities" />
        <ConfigNotice message="The industry workspace talks to the EduVerse API server, which is not configured in this build. Set VITE_API_URL to the address of the backend and reload. Nothing is shown here until it can be read from the database." />
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
        eyebrow="Industry"
        title="Opportunities"
        description="Post an internship, a job, a project, a workshop or a challenge. Faculty read it before students do, and a student only ever sees what reaches Published."
        actions={
          <Button size="sm" onClick={() => openEditor(null)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New opportunity
          </Button>
        }
      />

      {!canReview ? (
        <Card className="surface-card border-primary/20">
          <CardContent className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              You write and submit. Approving and publishing are done by faculty or an
              administrator, and nobody can sign off their own posting — the database refuses a row
              whose reviewer is its author, independently of this screen.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={mine ? "Your postings" : "Postings shown"}
          value={String(items.length)}
          icon={<Briefcase className="h-4 w-4" aria-hidden />}
          tone="primary"
        />
        <StatTile label="Drafts" value={String(tally.draft ?? 0)} />
        <StatTile
          label="With a reviewer"
          value={String(tally.submitted ?? 0)}
          tone={(tally.submitted ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Published"
          value={String(tally.published ?? 0)}
          hint="visible to students"
        />
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
            Only what I posted
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
        <LoadingState label="Loading your postings…" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<Briefcase className="h-8 w-8" aria-hidden />}
              title="Nothing posted yet"
              description={
                status !== "all"
                  ? "Nothing matches that status. Clear the filter to see everything."
                  : "Post the first opening. It stays a draft until a faculty reviewer approves it, so nothing you type here reaches a student by accident."
              }
              action={
                <Button size="sm" onClick={() => openEditor(null)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  New opportunity
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
            const kind = String(item.kind ?? "");
            const organisation = item.organisation ? String(item.organisation) : null;
            const location = item.location ? String(item.location) : null;
            const deadline = item.deadline ? String(item.deadline) : null;
            const applyUrl = item.apply_url ? String(item.apply_url) : null;
            const skills = Array.isArray(item.skills) ? (item.skills as string[]) : [];
            const reviewNote = item.review_note ? String(item.review_note) : null;

            return (
              <Card key={item.id} className="surface-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <Badge
                          variant="outline"
                          className="border-accent/40 bg-accent/10 text-[10px] text-accent"
                        >
                          {opportunityKindLabel(kind)}
                        </Badge>
                        <StatusBadge status={item.status} />
                        {own ? (
                          <Badge variant="outline" className="text-[10px]">
                            Yours
                          </Badge>
                        ) : null}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {organisation ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" aria-hidden />
                            {organisation}
                          </span>
                        ) : null}
                        {location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden />
                            {location}
                          </span>
                        ) : null}
                        {deadline ? (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" aria-hidden />
                            closes {formatDay(deadline)}
                          </span>
                        ) : null}
                        <span>updated {new Date(item.updated_at).toLocaleDateString()}</span>
                      </p>
                      {skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {skills.map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-[10px] font-normal">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {applyUrl ? (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                            Link
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!own || item.status === "published"}
                        title={
                          !own
                            ? "Only the person who posted this can edit it. Return it to draft with a note instead."
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
                  </div>

                  <Pipeline status={item.status} />

                  {reviewNote ? (
                    <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs leading-relaxed">
                      <MessageSquareQuote
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
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
                              ? "You posted this. Another reviewer has to approve or publish it."
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
                          ? "Waiting for a faculty reviewer. Nothing for you to do here."
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

      <Card className="surface-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="h-4 w-4 text-info" aria-hidden />
              Write about the work, not just the opening
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Case studies and real-world applications go in the research library, where they sit
              alongside the concept they illustrate.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/research">Open the research library</Link>
          </Button>
        </CardContent>
      </Card>

      <ContentEditor
        kind="opportunity"
        item={editing}
        parents={concepts}
        parentsNotice={
          curriculum.isLoading
            ? "Loading the published curriculum…"
            : concepts.length === 0
              ? "No concept has been published yet. An opportunity can still be posted without one attached."
              : "Only published concepts are listed — a link here points a student at material they can already reach."
        }
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={refresh}
      />
    </div>
  );
};

export default Industry;
