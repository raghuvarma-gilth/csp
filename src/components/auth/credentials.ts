import { z } from "zod";
import type { SignupIntent } from "@/hooks/useAuth";

/**
 * The one validation rule for every form in the auth section.
 *
 * Sign-in and all three registration forms ask for the same two things — an
 * email and a password — and a form that accepts a password the sign-in form
 * would reject is a bug with no upside. So those rules live here once.
 *
 * The password rule is the minimum, not a strength meter: Supabase enforces its
 * own minimum server-side, and a second opinion in the browser would either
 * contradict it or invent a policy that is not actually applied.
 */
export const credentials = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("That does not look like an email address."),
  password: z.string().min(6, "Passwords need at least 6 characters."),
});

export type Credentials = z.infer<typeof credentials>;
export type CredentialField = keyof Credentials;

/**
 * Split zod's report into a per-field lookup.
 *
 * Only the first issue per field is kept: a person does not need three sentences
 * about one malformed email, and the field can only show one at a time.
 */
export function fieldErrorsFrom(error: z.ZodError): Partial<Record<CredentialField, string>> {
  const found: Partial<Record<CredentialField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "password") found[field] ??= issue.message;
  }
  return found;
}

/**
 * Supabase's auth errors are terse ("Invalid login credentials", "Email not
 * confirmed") and occasionally leak internals. None of that is written for the
 * person reading it, so each known case is replaced with what it means and what
 * to do about it. Unknown messages are surfaced rather than swallowed — a
 * generic "something went wrong" would hide the one detail that makes it
 * fixable.
 */
export function readable(
  message: string,
  mode: "signin" | "signup",
): string {
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
  /* Supabase rejects emails whose domain does not exist or does not accept mail.
     This is the most common reason a registration "does nothing" — the error is
     returned but easy to miss if it isn't explained clearly. */
  if (text.includes("is invalid") && text.includes("email")) {
    return "That email address was rejected by the server. Use a real email address (e.g. your university or work email) — temporary and non-existent domains are blocked.";
  }
  if (text.includes("password")) return message;
  return mode === "signin"
    ? `Could not sign in: ${message}`
    : `Could not create the account: ${message}`;
}

/**
 * One shape describing each registration form.
 *
 * This describes a *form*, not a role. `intent` is what the person said they
 * are; the only thing it can do is open a pending row in `role_requests` for an
 * administrator to read. Nothing here grants anything — see the note in
 * `useAuth.tsx`, which sends the value as user metadata that the server treats
 * as untrusted.
 */
export interface IntentCopy {
  /** What is sent as `signup_intent`. */
  intent: SignupIntent;
  /** Used in page titles and the confirmation screen. */
  noun: string;
  heading: string;
  blurb: string;
  /** Omitted when the form does not collect one. */
  institution?: { label: string; placeholder: string; help: string };
}

export const STUDENT_COPY: IntentCopy = {
  intent: "student",
  noun: "student",
  heading: "Create your student account",
  blurb:
    "Free, and available straight away. Your first diagnostic sets up everything after it.",
};

export const FACULTY_COPY: IntentCopy = {
  intent: "faculty",
  noun: "faculty",
  heading: "Register as a professor or teacher",
  blurb: "Author course material for students. An administrator reviews the request before you can.",
  institution: {
    label: "Institution",
    placeholder: "Where you teach",
    help: "You will sign in as a student today. An administrator reviews the request and grants contributor access if it checks out.",
  },
};

export const INDUSTRY_COPY: IntentCopy = {
  intent: "industry_expert",
  noun: "industry",
  heading: "Register as an industry professional",
  blurb:
    "Contribute real-world applications, case studies and worked code alongside the curriculum.",
  institution: {
    label: "Company",
    placeholder: "Where you work",
    help: "You will sign in as a student today. An administrator reviews the request and grants contributor access if it checks out.",
  },
};
