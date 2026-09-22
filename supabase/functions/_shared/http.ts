/**
 * Shared CORS + response helpers for every EduVerse Edge Function.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * A failure the user is allowed to see. Anything else is logged server-side and
 * reported generically, so internal detail never reaches the browser.
 */
export class PublicError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "bad_request",
  ) {
    super(message);
    this.name = "PublicError";
  }
}

export const handleError = (error: unknown) => {
  if (error instanceof PublicError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("Unhandled edge function error:", error);
  return json(
    {
      error: "Something went wrong on our side. Please try again.",
      code: "internal_error",
    },
    500,
  );
};

export const preflight = (req: Request) =>
  req.method === "OPTIONS" ? new Response(null, { headers: corsHeaders }) : null;
