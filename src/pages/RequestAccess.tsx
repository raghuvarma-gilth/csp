import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserRole, ROLE_NAME, type RequestableRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/learning/primitives";
import { LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * Request elevated access.
 *
 * This form writes a row to `role_requests`. It does not grant anything. An
 * administrator runs `review_role_request()`, and only that function writes to
 * `user_roles` — RLS blocks a self-insert from any client, so nothing typed
 * here can promote the person typing it.
 *
 * Administrator is deliberately absent from the list below. Admin is granted
 * out-of-band, by an existing administrator, and there is no request path to it
 * at all.
 *
 * Someone who registered at `/register/faculty` or `/register/industry` already
 * has a pending row here, opened by the signup trigger, and will land on the
 * awaiting-review card rather than the form. That is the same queue and the same
 * review; those two forms are just another door into it.
 */

const OPTIONS = [
  {
    value: "faculty" as const,
    title: "Faculty",
    description:
      "Author concepts, lessons, quizzes and coding problems, and submit them for review. You will not be able to publish your own work — that needs a reviewer.",
  },
  {
    value: "research_expert" as const,
    title: "Research expert",
    description:
      "Review material other people submitted and approve or return it. You will not be able to review anything you authored yourself.",
  },
  {
    value: "industry_expert" as const,
    title: "Industry professional",
    description:
      "Contribute real-world applications, case studies and worked code alongside the curriculum. Faculty review it before students see it, and it carries no review or publishing authority of its own.",
  },
];

const MIN_JUSTIFICATION = 20;

const RequestAccess = () => {
  const { role, request, isLoading, submitRoleRequest } = useUserRole();

  const [requestedRole, setRequestedRole] = useState<RequestableRole>("faculty");
  const [justification, setJustification] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) return <LoadingState label="Checking your access…" />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await submitRoleRequest({ requestedRole, justification, institution });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    setJustification("");
  };

  /* Already elevated — nothing to ask for. */
  if (role && role !== "student") {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader eyebrow="Access" title="You already have elevated access" />
        <Card className="surface-card border-success/40">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              Your account is {ROLE_NAME[role].toLowerCase()} level.
            </p>
            <div className="flex flex-wrap gap-2">
              {(role === "faculty" || role === "admin") && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/faculty">Faculty workspace</Link>
                </Button>
              )}
              {(role === "research_expert" || role === "industry_expert" || role === "admin") && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/research">Contribution workspace</Link>
                </Button>
              )}
              {role === "admin" && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin">Administration</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaiting = request?.status === "pending" || submitted;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Access"
        title="Request contributor access"
        description="Tell us who you are and what you intend to publish. An administrator reads every request before anything changes."
      />

      {awaiting ? (
        <Card className="surface-card border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning" aria-hidden />
              Awaiting review
            </CardTitle>
            <CardDescription className="text-xs">
              One request can be open at a time. You will see the outcome here and on your profile.
            </CardDescription>
          </CardHeader>
          {request ? (
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                <Badge variant="outline" className="mr-1.5 text-[10px]">
                  {ROLE_NAME[request.requested_role]}
                </Badge>
                submitted {new Date(request.created_at).toLocaleDateString()}
              </p>
              <p className="whitespace-pre-wrap">{request.justification}</p>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {request?.status === "rejected" ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" aria-hidden />
          <AlertDescription className="text-xs">
            Your last request was not approved
            {request.review_note ? `: ${request.review_note}` : "."} You can submit a new one.
          </AlertDescription>
        </Alert>
      ) : null}

      {!awaiting ? (
        <form onSubmit={submit} className="space-y-5">
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">What do you need?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={requestedRole}
                onValueChange={(value) => setRequestedRole(value as typeof requestedRole)}
                className="space-y-2"
              >
                {OPTIONS.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      requestedRole === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:border-primary/40",
                    )}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">{option.title}</span>
                      <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="institution" className="text-xs">
                  Institution or organisation
                </Label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                  maxLength={120}
                  placeholder="Where you teach, research or work"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="justification" className="text-xs">
                  Why do you need this access?
                </Label>
                <Textarea
                  id="justification"
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="What you teach or review, and what you plan to publish here."
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  {justification.trim().length} / {MIN_JUSTIFICATION} characters minimum
                </p>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" aria-hidden />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={pending || justification.trim().length < MIN_JUSTIFICATION}
              >
                {pending ? "Submitting…" : "Submit request"}
              </Button>
            </CardContent>
          </Card>
        </form>
      ) : null}

      <Card className="surface-card border-primary/20">
        <CardContent className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Submitting this form changes nothing about your account. Roles are written only by an
            administrator action on the server; the database rejects any attempt by a browser to
            grant one, including this one.
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestAccess;
