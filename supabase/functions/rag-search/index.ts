import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { embedOne, embeddingsConfigured } from "../_shared/embeddings.ts";

/**
 * Semantic search over ingested course material.
 *
 * match_content_chunks() already restricts results to documents whose ingest
 * finished and concepts that are published, so an unfinished draft cannot leak
 * through search even though the chunk row exists.
 */

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (!embeddingsConfigured()) {
      throw new PublicError(
        "Course-material search is not configured yet. An administrator needs to add a Hugging Face API key.",
        503,
        "embeddings_not_configured",
      );
    }

    await requireUser(req);
    const db = adminClient();

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const conceptId = typeof body.conceptId === "string" ? body.conceptId : null;
    const limit = Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), 20) : 8;

    if (!query) throw new PublicError("Type something to search for.", 400, "empty_query");
    if (query.length > 1000) {
      throw new PublicError("That search is too long.", 400, "query_too_long");
    }

    const embedding = await embedOne(query);

    const { data, error } = await db.rpc("match_content_chunks", {
      query_embedding: JSON.stringify(embedding),
      match_count: limit,
      min_similarity: 0.3,
      filter_concept: conceptId,
    });
    if (error) throw error;

    return json({
      query,
      results: (data ?? []).map((row: Record<string, unknown>) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        conceptId: row.concept_id,
        conceptTitle: row.concept_title,
        documentTitle: row.document_title,
        heading: row.heading,
        excerpt: String(row.content).slice(0, 700),
        similarity: Number(Number(row.similarity).toFixed(3)),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
});
