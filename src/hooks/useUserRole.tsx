import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "student" | "faculty" | "research_expert" | "admin";

export type RoleRequestStatus = "pending" | "approved" | "rejected";

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
  isAdmin: boolean;
  refresh: () => Promise<void>;
  submitRoleRequest: (input: {
    requestedRole: Exclude<AppRole, "student" | "admin">;
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
