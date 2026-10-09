import { useState, type ReactNode } from "react";
import { AlertCircle, Building2, Eye, EyeOff, Lock, Mail, User as UserIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The form controls shared by sign-in and all three registration forms.
 *
 * These exist so that the same field cannot be labelled two different ways on
 * two different screens, and so that the accessibility wiring — a real label, an
 * `aria-invalid`, and an error paragraph tied to the input by id — is written
 * once. Every one of them is controlled: the parent owns the value, because the
 * parent is what submits it.
 */

/** A field's own error, announced rather than merely coloured. */
const FieldError = ({ id, children }: { id: string; children?: string }) =>
  children ? (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  ) : null;

const FieldLabel = ({
  htmlFor,
  icon: Icon,
  children,
  optional = false,
}: {
  htmlFor: string;
  icon: typeof Mail;
  children: ReactNode;
  optional?: boolean;
}) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
    {children}
    {optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
  </Label>
);

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

export const EmailField = ({
  value,
  onChange,
  error,
  placeholder = "you@university.edu",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <FieldLabel htmlFor="email" icon={Mail}>
      Email
    </FieldLabel>
    <Input
      id="email"
      type="email"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="email"
      placeholder={placeholder}
      className="h-11"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? "email-error" : undefined}
    />
    <FieldError id="email-error">{error}</FieldError>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Password                                                                    */
/* -------------------------------------------------------------------------- */

export const PasswordField = ({
  value,
  onChange,
  error,
  /** Sign-in keeps the browser from offering a new password; registration does the opposite. */
  mode,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  mode: "signin" | "signup";
}) => {
  const [shown, setShown] = useState(false);
  const signingIn = mode === "signin";

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor="password" icon={Lock}>
        Password
      </FieldLabel>
      <div className="relative">
        <Input
          id="password"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={signingIn ? "current-password" : "new-password"}
          placeholder={signingIn ? "Your password" : "At least 6 characters"}
          className="h-11 pr-11"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "password-error" : undefined}
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label={shown ? "Hide password" : "Show password"}
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <FieldError id="password-error">{error}</FieldError>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Display name                                                                */
/* -------------------------------------------------------------------------- */

export const NameField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <FieldLabel htmlFor="displayName" icon={UserIcon} optional>
      Display name
    </FieldLabel>
    <Input
      id="displayName"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={80}
      autoComplete="name"
      placeholder="How you want to be shown"
      className="h-11"
    />
  </div>
);

/* -------------------------------------------------------------------------- */
/* Institution / company                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Asked only on the faculty and industry forms, and only because it is what the
 * reviewing administrator has to go on. It is a self-declaration; the help text
 * says so, and so does the justification the signup trigger writes.
 */
export const InstitutionField = ({
  label,
  placeholder,
  help,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <FieldLabel htmlFor="institution" icon={Building2} optional>
      {label}
    </FieldLabel>
    <Input
      id="institution"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={120}
      autoComplete="organization"
      placeholder={placeholder}
      className="h-11"
    />
    <p className="text-[11px] leading-relaxed text-muted-foreground">{help}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Problem alert                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A failed attempt is reported on the form, not only in a toast. A toast the
 * person has already dismissed cannot tell them why the password was refused.
 */
export const ProblemAlert = ({ problem }: { problem: string | null }) =>
  problem ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" aria-hidden />
      <AlertDescription className="text-xs leading-relaxed">{problem}</AlertDescription>
    </Alert>
  ) : null;
