import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ClipboardCheck,
  FileStack,
  Pencil,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, StatTile } from "@/components/learning/primitives";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ContentEditor,
  KIND_LABEL,
  PARENT_OF,
  type ContentKind,
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
 * The faculty workspace.
 *
 * Everything here is a request to the server, which decides. Two rules are worth
 * stating because the UI reflects them rather than implementing them:
 *
 *   · Nothing reaches a student without passing through `approved`. There is no
 *     draft-to-published shortcut, in this screen or in the API.
 *
 *   · Nobody signs off their own work. Where the signed-in user is the author,
 *     the approve and publish buttons are disabled and say why. The server
 *     refuses it independently, and so does a CHECK constraint on each reviewed
 *     table — three layers, because this is the rule the whole review workflow
 *     rests on.
 *
 * The review queue spans every reviewed kind, not just research: faculty are
 * also the reviewers for the opportunities industry accounts post, and a queue
 * that quietly omitted them would mean nothing an industry professional
 * submitted could ever reach a student.
 *
 * The counts at the top are `SELECT count(*)` results, not estimates.
 */

const KINDS: ContentKind[] = [
  "course",
  "chapter",
  "concept",
  "problem",
  "research",
  "announcement",
];

/**
 * The counts table covers one more kind than the tabs do. Faculty review
 * opportunities but may not author them — the server's `AUTHORS` map lists only
 * industry accounts — so offering a "New opportunity" tab here would draw a
 * button the API refuses. Showing where they sit is useful; offering to write
 * one is not.
 */
const COUNT_KINDS: ContentKind[] = [...KINDS, "opportunity"];

interface ListResponse {
  kind: ContentKind;
  items: ContentRow[];
}

interface OverviewResponse {
  counts: Record<string, Record<string, number>>;
  reviewQueue: Array<{
    id: string;
    title: string;
    /** Which table the row came from. The server stamps it; see content.py. */
    kind: ContentKind;
    status: ContentStatus;
    created_by: string;
    created_at: string;
  }>;
  pendingRoleRequests: number | null;
  roles: string[];
}

/** Totals one status column across every kind. */
const sumColumn = (counts: Record<string, Record<string, number>>, status: string) =>
  Object.values(counts).reduce((total, row) => total + (row[status] ?? 0), 0);

const Faculty = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<ContentKind>("concept");
  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const configured = apiTarget === "python";

  const overview = useQuery({
    queryKey: ["content-overview"],
    enabled: configured,
    queryFn: () => getJson<OverviewResponse>("content-overview"),
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (mine) params.set("mine", "true");
    const suffix = params.toString();
    return suffix ? `?${suffix}` : "";
  }, [status, mine]);

  const list = useQuery({
    queryKey: ["content", kind, status, mine],
    enabled: configured,
    queryFn: () => getJson<ListResponse>(`content/${kind}${query}`),
  });

  /* The reference picker needs the parent list, and the grandparent list purely
     to label it — "Arrays · Sliding window" beats forty identical titles. */
  const parentKind = PARENT_OF[kind];
  const grandKind = parentKind ? PARENT_OF[parentKind] : undefined;

  const parentList = useQuery({
    queryKey: ["content", parentKind, "all", false],
    enabled: configured && Boolean(parentKind),
    queryFn: () => getJson<ListResponse>(`content/${parentKind}`),
  });

  const grandList = useQuery({
    queryKey: ["content", grandKind, "all", false],
    enabled: configured && Boolean(grandKind),
    queryFn: () => getJson<ListResponse>(`content/${grandKind}`),
  });

  const parents = useMemo<ParentOption[]>(() => {
    if (!parentKind) return [];
    const grandTitles = new Map(
      (grandList.data?.items ?? []).map((row) => [row.id, row.title] as const),
    );
    return (parentList.data?.items ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      group: grandKind ? grandTitles.get(String(row[`${grandKind}_id`] ?? "")) : undefined,
    }));
  }, [parentKind, grandKind, parentList.data, grandList.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["content"] });
    void queryClient.invalidateQueries({ queryKey: ["content-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["curriculum"] });
    /* Approving an announcement or an opportunity changes what the student
       dashboard reads, so the two published_* queries go stale here too. */
    void queryClient.invalidateQueries({ queryKey: ["published-announcements"] });
    void queryClient.invalidateQueries({ queryKey: ["published-opportunities"] });
    void queryClient.invalidateQueries({ queryKey: ["published-contributions"] });
  };

  const transition = useMutation({
    mutationFn: (input: { kind: ContentKind; id: string; to: ContentStatus }) =>
      callFunction("content/transition", input),
    onSuccess: refresh,
  });

  if (!configured) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Faculty" title="Course workspace" />
        <ConfigNotice message="The authoring workspace talks to the EduVerse API server, which is not configured in this build. Set VITE_API_URL to the address of the backend and reload. Nothing is shown here until it can be read from the database." />
      </div>
    );
  }

  const items = list.data?.items ?? [];
  const counts = overview.data?.counts;
  const queue = overview.data?.reviewQueue ?? [];

  const openEditor = (item: ContentRow | null) => {
    setEditing(item);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Faculty"
        title="Course workspace"
        description="Author the curriculum, post announcements, and move everything through review — including what industry accounts submit. Students only ever see what reaches Published."
        actions={
          <Button size="sm" onClick={() => openEditor(null)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New {KIND_LABEL[kind].toLowerCase()}
          </Button>
        }
      />

      {/* ------------------------------------------------------------ counts */}
      {overview.isLoading ? (
        <LoadingState label="Counting…" />
      ) : overview.error ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : counts ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Published concepts"
              value={String(counts.concept?.published ?? 0)}
              icon={<FileStack className="h-4 w-4" aria-hidden />}
              tone="primary"
            />
            <StatTile
              label="Awaiting review"
              value={String(sumColumn(counts, "submitted"))}
              icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
              tone={sumColumn(counts, "submitted") > 0 ? "warning" : "default"}
            />
            <StatTile label="Drafts" value={String(sumColumn(counts, "draft"))} />
            <StatTile
              label="Role requests"
              value={
                overview.data?.pendingRoleRequests === null ||
                overview.data?.pendingRoleRequests === undefined
                  ? "—"
                  : String(overview.data.pendingRoleRequests)
              }
              hint={
                overview.data?.pendingRoleRequests === null ? "administrators only" : "waiting"
              }
              icon={<Users className="h-4 w-4" aria-hidden />}
            />
          </div>

          <Card className="surface-card overflow-x-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Where everything sits</CardTitle>
              <CardDescription className="text-xs">
                Counted from the database when this page loaded.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="pb-2 pr-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Kind
                    </th>
                    {STATUS_ORDER.map((key) => (
                      <th
                        key={key}
                        className="pb-2 pr-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        title={STATUS_HINT[key]}
                      >
                        {STATUS_LABEL[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COUNT_KINDS.map((row) => (
                    <tr key={row} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 font-medium">{KIND_LABEL[row]}</td>
                      {STATUS_ORDER.map((key) => {
                        const value = counts[row]?.[key] ?? 0;
                        return (
                          <td
                            key={key}
                            className={
                              value === 0
                                ? "py-2 pr-3 text-right tabular-nums text-muted-foreground/50"
                                : "py-2 pr-3 text-right tabular-nums"
                            }
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* ------------------------------------------------------ review queue */}
      {queue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Awaiting your sign-off
          </h2>
          <div className="space-y-2">
            {queue.map((row) => {
              const own = row.created_by === user?.id;
              return (
                <Card key={`${row.kind}-${row.id}`} className="surface-card border-warning/30">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABEL[row.kind] ?? row.kind} · submitted{" "}
                        {new Date(row.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {own ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ShieldAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
                          You wrote this — another reviewer has to sign it off.
                        </span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={transition.isPending}
                            onClick={() =>
                              transition.mutate({ kind: row.kind, id: row.id, to: "approved" })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={transition.isPending}
                            onClick={() =>
                              transition.mutate({ kind: row.kind, id: row.id, to: "draft" })
                            }
                          >
                            Return to draft
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- content */}
      <section className="space-y-3">
        <Tabs value={kind} onValueChange={(value) => setKind(value as ContentKind)}>
          <TabsList className="flex w-full flex-wrap justify-start">
            {KINDS.map((option) => (
              <TabsTrigger key={option} value={option} className="text-xs">
                {KIND_LABEL[option]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ContentStatus | "all")}
          >
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
            <AlertDescription className="text-xs">
              {errorMessage(transition.error)}
            </AlertDescription>
          </Alert>
        ) : null}

        {list.isLoading ? (
          <LoadingState label={`Loading ${KIND_LABEL[kind].toLowerCase()}s…`} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<FileStack className="h-8 w-8" aria-hidden />}
                title={`No ${KIND_LABEL[kind].toLowerCase()} matches this filter`}
                description={
                  mine || status !== "all"
                    ? "Nothing here with those filters. Clear them to see everything."
                    : "Nothing has been created yet. Start a draft — it stays invisible to students until it is reviewed and published."
                }
                action={
                  <Button size="sm" onClick={() => openEditor(null)}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    New {KIND_LABEL[kind].toLowerCase()}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const own = item.created_by === user?.id;
              const moves = TRANSITIONS[item.status] ?? [];

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
                          {item.slug ? `${item.slug} · ` : ""}
                          updated {new Date(item.updated_at).toLocaleDateString()}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={item.status === "published"}
                        title={
                          item.status === "published"
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
                            onClick={() =>
                              transition.mutate({ kind, id: item.id, to: target })
                            }
                          >
                            {TRANSITION_LABEL[target]}
                          </Button>
                        );
                      })}
                      {moves.some((target) => REVIEW_TRANSITIONS.includes(target)) && own ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ShieldAlert className="h-3 w-3 text-warning" aria-hidden />
                          Self-review is refused by the server, not just hidden here.
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ContentEditor
        kind={kind}
        item={editing}
        parents={parents}
        parentsNotice={
          parentKind && parentList.isLoading
            ? `Loading ${KIND_LABEL[parentKind].toLowerCase()}s…`
            : parentKind && parents.length === 0
              ? `No ${KIND_LABEL[parentKind].toLowerCase()} exists yet — create one first.`
              : undefined
        }
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={refresh}
      />
    </div>
  );
};

export default Faculty;
