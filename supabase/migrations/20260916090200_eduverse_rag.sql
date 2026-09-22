-- ============================================================================
-- EduVerse — Retrieval layer (RAG)
-- ----------------------------------------------------------------------------
-- The prototype had no retrieval at all: AIVA answered from the model's own
-- weights and a hard-coded system prompt, so it could confidently invent
-- course-specific detail. This migration adds the store that lets an answer be
-- grounded in — and cited back to — faculty-uploaded material.
--
-- Embeddings are 384-dimensional to match
-- sentence-transformers/all-MiniLM-L6-v2 on the Hugging Face Inference API.
-- Changing model means changing this dimension and re-embedding everything.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- pgvector may already live in `extensions` (Supabase default) or in `public`
-- on older projects. Resolve it rather than guessing, so `vector(384)` below
-- always binds.
DO $$
DECLARE
  _schema TEXT;
BEGIN
  SELECT n.nspname INTO _schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'vector';

  IF _schema IS NULL THEN
    RAISE EXCEPTION 'pgvector is not installed; enable the "vector" extension for this project first';
  END IF;

  EXECUTE format('SET search_path = public, %I', _schema);
END
$$;

-- ---------------------------------------------------------------------------
-- 1. Source documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id     UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  chapter_id     UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  source_type    TEXT NOT NULL DEFAULT 'upload'
                 CHECK (source_type IN ('upload','pasted','concept_body','research_content')),
  storage_path   TEXT,        -- path within the private learning-materials bucket
  mime_type      TEXT,
  byte_size      INTEGER,
  -- ingest lifecycle; the UI shows the real state instead of pretending
  ingest_status  TEXT NOT NULL DEFAULT 'pending'
                 CHECK (ingest_status IN ('pending','processing','ready','failed')),
  ingest_error   TEXT,
  chunk_count    INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  embedding_model TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_documents_concept_idx ON public.content_documents (concept_id);
CREATE INDEX IF NOT EXISTS content_documents_status_idx  ON public.content_documents (ingest_status);

-- ---------------------------------------------------------------------------
-- 2. Chunks + embeddings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.content_documents(id) ON DELETE CASCADE,
  concept_id  UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  heading     TEXT,
  token_count INTEGER,
  embedding   vector(384),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS content_chunks_concept_idx ON public.content_chunks (concept_id);

-- HNSW gives good recall without needing a populated table to train on, unlike
-- IVFFlat which must be rebuilt after the first bulk load.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'content_chunks_embedding_idx'
  ) THEN
    CREATE INDEX content_chunks_embedding_idx
      ON public.content_chunks
      USING hnsw (embedding vector_cosine_ops);
  END IF;
EXCEPTION
  WHEN feature_not_supported OR undefined_object THEN
    -- pgvector < 0.5 has no HNSW; fall back to exact search (correct, slower).
    RAISE NOTICE 'HNSW unavailable, falling back to sequential scan for vector search';
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Retrieval RPC
--    SECURITY DEFINER so it can read chunks (which students cannot query
--    directly) while still only ever returning material from PUBLISHED
--    concepts. Similarity is cosine, expressed as 1 - distance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_content_chunks(
  query_embedding vector(384),
  match_count     INTEGER DEFAULT 6,
  min_similarity  DOUBLE PRECISION DEFAULT 0.35,
  filter_concept  UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id     UUID,
  document_id  UUID,
  concept_id   UUID,
  concept_title TEXT,
  document_title TEXT,
  heading      TEXT,
  content      TEXT,
  similarity   DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    ch.id,
    ch.document_id,
    ch.concept_id,
    c.title,
    d.title,
    ch.heading,
    ch.content,
    (1 - (ch.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM public.content_chunks ch
  JOIN public.content_documents d ON d.id = ch.document_id
  LEFT JOIN public.concepts c ON c.id = ch.concept_id
  WHERE ch.embedding IS NOT NULL
    AND d.ingest_status = 'ready'
    AND (filter_concept IS NULL OR ch.concept_id = filter_concept)
    -- never surface unpublished material to a learner
    AND (c.id IS NULL OR c.status = 'published')
    AND (1 - (ch.embedding <=> query_embedding)) >= min_similarity
  ORDER BY ch.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

REVOKE ALL ON FUNCTION public.match_content_chunks(vector, INTEGER, DOUBLE PRECISION, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(vector, INTEGER, DOUBLE PRECISION, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(vector, INTEGER, DOUBLE PRECISION, UUID) TO service_role;

-- Keeps chunk_count honest so the faculty UI can report real indexing state.
CREATE OR REPLACE FUNCTION public.sync_document_chunk_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc UUID := COALESCE(NEW.document_id, OLD.document_id);
BEGIN
  UPDATE public.content_documents
     SET chunk_count = (SELECT COUNT(*) FROM public.content_chunks WHERE document_id = _doc),
         updated_at  = now()
   WHERE id = _doc;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS content_chunks_sync_count ON public.content_chunks;
CREATE TRIGGER content_chunks_sync_count
AFTER INSERT OR DELETE ON public.content_chunks
FOR EACH ROW EXECUTE FUNCTION public.sync_document_chunk_count();

DROP TRIGGER IF EXISTS update_content_documents_updated_at ON public.content_documents;
CREATE TRIGGER update_content_documents_updated_at
BEFORE UPDATE ON public.content_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_chunks    ENABLE ROW LEVEL SECURITY;

-- Students may see WHICH sources back a concept (so citations are meaningful)
-- but not the raw text dump.
CREATE POLICY "Read documents for published concepts" ON public.content_documents
  FOR SELECT TO authenticated
  USING (
    public.is_faculty(auth.uid())
    OR auth.uid() = created_by
    OR (ingest_status = 'ready' AND concept_id IS NOT NULL AND public.concept_is_published(concept_id))
  );

CREATE POLICY "Faculty manage their own documents" ON public.content_documents
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid()) AND (auth.uid() = created_by OR public.is_admin(auth.uid())))
  WITH CHECK (public.is_faculty(auth.uid()) AND auth.uid() = created_by);

-- Chunks are reachable only through match_content_chunks() or the service role.
CREATE POLICY "Faculty read chunks of their own documents" ON public.content_chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_documents d
     WHERE d.id = document_id
       AND public.is_faculty(auth.uid())
       AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
  ));
