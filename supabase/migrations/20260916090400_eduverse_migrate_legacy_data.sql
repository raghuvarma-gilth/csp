-- ============================================================================
-- EduVerse — Forward-migrate legacy data into the canonical schema
-- ----------------------------------------------------------------------------
-- NON-DESTRUCTIVE. This migration only copies. The old tables are still there
-- and the current frontend keeps working after applying it.
--
-- The matching DROP migration is 20260916090500, and it must NOT be applied
-- until the rewritten frontend is deployed.
--
-- Honesty rule applied throughout: where the old schema never recorded
-- something, it is imported as zero/unknown rather than estimated. The old
-- adaptive_concept_progress table stored a quiz score but not per-attempt
-- outcomes, so `attempts`, `correct_attempts` and `accuracy` come across as 0
-- and `confidence` stays 0 until the student generates real evidence. Deriving
-- "probably got 7 of 10 right" from a score would be invented data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Supporting schema changes
-- ---------------------------------------------------------------------------

-- Idempotency marker for the two imports that have no natural key to conflict
-- on (both source tables are append-only logs).
CREATE TABLE IF NOT EXISTS public.legacy_migration_state (
  step         TEXT PRIMARY KEY,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.legacy_migration_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read legacy migration state" ON public.legacy_migration_state;
CREATE POLICY "Admins read legacy migration state"
ON public.legacy_migration_state FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Nothing is thrown away. Rows with no home in the new model land here as
-- JSONB so a drop is never a data loss.
CREATE TABLE IF NOT EXISTS public.legacy_learning_archive (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id    UUID,
  payload      JSONB NOT NULL,
  archived_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS legacy_archive_user_idx ON public.legacy_learning_archive (user_id);

ALTER TABLE public.legacy_learning_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own archived rows" ON public.legacy_learning_archive;
CREATE POLICY "Users read their own archived rows"
ON public.legacy_learning_archive FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- `pasted` was already a valid content_documents.source_type but there was
-- nowhere to put the pasted text. Faculty-authored notes imported below need
-- it, and so does the paste-to-index path in the RAG ingest function.
ALTER TABLE public.content_documents
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

COMMENT ON COLUMN public.content_documents.raw_text IS
  'Source text for source_type=''pasted'' or ''concept_body''. Uploads read from storage_path instead.';

-- Leaderboard visibility is a genuine privacy choice; it moves onto profiles
-- rather than being dropped with its old single-purpose table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 1. Concept slug bridge
--    The old tables keyed concepts by the text slugs 'arrays', 'stacks',
--    'queues'. Those map onto the fundamentals concept of each new chapter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_concept_id(_legacy_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id
  FROM public.concepts c
  JOIN public.chapters ch ON ch.id = c.chapter_id
  JOIN public.courses co  ON co.id = ch.course_id
  WHERE co.slug = 'data-structures-fundamentals'
    AND c.slug = CASE lower(trim(_legacy_slug))
      WHEN 'arrays' THEN 'array-fundamentals'
      WHEN 'array'  THEN 'array-fundamentals'
      WHEN 'stacks' THEN 'stack-fundamentals'
      WHEN 'stack'  THEN 'stack-fundamentals'
      WHEN 'queues' THEN 'queue-fundamentals'
      WHEN 'queue'  THEN 'queue-fundamentals'
      ELSE NULL
    END
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. adaptive_concept_progress -> student_concept_mastery
-- ---------------------------------------------------------------------------
INSERT INTO public.student_concept_mastery (
  user_id, concept_id,
  mastery, peak_mastery, confidence, accuracy,
  attempts, correct_attempts, total_time_seconds,
  status, first_practiced_at, last_practiced_at, mastered_at
)
SELECT
  p.user_id,
  public.legacy_concept_id(p.concept_id),
  LEAST(100, GREATEST(0, p.quiz_score))::NUMERIC(5,2),
  LEAST(100, GREATEST(0, p.quiz_score))::NUMERIC(5,2),
  0,                                    -- no attempt-level evidence was recorded
  0,
  0,
  0,
  GREATEST(0, p.time_spent),
  CASE p.status
    WHEN 'mastered'    THEN 'mastered'
    WHEN 'in-progress' THEN 'in_progress'
    ELSE 'not_started'
  END,
  p.created_at,
  CASE WHEN p.status = 'not-started' THEN NULL ELSE p.updated_at END,
  CASE WHEN p.status = 'mastered'    THEN p.updated_at ELSE NULL END
FROM public.adaptive_concept_progress p
WHERE public.legacy_concept_id(p.concept_id) IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
ON CONFLICT (user_id, concept_id) DO NOTHING;

-- Anything whose concept slug had no counterpart is archived rather than lost.
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT p.user_id, 'adaptive_concept_progress', p.id, to_jsonb(p)
FROM public.adaptive_concept_progress p
WHERE public.legacy_concept_id(p.concept_id) IS NULL
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. adaptive_learning_profiles -> archive
--    diagnostic_score and learning_style have no equivalent: the new
--    diagnostic writes per-question responses into diagnostic_responses, and a
--    single stored "learning style" label was never measured from anything.
-- ---------------------------------------------------------------------------
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT p.user_id, 'adaptive_learning_profiles', p.id, to_jsonb(p)
FROM public.adaptive_learning_profiles p
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. learning_progress -> archive
--    topic/module were free text from a curriculum that no longer exists
--    (the LearnFlow Python modules), so there is nothing to key them to.
-- ---------------------------------------------------------------------------
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT p.user_id, 'learning_progress', p.id, to_jsonb(p)
FROM public.learning_progress p
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. code_generations -> archive
--    The new Coding Lab records attempts against a defined problem with test
--    results; a free-form "instruction -> generated code" row has no problem
--    to attach to.
-- ---------------------------------------------------------------------------
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT g.user_id, 'code_generations', g.id, to_jsonb(g)
FROM public.code_generations g
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. learning_achievements -> archive
--    Deliberately not imported as student_achievements. The new achievements
--    are defined by a measurable metric and threshold, and
--    evaluate_achievements() re-awards them from real activity. Importing an
--    old free-text achievement_type would put an unearned badge on a profile.
-- ---------------------------------------------------------------------------
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT a.user_id, 'learning_achievements', a.id, to_jsonb(a)
FROM public.learning_achievements a
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. leaderboard_preferences -> profiles.show_on_leaderboard
-- ---------------------------------------------------------------------------
UPDATE public.profiles pr
   SET show_on_leaderboard = lp.show_on_leaderboard
  FROM public.leaderboard_preferences lp
 WHERE lp.user_id = pr.user_id
   AND lp.show_on_leaderboard IS DISTINCT FROM pr.show_on_leaderboard;

INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT lp.user_id, 'leaderboard_preferences', lp.id, to_jsonb(lp)
FROM public.leaderboard_preferences lp
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. chapter_content -> content_documents (queued for RAG indexing)
--    Faculty notes become retrievable source material. ingest_status stays
--    'pending' because nothing has been embedded yet — the UI shows the real
--    state and faculty press Index to run it.
-- ---------------------------------------------------------------------------
INSERT INTO public.content_documents (
  concept_id, chapter_id, title, source_type, raw_text,
  ingest_status, created_by, created_at, updated_at
)
SELECT
  NULL,
  (SELECT ch.id
     FROM public.chapters ch
     JOIN public.courses co ON co.id = ch.course_id
    WHERE co.slug = 'data-structures-fundamentals'
      AND ch.slug = 'arrays-and-strings'
    LIMIT 1),
  cc.title,
  'pasted',
  concat_ws(
    E'\n\n',
    NULLIF(cc.content, ''),
    CASE WHEN NULLIF(cc.lecture_notes, '') IS NOT NULL
         THEN '## Lecture notes' || E'\n' || cc.lecture_notes END
  ),
  'pending',
  cc.user_id,
  cc.created_at,
  cc.updated_at
FROM public.chapter_content cc
WHERE COALESCE(NULLIF(cc.content, ''), NULLIF(cc.lecture_notes, '')) IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cc.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.content_documents d
     WHERE d.created_by = cc.user_id
       AND d.title = cc.title
       AND d.source_type = 'pasted'
  );

-- The structured JSONB fields (learning_objectives, key_concepts,
-- common_misconceptions) are archived verbatim: they are faculty judgements
-- that a curator should review against the new catalogue, not auto-merge.
INSERT INTO public.legacy_learning_archive (user_id, source_table, source_id, payload)
SELECT cc.user_id, 'chapter_content', cc.id, to_jsonb(cc)
FROM public.chapter_content cc
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. research_insights -> research_content
--    reviewed_by is left NULL on import. Anything previously auto-approved
--    keeps its published status (it was already visible), but nothing gains a
--    reviewer it never had — the no-self-review constraint stays satisfied.
-- ---------------------------------------------------------------------------
INSERT INTO public.research_content (
  id, concept_id, title, content_type, content, code_language,
  status, created_by, created_at, updated_at
)
SELECT
  ri.id,
  public.legacy_concept_id(ri.concept_id),
  ri.title,
  CASE ri.insight_type
    WHEN 'code_snippet'            THEN 'code_example'
    WHEN 'case_study'              THEN 'case_study'
    WHEN 'research_note'           THEN 'research_note'
    WHEN 'real_world_application'  THEN 'real_world_application'
    ELSE 'research_note'
  END,
  ri.content,
  ri.code_language,
  CASE WHEN ri.is_approved IS TRUE THEN 'published'::public.content_status
       ELSE 'draft'::public.content_status END,
  ri.user_id,
  ri.created_at,
  ri.updated_at
FROM public.research_insights ri
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ri.user_id)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. chat_messages -> ai_conversations + ai_messages
--     Flat per-user message log becomes one imported conversation per user.
--     grounded = false is the truth: none of these answers were checked
--     against course material.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _imported INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.legacy_migration_state WHERE step = 'chat_messages') THEN
    RAISE NOTICE 'chat_messages already imported, skipping';
    RETURN;
  END IF;

  WITH new_convos AS (
    INSERT INTO public.ai_conversations (user_id, mode, title, created_at, updated_at)
    SELECT m.user_id, 'explain', 'Imported chat history', MIN(m.created_at), MAX(m.created_at)
    FROM public.chat_messages m
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
    GROUP BY m.user_id
    RETURNING id, user_id
  )
  INSERT INTO public.ai_messages (conversation_id, user_id, role, content, grounded, created_at)
  SELECT nc.id, m.user_id, m.role, m.content, false, m.created_at
  FROM new_convos nc
  JOIN public.chat_messages m ON m.user_id = nc.user_id
  WHERE COALESCE(m.content, '') <> '';

  GET DIAGNOSTICS _imported = ROW_COUNT;

  INSERT INTO public.legacy_migration_state (step, row_count)
  VALUES ('chat_messages', _imported);
END
$$;

-- ---------------------------------------------------------------------------
-- 11. aiva_conversations -> ai_conversations + ai_messages
--     The old table kept the whole transcript in one JSONB array. Ordinality
--     preserves turn order; timestamps are spread one second apart from the
--     conversation start because per-message times were never stored.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _imported INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.legacy_migration_state WHERE step = 'aiva_conversations') THEN
    RAISE NOTICE 'aiva_conversations already imported, skipping';
    RETURN;
  END IF;

  WITH new_convos AS (
    INSERT INTO public.ai_conversations (user_id, concept_id, mode, title, created_at, updated_at)
    SELECT
      ac.user_id,
      public.legacy_concept_id(ac.current_concept),
      'explain',
      COALESCE(NULLIF(initcap(ac.current_concept), ''), 'Imported AIVA session'),
      ac.created_at,
      ac.updated_at
    FROM public.aiva_conversations ac
    WHERE jsonb_typeof(ac.messages) = 'array'
      AND jsonb_array_length(ac.messages) > 0
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ac.user_id)
    RETURNING id, user_id, created_at
  ),
  -- new_convos and aiva_conversations are joined back by (user_id, created_at),
  -- which is unique in practice; row_number keeps the pairing deterministic.
  paired AS (
    SELECT nc.id AS conversation_id, ac.user_id, ac.messages, nc.created_at
    FROM (
      SELECT *, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
      FROM new_convos
    ) nc
    JOIN (
      SELECT *, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
      FROM public.aiva_conversations
      WHERE jsonb_typeof(messages) = 'array' AND jsonb_array_length(messages) > 0
    ) ac ON ac.user_id = nc.user_id AND ac.rn = nc.rn
  )
  INSERT INTO public.ai_messages (conversation_id, user_id, role, content, grounded, created_at)
  SELECT
    p.conversation_id,
    p.user_id,
    CASE WHEN msg ->> 'role' = 'assistant' THEN 'assistant' ELSE 'user' END,
    msg ->> 'content',
    false,
    p.created_at + (ord * INTERVAL '1 second')
  FROM paired p
  CROSS JOIN LATERAL jsonb_array_elements(p.messages) WITH ORDINALITY AS t(msg, ord)
  WHERE COALESCE(msg ->> 'content', '') <> '';

  GET DIAGNOSTICS _imported = ROW_COUNT;

  INSERT INTO public.legacy_migration_state (step, row_count)
  VALUES ('aiva_conversations', _imported);
END
$$;

-- ---------------------------------------------------------------------------
-- 12. Recompute derived state from the imported activity
-- ---------------------------------------------------------------------------
-- Streaks are recomputed from learning_sessions, which the legacy tables never
-- populated, so every imported user starts at a truthful zero rather than
-- inheriting a number nothing supports.
INSERT INTO public.learning_streaks (user_id, current_streak, longest_streak, total_active_days)
SELECT DISTINCT m.user_id, 0, 0, 0
FROM public.student_concept_mastery m
WHERE NOT EXISTS (
  SELECT 1 FROM public.learning_streaks s WHERE s.user_id = m.user_id
)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE public.legacy_learning_archive IS
  'Verbatim copies of rows from the prototype schema that have no counterpart in the canonical model. Kept so dropping the old tables is reversible.';
