import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole =
  | "student"
  | "faculty"
  | "research_expert"
  | "industry_expert"
  | "admin";

/** The roles a person can ask for. `admin` is granted out of band, never requested. */
export type RequestableRole = Exclude<AppRole, "student" | "admin">;

export type RoleRequestStatus = "pending" | "approved" | "rejected";

/** How a role is written in prose. The single source for role labels in the UI. */
export const ROLE_NAME: Record<AppRole, string> = {
  student: "Student",
  faculty: "Faculty",
  research_expert: "Research expert",
  industry_expert: "Industry professional",
  admin: "Administrator",
};

/**
 * Where a role starts.
 *
 * Four roles, four landing pages — a professor signing in wants their review
 * queue, not a day streak. `null` is "we do not know yet": the role is resolved
 * by a round trip, so callers must wait rather than send everybody to /home and
 * bounce the three staff roles a moment later.
 *
 * This is navigation, not permission. Typing another role's path in the address
 * bar still reaches ProtectedRoute, which asks the server, and every query
 * behind it is checked again by RLS.
 */
export const DASHBOARD_FOR: Record<AppRole, string> = {
  student: "/home",
  faculty: "/faculty",
  research_expert: "/research",
  industry_expert: "/industry",
  admin: "/admin",
};

export const dashboardFor = (role: AppRole | null): string =>
  role ? DASHBOARD_FOR[role] : "/home";

export interface RoleRequest {
  id: string;
  requested_role: AppRole;
  status: string;
  justification: string;
  institution: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface UserRoleContextValue {
  /** Server-resolved role. Never inferred from anything the browser stores. */
  role: AppRole | null;
  isLoading: boolean;
  error: string | null;
  /** The caller's most recent elevation request, if any. */
  request: RoleRequest | null;
  isFaculty: boolean;
  isResearchExpert: boolean;
  isIndustryExpert: boolean;
  /** May author material for review. Never use this to gate an approval. */
  isContributor: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  submitRoleRequest: (input: {
    requestedRole: RequestableRole;
    justification: string;
    institution?: string;
  }) => Promise<{ error: string | null }>;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

/**
 * Roles are read from the database through current_role_for(), a SECURITY
 * DEFINER function, and there is deliberately no client-side write path.
 * Elevation happens only through role_requests + an admin running
 * review_role_request(). RLS on user_roles rejects a self-insert regardless of
 * what this file does, so the two agree.
 */
export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [request, setRequest] = useState<RoleRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRole(null);
      setRequest(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [roleResult, requestResult] = await Promise.all([
      supabase.rpc("current_role_for", { _user_id: user.id }),
      supabase
        .from("role_requests")
        .select("id, requested_role, status, justification, institution, review_note, created_at, reviewed_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (roleResult.error) {
      setRole(null);
      setError(roleResult.error.message);
    } else {
      setRole((roleResult.data as AppRole | null) ?? null);
    }

    // A missing role_requests row is the normal case, not an error.
    setRequest(requestResult.error ? null : (requestResult.data as RoleRequest | null));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const submitRoleRequest: UserRoleContextValue["submitRoleRequest"] = useCallback(
    async ({ requestedRole, justification, institution }) => {
      if (!user) return { error: "You must be signed in to request a role." };

      const { error: insertError } = await supabase.from("role_requests").insert({
        user_id: user.id,
        requested_role: requestedRole,
        justification: justification.trim(),
        institution: institution?.trim() || null,
      });

      if (insertError) {
        // The partial unique index allows exactly one pending request per user.
        if (insertError.code === "23505") {
          return { error: "You already have a request awaiting review." };
        }
        if (insertError.code === "23514") {
          return { error: "Please describe your role in at least 20 characters." };
        }
        return { error: insertError.message };
      }

      await load();
      return { error: null };
    },
    [user, load],
  );

  const value = useMemo<UserRoleContextValue>(
    () => ({
      role,
      isLoading: authLoading || isLoading,
      error,
      request,
      isFaculty: role === "faculty" || role === "admin",
      isResearchExpert: role === "research_expert" || role === "admin",
      isIndustryExpert: role === "industry_expert" || role === "admin",
      isContributor:
        role === "faculty" ||
        role === "research_expert" ||
        role === "industry_expert" ||
        role === "admin",
      isAdmin: role === "admin",
      refresh: load,
      submitRoleRequest,
    }),
    [role, authLoading, isLoading, error, request, load, submitRoleRequest],
  );

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error("useUserRole must be used within a UserRoleProvider");
  }
  return context;
};
