import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session, Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Authentication.
 *
 * This hook cannot grant a role, and that is deliberate. `signUp` carries a
 * `signupIntent` — what the person said they are on the register form — but it
 * travels as user metadata, which is attacker-controlled by definition, and the
 * only thing the server does with it is open a PENDING row in `role_requests`.
 * The signup trigger writes 'student' to `user_roles` regardless, and RLS on
 * that table refuses an insert from any browser, so a forged intent buys
 * exactly what an honest one does: a request an administrator has to read.
 *
 * `signUp` reports whether the project requires email confirmation instead of
 * assuming. When Supabase returns a user but no session, the account exists and
 * the person has to click a link before they can sign in; telling them
 * "welcome!" and then leaving them on the form would be a lie.
 *
 * `signInWithOAuth` opens the Supabase OAuth flow for a given provider
 * (Google, GitHub, etc.). The redirect URL is built from the current window
 * origin plus a safe `?next=` parameter when one is present.
 */

/** Which registration form was used. Not a role — a request for one. */
export type SignupIntent = "student" | "faculty" | "industry_expert";

interface SignUpDetails {
  displayName?: string;
  /** Defaults to "student", which requests nothing. */
  intent?: SignupIntent;
  /** Shown to the administrator reviewing a faculty/industry request. */
  institution?: string;
}

interface SignUpResult {
  error: Error | null;
  /** True when Supabase created the account but withheld a session pending email confirmation. */
  needsConfirmation: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, details?: SignUpDetails) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, details?: SignUpDetails) => {
    const nextParam = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
    const redirectUrl = `${window.location.origin}${safeNext}`;

    const intent = details?.intent ?? "student";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: details?.displayName?.trim() || email.split("@")[0],
          /* Read by handle_new_user(), which turns anything other than
             'student' into a pending role request. Sending 'admin' here does
             nothing: the trigger ignores it, the role_requests CHECK rejects
             it, and user_roles has no INSERT policy for a browser at all. */
          signup_intent: intent,
          signup_institution: details?.institution?.trim() || null,
        },
      },
    });

    return {
      error: error as Error | null,
      needsConfirmation: Boolean(!error && data.user && !data.session),
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: Provider) => {
    const nextParam = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
    const redirectUrl = `${window.location.origin}${safeNext}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signInWithOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
