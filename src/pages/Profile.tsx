import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, Shield, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, ROLE_NAME, type AppRole } from "@/hooks/useUserRole";
import ThemeToggle from "@/components/ThemeToggle";
import { PageHeader } from "@/components/learning/primitives";
import { ErrorState, LoadingState } from "@/components/states";

/**
 * Profile.
 *
 * The role is shown here and cannot be changed here. It is read from
 * `current_role_for()` on the server, and RLS on `user_roles` rejects a
 * self-insert regardless of what this page does — a student cannot make
 * themselves faculty by editing a form, a request, or local storage. The only
 * route upward is a role request an administrator approves.
 *
 * Everything else on this page writes to the caller's own `profiles` row, which
 * RLS also scopes to them.
 */

const ROLE_EXPLANATION: Record<AppRole, string> = {
  student: "You can learn, practise, and use every student tool.",
  faculty: "You can author course material and review what others submit.",
  research_expert: "You can author research and case studies for review.",
  industry_expert: "You can author real-world case studies and examples for review.",
  admin: "You can approve role requests and publish content.",
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const { role, isLoading: roleLoading, request } = useUserRole();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [bio, setBio] = useState("");
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);
  const [saved, setSaved] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, institution, learning_goal, bio, show_on_leaderboard, created_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setInstitution(profile.data.institution ?? "");
    setLearningGoal(profile.data.learning_goal ?? "");
    setBio(profile.data.bio ?? "");
    setShowOnLeaderboard(profile.data.show_on_leaderboard);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        display_name: displayName.trim() || null,
        institution: institution.trim() || null,
        learning_goal: learningGoal.trim() || null,
        bio: bio.trim() || null,
        show_on_leaderboard: showOnLeaderboard,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  if (profile.isLoading || roleLoading) return <LoadingState label="Loading your profile…" />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Profile"
        title={displayName || user?.email?.split("@")[0] || "Your account"}
        description={user?.email ?? undefined}
      />

      {/* ------------------------------------------------------------- role */}
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-primary" aria-hidden />
            Role
          </CardTitle>
          <CardDescription className="text-xs">
            Set by the server, not by this page. Changing it requires an administrator's approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {role ? ROLE_NAME[role] : "Unknown"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {role ? ROLE_EXPLANATION[role] : "Your role could not be read. Try reloading."}
            </span>
          </div>

          {request ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
              <p className="font-medium">
                {ROLE_NAME[request.requested_role]} request — {request.status}
              </p>
              <p className="mt-1 text-muted-foreground">
                Submitted {new Date(request.created_at).toLocaleDateString()}
                {request.reviewed_at
                  ? ` · reviewed ${new Date(request.reviewed_at).toLocaleDateString()}`
                  : ""}
              </p>
              {request.review_note ? (
                <p className="mt-1 text-muted-foreground">Note: {request.review_note}</p>
              ) : null}
            </div>
          ) : null}

          {role === "student" && (!request || request.status === "rejected") ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/request-access">Request contributor access</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- details */}
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-primary" aria-hidden />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-xs">
                Display name
              </Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                placeholder="How you want to be shown"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution" className="text-xs">
                Institution
              </Label>
              <Input
                id="institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                maxLength={120}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal" className="text-xs">
              What are you working towards?
            </Label>
            <Input
              id="goal"
              value={learningGoal}
              onChange={(event) => setLearningGoal(event.target.value)}
              maxLength={160}
              placeholder="e.g. Be comfortable with stacks and queues before exams"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-xs">
              About you
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Optional"
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="leaderboard" className="text-xs">
                Show my name on shared boards
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Off by default. Your progress is never shown to other students unless this is on.
              </p>
            </div>
            <Switch
              id="leaderboard"
              checked={showOnLeaderboard}
              onCheckedChange={setShowOnLeaderboard}
            />
          </div>

          {save.error ? <ErrorState error={save.error} onRetry={() => save.mutate()} /> : null}

          <div className="flex items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
            {saved ? (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Saved
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- appearance */}
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Light, dark, or whatever your system is set to.
          </p>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- account */}
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Account</CardTitle>
          <CardDescription className="text-xs">
            Signed in as {user?.email}
            {profile.data?.created_at
              ? ` · joined ${new Date(profile.data.created_at).toLocaleDateString()}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
