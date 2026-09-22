import { supabase } from "@/integrations/supabase/client";

/**
 * The one way this app talks to its server.
 *
 * There are two possible servers and they speak the same contract:
 *
 *   * the Python backend in `backend/` (primary) — set `VITE_API_URL`
 *   * the Supabase Edge Functions in `supabase/functions/` (fallback)
 *
 * Both return `{ error, code }` on failure, with a message written for a human:
 * "the AI tutor is not configured yet", "the embedding service is rate limited".
 * That message is what the UI shows. This wrapper exists so no screen silently
 * swallows it and renders empty or, worse, renders something made up instead.
 *
 * No API key is ever read here. The only credential attached is the signed-in
 * user's own access token, which is exactly what the server needs to work out
 * who is asking — and nothing more.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

/** Which server is in use. Shown on the health screen so this is never a guess. */
export const apiTarget = API_URL ? "python" : "edge";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string = "unknown",
    readonly status: number = 500,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the failure is a missing API key rather than a real fault. */
  get isConfiguration() {
    return this.code.endsWith("not_configured") || this.code === "code_execution_disabled";
  }

  /** True when retrying the same request could plausibly succeed. */
  get isTransient() {
    return (
      this.status === 0 ||
      this.status >= 500 ||
      this.code === "gemini_rate_limited" ||
      this.code === "embeddings_loading"
    );
  }
}

const NETWORK_MESSAGE = "Could not reach the server. Check your connection and try again.";

/** Reads `{ error, code }` out of a Response, whatever shape it arrived in. */
const errorFrom = async (response: Response): Promise<ApiError> => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === "string") {
      return new ApiError(payload.error, payload.code ?? "unknown", response.status);
    }
  } catch {
    // Falls through to the generic message below.
  }
  return new ApiError(
    response.status === 404
      ? "That endpoint does not exist on the server."
      : `The server returned an unexpected ${response.status} response.`,
    "unexpected_response",
    response.status,
  );
};

const callPython = async <T>(
  path: string,
  body: Record<string, unknown> | undefined,
  method: string,
  signal?: AbortSignal,
): Promise<T> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
      method,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(NETWORK_MESSAGE, "network_error", 0);
  }

  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const callEdge = async <T>(name: string, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // supabase-js hides the response body behind error.context.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const payload = await context.json();
        if (payload?.error) {
          throw new ApiError(payload.error, payload.code ?? "unknown", context.status ?? 500);
        }
      } catch (cause) {
        if (cause instanceof ApiError) throw cause;
      }
    }
    throw new ApiError(error.message || NETWORK_MESSAGE, "network_error", 0);
  }

  // A 200 can still carry an error payload if a function returns one directly.
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new ApiError(data.error, (data as { code?: string }).code ?? "unknown", 400);
  }

  return data as T;
};

/**
 * POST to the server. `name` is the endpoint — "quiz-start", "aiva-chat",
 * "diagnostic/start" — and is identical on both deployment paths.
 */
export const callFunction = async <T>(
  name: string,
  body: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> =>
  API_URL ? callPython<T>(name, body, "POST", options.signal) : callEdge<T>(name, body);

/**
 * GET from the server. Only the Python backend serves these; on the Edge path
 * the same data is read straight from Supabase through RLS, so a caller that
 * needs both should read the table rather than call this.
 */
export const getJson = async <T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> => {
  if (!API_URL) {
    throw new ApiError(
      "This screen needs the EduVerse API server. Set VITE_API_URL to point at it.",
      "api_not_configured",
      503,
    );
  }
  return callPython<T>(path, undefined, "GET", options.signal);
};

/**
 * PATCH to the server. Used by the authoring screens, which edit a row the
 * server then re-validates — a client may send only the fields the backend's
 * `EDITABLE` map allows, and `status` is never one of them.
 */
export const patchJson = async <T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> => {
  if (!API_URL) {
    throw new ApiError(
      "This screen needs the EduVerse API server. Set VITE_API_URL to point at it.",
      "api_not_configured",
      503,
    );
  }
  return callPython<T>(path, body, "PATCH");
};

export const deleteJson = async <T>(path: string): Promise<T> => {
  if (!API_URL) {
    throw new ApiError(
      "This screen needs the EduVerse API server. Set VITE_API_URL to point at it.",
      "api_not_configured",
      503,
    );
  }
  return callPython<T>(path, undefined, "DELETE");
};

/** Turns any thrown value into a sentence worth showing a student. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
};
