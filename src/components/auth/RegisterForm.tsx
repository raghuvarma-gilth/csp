import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import {
  EmailField,
  InstitutionField,
  NameField,
  PasswordField,
  ProblemAlert,
} from "@/components/auth/fields";
import { credentials, fieldErrorsFrom, readable, type CredentialField, type IntentCopy } from "@/components/auth/credentials";

/**
 * The body of a registration form.
 *
 * One component serves all three because the three forms differ only in their
 * copy and in whether they collect an institution — everything else (the fields,
 * the validation, the submit path, the confirmation screen) is identical, and
 * three copies of it would be three places to fix the same bug.
 *
 * What the page decides is `copy`; what it never decides is a role. `copy.intent`
 * travels to `signUp` as user metadata, where the signup trigger turns anything
 * other than 'student' into a PENDING row in `role_requests`. No path through
 * this component can write to `user_roles`.
 *
 * The card wrapper and visual chrome are provided by RegisterLayout, so this
 * component renders only the inner content: heading, form fields, and the
 * sign-in fallback link.
 */
const RegisterForm = ({ copy }: { copy: IntentCopy }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CredentialField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState<string | null>(null);

  const { signUp, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* Same same-origin rule as the sign-in page: a crafted ?next= must not bounce
     someone to another site with a fresh session in hand. */
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const destination = safeNext ?? "/home";
  const signInHref = safeNext ? `/auth?next=${encodeURIComponent(safeNext)}` : "/auth";

  /* Already signed in — including arriving back from a confirmation link, which
     is the most likely way to land here twice. */
  useEffect(() => {
    if (!authLoading && user && !checkYourEmail) navigate(destination, { replace: true });
  }, [authLoading, user, checkYourEmail, destination, navigate]);

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
      const { error, needsConfirmation } = await signUp(parsed.data.email, parsed.data.password, {
        displayName,
        intent: copy.intent,
        institution,
      });
      if (error) {
        setProblem(readable(error.message, "signup"));
      } else if (needsConfirmation) {
        setCheckYourEmail(parsed.data.email);
      }
      /* If the project has confirmation switched off, the auth listener fires and
         the effect above navigates — no success screen needed, because the person
         is about to be looking at their dashboard. */
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

  /* ------------------------------------------------------- confirmation */
  if (checkYourEmail) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <MailCheck className="h-7 w-7 text-success" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">Confirm your email</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your account exists, but this EduVerse installation requires confirmation before
            you can sign in. We sent a link to{" "}
            <span className="font-medium text-foreground">{checkYourEmail}</span>. Open it and
            you will land straight in your dashboard.
          </p>
        </div>

        {/* Said here because it is the last chance to say it before the person
            walks away from the screen, and because "I picked professor, why am
            I a student?" is the obvious next question. */}
        {copy.intent !== "student" ? (
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-left">
            <p className="text-xs font-medium">Your {copy.noun} request is in the queue</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              You will sign in as a student. An administrator reviews the request and grants
              contributor access if it checks out — you will see the decision on your profile.
              Nobody, including you, can grant that access from this screen.
            </p>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Nothing in your inbox after a minute or two? Check the spam folder — the message comes
          from your institution's Supabase project.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link to={signInHref}>Back to sign in</Link>
        </Button>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="text-left">
            Faculty, industry and reviewer access is granted only by an administrator, never by the
            browser.
          </span>
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------- the form */
  return (
    <>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.blurb}</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <EmailField value={email} onChange={setEmail} error={fieldErrors.email} />

        <PasswordField
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          mode="signup"
        />

        <NameField value={displayName} onChange={setDisplayName} />

        {copy.institution ? (
          <InstitutionField
            label={copy.institution.label}
            placeholder={copy.institution.placeholder}
            help={copy.institution.help}
            value={institution}
            onChange={setInstitution}
          />
        ) : null}

        <ProblemAlert problem={problem} />

        <Button
          type="submit"
          disabled={busy}
          className="gradient-primary shadow-primary h-11 w-full text-primary-foreground"
        >
          {busy ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <div className="relative my-5">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
          already registered?
        </span>
      </div>

      <Button asChild variant="ghost" className="w-full">
        <Link to={signInHref}>Sign in instead</Link>
      </Button>

      {/* The role rule, stated on every form that offers a choice of role, so that
          picking "Professor" is not mistaken for being granted it. */}
      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-left">
          {copy.intent !== "student"
            ? "Every new account starts as a student account. Registering here sends a request an administrator reviews — the form you filled in cannot grant the role itself."
            : "Every new account starts as a student account. Faculty, industry and reviewer access is granted only by an administrator, never by the browser."}
        </span>
      </p>
    </>
  );
};

export default RegisterForm;
