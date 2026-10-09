import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, GraduationCap, Presentation, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { dashboardFor, useUserRole } from "@/hooks/useUserRole";
import AuthShell, { AuthCard } from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { EmailField, PasswordField, ProblemAlert } from "@/components/auth/fields";
import { credentials, fieldErrorsFrom, readable, type CredentialField } from "@/components/auth/credentials";

/**
 * Sign in.
 *
 * Registration lives at `/register` and its two role variants; this page no
 * longer contains any of it. The split is not cosmetic — the previous page asked
 * a person to choose between "sign in" and "create an account" before they had
 * done either, and the register half of it carried a role picker that had to be
 * explained away in a disclaimer. Signing in is one job and it is now the only
 * thing this page does.
 *
 * The role picker is gone from here entirely, but nothing about the security
 * model changed when it moved: what the register forms send is an *intent*, every
 * account created is a student account, and only an administrator approving a
 * request in `role_requests` ever changes a role. `/register/faculty` says so on
 * the page rather than implying it.
 */

/* The three register forms, offered as the three doors they are. `student` is
   the bare path and the default. */
const REGISTER_LINKS = [
  {
    to: "/register",
    icon: GraduationCap,
    title: "Student",
    body: "Free, and available straight away.",
  },
  {
    to: "/register/faculty",
    icon: Presentation,
    title: "Professor / teacher",
    body: "Author course material, once approved.",
  },
  {
    to: "/register/industry",
    icon: Briefcase,
    title: "Industry professional",
    body: "Contribute real-world cases, once approved.",
  },
];

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CredentialField, string>>>({});
  const [busy, setBusy] = useState(false);

  const { signIn, user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* Only same-origin paths are honoured, so a crafted ?next= cannot bounce
     someone to another site with a fresh session in hand. */
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  /* Carried on to the register links, so signing up from a guarded page still
     lands on the page the person was trying to reach. */
  const registerSuffix = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";

  /* Already signed in — including arriving back from a confirmation link.
     An explicit ?next= wins, because the person was on their way somewhere and
     the guard will re-check that destination anyway. Otherwise the role decides:
     a professor signing in wants their review queue, and sending them to /home
     only to have Home bounce them here again would be two round trips and a
     flash of the wrong dashboard. `role` is resolved by a query, so this waits
     rather than guessing — a null role at rest means the account has none. */
  const destination = safeNext ?? dashboardFor(role);
  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (user) navigate(destination, { replace: true });
  }, [authLoading, roleLoading, user, destination, navigate]);

  /* This page used to host registration behind `?mode=signup`. Anything already
     pointing at that — a bookmark, an email, a screenshot someone typed out —
     lands on the student form instead of a sign-in page that ignores the
     parameter. Rendered as a redirect rather than an effect so it happens before
     the sign-in form paints. */
  if (searchParams.get("mode") === "signup") {
    return <Navigate to={`/register${registerSuffix}`} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    setFieldErrors({});

    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setBusy(true);
    try {
      const { error } = await signIn(parsed.data.email, parsed.data.password);
      if (error) setProblem(readable(error.message, "signin"));
      /* On success the auth listener fires and the effect above navigates. */
    } catch (cause) {
      setProblem(
        cause instanceof Error
          ? `Could not reach the server: ${cause.message}`
          : "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in">
      <AuthCard>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Pick up where you left off.</p>
        </div>

        <div className="mt-6">
          <OAuthButtons onProblem={setProblem} />
        </div>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            or continue with email
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <EmailField value={email} onChange={setEmail} error={fieldErrors.email} />
          <PasswordField
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            mode="signin"
          />
          <ProblemAlert problem={problem} />

          <Button
            type="submit"
            disabled={busy}
            className="gradient-primary shadow-primary h-11 w-full text-primary-foreground"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthCard>

      {/* ------------------------------------------------ the three doors ---- */}
      <div className="mt-6">
        <div className="relative mb-4">
          <Separator />
          {/* `bg-background`, not `bg-transparent`: this divider sits on the page
              rather than inside the card, and the rule has to be masked behind the
              text or it runs straight through it. */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            new to EduVerse?
          </span>
        </div>

        <ul className="space-y-2">
          {REGISTER_LINKS.map((option) => (
            <li key={option.to}>
              <Link
                to={`${option.to}${registerSuffix}`}
                className="group flex items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <option.icon className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">Register as {option.title.toLowerCase()}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {option.body}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-left">
          Every new account starts as a student account. Faculty, industry and reviewer access is
          granted only by an administrator, never by the browser.
        </span>
      </p>
    </AuthShell>
  );
};

export default Auth;
