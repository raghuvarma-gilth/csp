import { PublicError } from "./http.ts";

/**
 * Direct Google Gemini client. The key lives only in the function environment;
 * it is never sent to, or readable from, the browser.
 *
 * Set it with:  supabase secrets set GEMINI_API_KEY=...
 */

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiTurn {
  role: "user" | "assistant";
  content: string;
}

interface GenerateOptions {
  system: string;
  turns: GeminiTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, Gemini is constrained to emit JSON matching this schema. */
  responseSchema?: Record<string, unknown>;
}

const apiKey = () => {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new PublicError(
      "The AI tutor is not configured yet. An administrator needs to add a Gemini API key.",
      503,
      "ai_not_configured",
    );
  }
  return key;
};

export const geminiConfigured = () => Boolean(Deno.env.get("GEMINI_API_KEY"));

export const generate = async ({
  system,
  turns,
  temperature = 0.4,
  maxOutputTokens = 1400,
  responseSchema,
}: GenerateOptions): Promise<string> => {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(responseSchema
        ? { responseMimeType: "application/json", responseSchema }
        : {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    console.error("Gemini request failed:", cause);
    throw new PublicError(
      "Could not reach the AI service. Please try again in a moment.",
      502,
      "ai_unreachable",
    );
  }

  if (response.status === 429) {
    throw new PublicError(
      "The AI service is rate limited right now. Try again shortly.",
      429,
      "ai_rate_limited",
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini error", response.status, detail);
    if (response.status === 400 || response.status === 403) {
      throw new PublicError(
        "The AI service rejected the configured API key.",
        502,
        "ai_not_configured",
      );
    }
    throw new PublicError("The AI service returned an error.", 502, "ai_error");
  }

  const payload = await response.json();

  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new PublicError(
      "That request was blocked by the AI provider's safety filter. Try rephrasing it.",
      400,
      "ai_blocked",
    );
  }

  const text: string =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    // An empty candidate is a real failure, not something to paper over with a
    // canned reply — the caller surfaces it as an error.
    throw new PublicError(
      "The AI service returned an empty response. Please try again.",
      502,
      "ai_empty",
    );
  }

  return text;
};

/** Generates and parses JSON. Throws if the model did not return valid JSON. */
export const generateJson = async <T>(
  options: GenerateOptions & { responseSchema: Record<string, unknown> },
): Promise<T> => {
  const raw = await generate({ ...options, temperature: options.temperature ?? 0.25 });
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (cause) {
    console.error("Gemini returned unparseable JSON:", cleaned.slice(0, 500), cause);
    throw new PublicError(
      "The AI service returned malformed content. Please try again.",
      502,
      "ai_malformed",
    );
  }
};
