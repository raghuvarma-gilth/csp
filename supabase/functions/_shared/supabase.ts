import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { PublicError } from "./http.ts";

export interface Caller {
  id: string;
  email: string | null;
}

const url = () => {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new PublicError("Server is not configured.", 500, "not_configured");
  return value;
};

/**
 * Service-role client. Used for the writes a student must not be able to make
 * directly — mastery, attempts, achievements — and for reading quiz answer
 * keys, which no client-side policy exposes.
 */
export const adminClient = (): SupabaseClient => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new PublicError("Server is not configured.", 500, "not_configured");
  return createClient(url(), key, { auth: { persistSession: false } });
};

/**
 * Resolves the caller from the Authorization header. The user id is never read
 * from the request body — that would let anyone write to anyone's record.
 */
export const requireUser = async (req: Request): Promise<Caller> => {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new PublicError("Sign in to continue.", 401, "unauthenticated");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) {
    throw new PublicError("Your session has expired. Sign in again.", 401, "unauthenticated");
  }
  return { id: data.user.id, email: data.user.email ?? null };
};

/** True when the caller holds faculty or admin. */
export const callerIsFaculty = async (userId: string): Promise<boolean> => {
  const { data, error } = await adminClient().rpc("is_faculty", { _user_id: userId });
  if (error) throw new PublicError("Could not verify your access.", 500, "role_check_failed");
  return data === true;
};

export const requireFaculty = async (userId: string) => {
  if (!(await callerIsFaculty(userId))) {
    throw new PublicError("This action is limited to faculty accounts.", 403, "forbidden");
  }
};
