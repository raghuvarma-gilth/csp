import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Inbox,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, StatTile } from "@/components/learning/primitives";
import { ConfigNotice, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiTarget, callFunction, errorMessage, getJson } from "@/lib/api";

/**
 * Administration.
 *
 * This is the only screen in the product from which a non-student role is ever
 * granted, and it grants one in exactly one way: by approving a request somebody
 * else submitted. There is no field here for typing a user id and a role,
 * because there is no such endpoint — `review_role_request` is the single write
 * path to `user_roles`, and RLS refuses every other one, including a self-insert
 * from a signed-in browser.
 *
 * Administrator is not in the list of grantable roles. It is created out of
 * band, by someone with database access, and nothing in this application can
 * mint one.
 */

type RequestStatus = "pending" | "approved" | "rejected";

interface RoleRequest {
  id: string;
  user_id: string;
  requested_role: "faculty" | "research_expert";
  justification: string;
  institution: string | null;
  status: RequestStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  displayName: string | null;
}

interface PersonRow {
  userId: string;
  displayName: string | null;
  joinedAt: string | null;
  roles: string[];
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  research_expert: "Research expert",
  admin: "Administrator",
};

const ROLE_BADGE: Record<string, string> = {
  faculty: "border-primary/40 bg-primary/10 text-primary",
  research_expert: "border-info/40 bg-info/10 text-info",
  admin: "border-warning/40 bg-warning/10 text-warning",
};

const TABS: Array<{ value: RequestStatus; label: string }> = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<RequestStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const configured = apiTarget === "python";

  const requests = useQuery({
    queryKey: ["role-requests", tab],
    enabled: configured,
    queryFn: () => getJson<{ requests: RoleRequest[] }>(`role-requests?status=${tab}`),
  });

  const people = useQuery({
    queryKey: ["admin-users"],
    enabled: configured,
    queryFn: () => getJson<{ users: PersonRow[] }>("admin/users"),
  });

  const review = useMutation({
    mutationFn: (input: { requestId: string; decision: "approved" | "rejected"; note?: string }) =>
      callFunction("role-requests/review", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["role-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["content-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["user-role"] });
    },
  });

  if (!configured) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Administration" title="People and access" />
        <ConfigNotice message="Administration talks to the EduVerse API server, which is not configured in this build. Set VITE_API_URL to the address of the backend and reload. Until then no role can be reviewed from this screen — which is the correct behaviour, not a failure." />
      </div>
    );
  }

  const rows = requests.data?.requests ?? [];
  const staff = people.data?.users ?? [];
  const roleCount = (role: string) =>
    staff.filter((person) => person.roles.includes(role)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="People and access"
        description="Approving a request is the only way a role is granted in EduVerse. Nothing on this screen can grant an administrator."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="People"
          value={people.data ? String(staff.length) : "—"}
          icon={<Users className="h-4 w-4" aria-hidden />}
          tone="primary"
        />
        <StatTile label="Faculty" value={people.data ? String(roleCount("faculty")) : "—"} />
        <StatTile
          label="Research experts"
          value={people.data ? String(roleCount("research_expert")) : "—"}
        />
        <StatTile
          label="Administrators"
          value={people.data ? String(roleCount("admin")) : "—"}
          hint="granted out of band"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
      </div>

      {/* ----------------------------------------------------- role requests */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Inbox className="h-4 w-4" aria-hidden />
          Role requests
        </h2>

        <Tabs value={tab} onValueChange={(value) => setTab(value as RequestStatus)}>
          <TabsList>
            {TABS.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="text-xs">
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {review.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription className="text-xs">{errorMessage(review.error)}</AlertDescription>
          </Alert>
        ) : null}

        {requests.isLoading ? (
          <LoadingState label="Loading requests…" />
        ) : requests.error ? (
          <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
        ) : rows.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<Inbox className="h-8 w-8" aria-hidden />}
                title={tab === "pending" ? "Nothing waiting" : `No ${tab} requests`}
                description={
                  tab === "pending"
                    ? "Every request has been dealt with. New ones arrive here as soon as they are submitted."
                    : "Requests appear here once they have been reviewed."
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const own = row.user_id === user?.id;
              const note = notes[row.id] ?? "";
              const busy = review.isPending && review.variables?.requestId === row.id;

              return (
                <Card key={row.id} className="surface-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            {row.displayName ?? "A student with no display name set"}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${ROLE_BADGE[row.requested_role] ?? ""}`}
                          >
                            wants {ROLE_LABEL[row.requested_role]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.institution ? `${row.institution} · ` : ""}
                          submitted {new Date(row.created_at).toLocaleDateString()}
                          {row.reviewed_at
                            ? ` · reviewed ${new Date(row.reviewed_at).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed">
                      {row.justification}
                    </p>

                    {row.review_note ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Decision note:</span> {row.review_note}
                      </p>
                    ) : null}

                    {row.status === "pending" ? (
                      own ? (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ShieldAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
                          This is your own request. Another administrator has to review it — the
                          server refuses it from you.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={note}
                            onChange={(event) =>
                              setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                            }
                            maxLength={500}
                            placeholder="Optional note — the requester sees this"
                            className="text-xs"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={review.isPending}
                              onClick={() =>
                                review.mutate({
                                  requestId: row.id,
                                  decision: "approved",
                                  note: note.trim() || undefined,
                                })
                              }
                            >
                              <Check className="mr-2 h-3.5 w-3.5" aria-hidden />
                              {busy ? "Working…" : `Grant ${ROLE_LABEL[row.requested_role]}`}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review.isPending}
                              onClick={() =>
                                review.mutate({
                                  requestId: row.id,
                                  decision: "rejected",
                                  note: note.trim() || undefined,
                                })
                              }
                            >
                              <X className="mr-2 h-3.5 w-3.5" aria-hidden />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ people */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <UserCog className="h-4 w-4" aria-hidden />
          Who holds what
        </h2>

        {people.isLoading ? (
          <LoadingState label="Loading people…" />
        ) : people.error ? (
          <ErrorState error={people.error} onRetry={() => void people.refetch()} />
        ) : staff.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-0">
              <EmptyState
                icon={<Users className="h-8 w-8" aria-hidden />}
                title="No accounts yet"
                description="Nobody has signed up on this installation."
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="surface-card overflow-x-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Read from user_roles</CardTitle>
              <CardDescription className="text-xs">
                This table is the authoritative record of who can do what. A role is added to it
                only by approving a request above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="pb-2 pr-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Person
                    </th>
                    <th className="pb-2 pr-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Roles
                    </th>
                    <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((person) => (
                    <tr key={person.userId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-medium">
                          {person.displayName ?? "No display name"}
                        </span>
                        {person.userId === user?.id ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="flex flex-wrap gap-1">
                          {person.roles.length === 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              Student
                            </Badge>
                          ) : (
                            person.roles.map((role) => (
                              <Badge
                                key={role}
                                variant="outline"
                                className={`text-[10px] ${ROLE_BADGE[role] ?? ""}`}
                              >
                                {ROLE_LABEL[role] ?? role}
                              </Badge>
                            ))
                          )}
                        </span>
                      </td>
                      <td className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {person.joinedAt
                          ? new Date(person.joinedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <Card className="surface-card border-primary/20">
        <CardContent className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            There is no way to type a role onto an account here, and no request path to
            administrator exists at all — an administrator is created directly in the database by
            someone with access to it. Approving a request is the only write this application ever
            makes to <code className="font-mono">user_roles</code>, and the table's policies refuse
            every other one, including a browser trying to insert a row for itself.
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
