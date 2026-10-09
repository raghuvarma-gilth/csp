import { PublicError } from "./http.ts";

/**
 * xAI Grok client. The key lives only in the function environment;
 * it is never sent to, or readable from, the browser.
 *
 * Set it with:  supabase secrets set GROK_API_KEY=...
 *
 * This module mirrors the contract of gemini.ts so the Edge Functions can
 * swap providers transparently.
 */

const MODEL = Deno.env.get("GROK_MODEL") ?? "grok-3-mini-fast";
const ENDPOINT = "https://api.x.ai/v1/chat/completions";

export interface GrokTurn {
  role: "user" | "assistant";
  content: string;
}

interface GenerateOptions {
  system: string;
  turns: GrokTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, Grok is constrained to emit JSON matching this schema. */
  responseSchema?: Record<string, unknown>;
}

const apiKey = () => {
  const key = Deno.env.get("GROK_API_KEY");
  if (!key) {
    throw new PublicError(
      "The AI tutor is not configured yet. An administrator needs to add a Grok API key.",
      503,
      "ai_not_configured",
    );
  }
  return key;
};

export const grokConfigured = () => Boolean(Deno.env.get("GROK_API_KEY"));

export const generate = async ({
  system,
  turns,
  temperature = 0.4,
  maxOutputTokens = 1400,
  responseSchema,
}: GenerateOptions): Promise<string> => {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: system },
    ...turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature,
    max_tokens: maxOutputTokens,
  };

  if (responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: true,
        schema: responseSchema,
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    console.error("Grok request failed:", cause);
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
    console.error("Grok error", response.status, detail);
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

  const choices = payload?.choices;
  if (!choices || choices.length === 0) {
    throw new PublicError(
      "The AI service returned an empty response. Please try again.",
      502,
      "ai_empty",
    );
  }

  const choice = choices[0];
  if (choice?.finish_reason === "content_filter") {
    throw new PublicError(
      "That request was blocked by the AI provider's safety filter. Try rephrasing it.",
      400,
      "ai_blocked",
    );
  }

  const text: string = (choice?.message?.content ?? "").trim();

  if (!text) {
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
    console.error("Grok returned unparseable JSON:", cleaned.slice(0, 500), cause);
    throw new PublicError(
      "The AI service returned malformed content. Please try again.",
      502,
      "ai_malformed",
    );
  }
};
