import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser, requireFaculty } from "../_shared/supabase.ts";
import { embed, chunkText, EMBEDDING_MODEL, embeddingsConfigured } from "../_shared/embeddings.ts";

/**
 * Ingests course material into the retrieval store.
 *
 * Faculty only — this is the corpus AIVA is allowed to treat as authoritative,
 * so a student must not be able to write to it. Every stage of the lifecycle is
 * recorded honestly on content_documents.ingest_status: a document that failed
 * to embed says `failed` with the reason rather than sitting in the UI looking
 * ready but returning nothing.
 */

const MAX_CHARS = 400_000;
const BATCH = 16;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  let documentId: string | null = null;
  const db = adminClient();

  try {
    if (!embeddingsConfigured()) {
      throw new PublicError(
        "Document ingest is not configured yet. An administrator needs to add a Hugging Face API key to this project.",
        503,
        "embeddings_not_configured",
      );
    }

    const user = await requireUser(req);
    await requireFaculty(user.id);

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.text === "string" ? body.text : "";
    const conceptId = typeof body.conceptId === "string" ? body.conceptId : null;
    const chapterId = typeof body.chapterId === "string" ? body.chapterId : null;
    const sourceType = body.sourceType === "upload" ? "upload" : "pasted";

    if (!title) throw new PublicError("Give the document a title.", 400, "missing_title");
    if (text.trim().length < 50) {
      throw new PublicError("There is not enough text to index — paste at least a paragraph.", 400, "text_too_short");
    }
    if (text.length > MAX_CHARS) {
      throw new PublicError(
        `That document is ${text.length.toLocaleString()} characters. Split it into parts under ${MAX_CHARS.toLocaleString()}.`,
        400,
        "text_too_long",
      );
    }

    const { data: created, error: createError } = await db
      .from("content_documents")
      .insert({
        title,
        concept_id: conceptId,
        chapter_id: chapterId,
        source_type: sourceType,
        ingest_status: "processing",
        embedding_model: EMBEDDING_MODEL,
        byte_size: new TextEncoder().encode(text).length,
        mime_type: "text/plain",
        raw_text: text,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    documentId = created.id;

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new PublicError("No indexable text was found in that document.", 400, "no_chunks");
    }

    let index = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embed(slice.map((c) => c.content));

      const { error: chunkError } = await db.from("content_chunks").insert(
        slice.map((chunk, n) => ({
          document_id: documentId,
          concept_id: conceptId,
          chunk_index: index + n,
          content: chunk.content,
          heading: chunk.heading,
          // A rough word-based estimate, labelled as such — not a tokenizer.
          token_count: Math.round(chunk.content.split(/\s+/).length * 1.3),
          embedding: JSON.stringify(vectors[n]),
        })),
      );
      if (chunkError) throw chunkError;
      index += slice.length;
    }

    await db
      .from("content_documents")
      .update({
        ingest_status: "ready",
        chunk_count: index,
        ingest_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return json({ documentId, chunkCount: index, status: "ready" });
  } catch (error) {
    // Leave a truthful trail: a half-embedded document must not read as ready.
    if (documentId) {
      const reason = error instanceof Error ? error.message : "Unknown ingest failure";
      await db
        .from("content_documents")
        .update({ ingest_status: "failed", ingest_error: reason.slice(0, 500) })
        .eq("id", documentId)
        .then(undefined, () => undefined);
    }
    return handleError(error);
  }
});
