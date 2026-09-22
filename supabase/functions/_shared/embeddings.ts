import { PublicError } from "./http.ts";

/**
 * Hugging Face Inference API — sentence embeddings for the retrieval layer.
 *
 * The model is fixed at 384 dimensions to match `vector(384)` in
 * content_chunks. Changing it means changing that column and re-embedding
 * everything, so it is intentionally not a per-request parameter.
 *
 * Set the key with:  supabase secrets set HUGGINGFACE_API_KEY=...
 */

export const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

const ENDPOINT =
  `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;

export const embeddingsConfigured = () => Boolean(Deno.env.get("HUGGINGFACE_API_KEY"));

const apiKey = () => {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) {
    throw new PublicError(
      "Course-material search is not configured yet. An administrator needs to add a Hugging Face API key.",
      503,
      "embeddings_not_configured",
    );
  }
  return key;
};

const isNumberMatrix = (value: unknown): value is number[][] =>
  Array.isArray(value) && Array.isArray(value[0]) && typeof value[0][0] === "number";

/** Embeds a batch of texts. Order of the result matches the input. */
export const embed = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    });
  } catch (cause) {
    console.error("Hugging Face request failed:", cause);
    throw new PublicError(
      "Could not reach the embedding service. Please try again.",
      502,
      "embeddings_unreachable",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new PublicError(
      "The embedding service rejected the configured API key.",
      502,
      "embeddings_not_configured",
    );
  }

  if (response.status === 429) {
    throw new PublicError(
      "The embedding service is rate limited. Try again in a minute.",
      429,
      "embeddings_rate_limited",
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error("Hugging Face error", response.status, detail);
    throw new PublicError("The embedding service returned an error.", 502, "embeddings_error");
  }

  const payload = await response.json();

  // A single input can come back as a flat vector rather than a matrix.
  const vectors: number[][] = isNumberMatrix(payload)
    ? payload
    : Array.isArray(payload) && typeof payload[0] === "number"
      ? [payload as number[]]
      : [];

  if (vectors.length !== texts.length) {
    console.error("Unexpected embedding shape", JSON.stringify(payload).slice(0, 300));
    throw new PublicError("The embedding service returned an unexpected shape.", 502, "embeddings_error");
  }

  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new PublicError(
        `Embedding model returned ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
        502,
        "embeddings_dimension_mismatch",
      );
    }
  }

  return vectors;
};

export const embedOne = async (text: string): Promise<number[]> => {
  const [vector] = await embed([text]);
  return vector;
};

/**
 * Splits text into overlapping chunks on paragraph boundaries, carrying the
 * nearest markdown heading so a citation can say where it came from.
 */
export const chunkText = (
  text: string,
  { maxChars = 1200, overlapChars = 150 }: { maxChars?: number; overlapChars?: number } = {},
): Array<{ content: string; heading: string | null }> => {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: Array<{ content: string; heading: string | null }> = [];

  let buffer = "";
  let heading: string | null = null;

  const flush = () => {
    const content = buffer.trim();
    if (content.length > 0) chunks.push({ content, heading });
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const headingMatch = paragraph.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) heading = headingMatch[1].trim();

    if (buffer.length + paragraph.length + 2 > maxChars && buffer.length > 0) {
      flush();
      // Overlap keeps a sentence that straddles a boundary retrievable.
      const tail = chunks[chunks.length - 1]?.content ?? "";
      buffer = tail.slice(Math.max(0, tail.length - overlapChars));
    }

    buffer += (buffer ? "\n\n" : "") + paragraph;
  }

  flush();
  return chunks;
};
