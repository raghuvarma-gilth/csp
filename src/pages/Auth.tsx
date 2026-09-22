import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import EduVerseBackground from "@/components/EduVerseBackground";

/**
 * Sign in and sign up.
 *
 * There is no role picker here, and there was one before. Choosing "Faculty" on
 * a signup form and having the browser write that choice to `user_roles` is the
 * single most serious thing that was wrong with the prototype: it let anyone
 * grant themselves review and publishing authority over what students read.
 *
 * Every account created here is a student. A role is granted in exactly one
 * way — an administrator approves a request from /request-access — and the
 * database enforces that independently: RLS on `user_roles` rejects an insert
 * from a signed-in browser no matter what this page sends.
 *
 * Errors are shown on the form rather than only in a toast, because a toast the
 * person has already dismissed cannot tell them why the password was refused.
 */

const credentials = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("That does not look like an email address."),
  password: z.string().min(6, "Passwords need at least 6 characters."),
});

/** Supabase's messages are terse and sometimes leak internals. Say the useful thing. */
const readable = (message: string, mode: "signin" | "signup"): string => {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "That email and password do not match an account. Check both, or create an account instead.";
  }
  if (text.includes("email not confirmed")) {
    return "This account still needs to be confirmed. Open the link in the email we sent you.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "There is already an account with this email. Sign in instead.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts in a short time. Wait a minute and try again.";
  }
  if (text.includes("password")) return message;
  return mode === "signin"
    ? `Could not sign in: ${message}`
    : `Could not create the account: ${message}`;
};

const PROMISES = [
  {
    icon: Sparkles,
    title: "A tutor that reads your course",
    body: "Answers are grounded in published material. When the library does not cover something, it says so instead of inventing an answer.",
  },
  {
    icon: GraduationCap,
    title: "Practice aimed at what you got wrong",
    body: "Your weakest concepts come back first, and questions get harder only once you have earned it.",
  },
  {
    icon: ShieldCheck,
    title: "Progress you can check",
    body: "Every percentage on your dashboard is counted from attempts you actually made. Nothing here is decorative.",
  },
];

const Auth = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState<string | null>(null);

  const { signIn, signUp, signInWithOAuth, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* Only same-origin paths are honoured, so a crafted ?next= cannot bounce
     someone to another site with a fresh session in hand. */
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const destination = safeNext ?? "/home";

  /* Already signed in — including arriving back from a confirmation link. */
  useEffect(() => {
    if (!authLoading && user) navigate(destination, { replace: true });
  }, [authLoading, user, destination, navigate]);

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setProblem(null);
    setFieldErrors({});
    setCheckYourEmail(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    setFieldErrors({});

    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") next[field] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(parsed.data.email, parsed.data.password);
        if (error) setProblem(readable(error.message, "signin"));
        /* On success the auth listener fires and the effect above navigates. */
      } else {
        const { error, needsConfirmation } = await signUp(
          parsed.data.email,
          parsed.data.password,
          displayName,
        );
        if (error) {
          setProblem(readable(error.message, "signup"));
        } else if (needsConfirmation) {
          setCheckYourEmail(parsed.data.email);
        }
      }
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

  const handleOAuth = async (provider: "google" | "github") => {
    setProblem(null);
    setBusy(true);
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) setProblem(error.message);
    } catch (cause) {
      setProblem(
        cause instanceof Error
          ? `Could not start ${provider} sign in: ${cause.message}`
          : "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <Helmet>
        <title>{mode === "signin" ? "Sign in" : "Create an account"} · EduVerse</title>
        <meta
          name="description"
          content="Sign in to EduVerse to continue your personalised learning path."
        />
      </Helmet>

      <EduVerseBackground />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-8">
        <header>
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to EduVerse
            </Link>
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
          {/* -------------------------------------------------- left: the pitch */}
          <section className="hidden lg:block">
            <div className="inline-flex items-center gap-3">
              <span className="gradient-primary shadow-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden />
              </span>
              <span className="text-2xl font-bold tracking-tight">EduVerse</span>
            </div>

            <h2 className="mt-8 max-w-md text-4xl font-bold leading-tight tracking-tight">
              Learn smarter.
              <br />
              <span className="text-gradient">Master faster.</span>
            </h2>

            <ul className="mt-8 max-w-md space-y-5">
              {PROMISES.map((promise) => (
                <li key={promise.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <promise.icon className="h-4 w-4 text-primary" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{promise.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {promise.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* -------------------------------------------------- right: the form */}
          <section className="w-full">
            {/* The logo again, for the narrow layout where the pitch is hidden. */}
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <span className="gradient-primary shadow-primary flex h-10 w-10 items-center justify-center rounded-xl">
                <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden />
              </span>
              <span className="text-xl font-bold tracking-tight">EduVerse</span>
            </div>

            {checkYourEmail ? (
              <Card className="surface-card animate-rise">
                <CardContent className="space-y-4 p-7 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                    <MailCheck className="h-6 w-6 text-success" aria-hidden />
                  </span>
                  <div className="space-y-1.5">
                    <h1 className="text-lg font-semibold">Confirm your email</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Your account exists, but this EduVerse installation requires confirmation
                      before you can sign in. We sent a link to{" "}
                      <span className="font-medium text-foreground">{checkYourEmail}</span>. Open it
                      and you will land straight in your dashboard.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nothing in your inbox after a minute or two? Check the spam folder — the message
                    comes from your institution's Supabase project.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => switchMode("signin")}>
                    Back to sign in
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="surface-card animate-rise">
                <CardContent className="p-7">
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">
                      {mode === "signin" ? "Sign in" : "Create your account"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {mode === "signin"
                        ? "Pick up where you left off."
                        : "It takes a minute, and your first diagnostic sets up the rest."}
                    </p>
                  </div>

                  {/* ---- OAuth providers ---- */}
                  <div className="mt-6 space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="h-11 w-full"
                      onClick={() => handleOAuth("google")}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="h-11 w-full"
                      onClick={() => handleOAuth("github")}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                      Continue with GitHub
                    </Button>
                  </div>

                  <div className="relative my-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      or continue with email
                    </span>
                  </div>

                  <form onSubmit={submit} className="space-y-4" noValidate>
                    {mode === "signup" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="displayName" className="flex items-center gap-2 text-xs">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          Display name
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          maxLength={80}
                          autoComplete="name"
                          placeholder="How you want to be shown"
                          className="h-11"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="flex items-center gap-2 text-xs">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="you@university.edu"
                        className="h-11"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      />
                      {fieldErrors.email ? (
                        <p id="email-error" className="text-xs text-destructive">
                          {fieldErrors.email}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="flex items-center gap-2 text-xs">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
                          className="h-11 pr-11"
                          aria-invalid={Boolean(fieldErrors.password)}
                          aria-describedby={fieldErrors.password ? "password-error" : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                      {fieldErrors.password ? (
                        <p id="password-error" className="text-xs text-destructive">
                          {fieldErrors.password}
                        </p>
                      ) : null}
                    </div>

                    {problem ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" aria-hidden />
                        <AlertDescription className="text-xs leading-relaxed">
                          {problem}
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={busy}
                      className="gradient-primary shadow-primary h-11 w-full text-primary-foreground"
                    >
                      {busy
                        ? mode === "signin"
                          ? "Signing in…"
                          : "Creating your account…"
                        : mode === "signin"
                          ? "Sign in"
                          : "Create account"}
                    </Button>
                  </form>

                  <p className="mt-5 text-center text-sm text-muted-foreground">
                    {mode === "signin" ? "New to EduVerse?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {mode === "signin" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* The role rule, stated where someone would otherwise look for a
                role picker. */}
            <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span className="text-left">
                Every new account is a student account. Faculty and reviewer access is requested
                from your profile once you are signed in, and granted only by an administrator.
              </span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Auth;
