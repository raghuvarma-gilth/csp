-- ============================================================================
-- EduVerse — Drop the prototype tables
-- ----------------------------------------------------------------------------
-- DESTRUCTIVE, and ordered last on purpose.
--
-- DO NOT APPLY THIS UNTIL THE REWRITTEN FRONTEND IS DEPLOYED. The current
-- pages still read these tables; dropping them first breaks the running app:
--
--   adaptive_learning_profiles / adaptive_concept_progress  -> StudentDashboard, AdaptiveLearning
--   learning_progress                                       -> Dashboard, ProgressBoard
--   chat_messages                                           -> Tutor
--   code_generations                                        -> Talk2Code
--   aiva_conversations                                      -> AIVA chat
--   chapter_content / research_insights                     -> Faculty + Research dashboards
--   learning_achievements / leaderboard_preferences         -> ProgressBoard
--
-- Everything here was copied forward by 20260916090400. Anything without a
-- home in the canonical model is in public.legacy_learning_archive, so this is
-- reversible from within the database.
-- ============================================================================

-- Refuse to run if the copy step never happened. Losing a student's history to
-- a mis-ordered migration is not a recoverable mistake.
DO $$
BEGIN
  IF to_regclass('public.legacy_learning_archive') IS NULL THEN
    RAISE EXCEPTION
      'Migration 20260916090400 (forward-migrate legacy data) has not been applied. Apply it before dropping the prototype tables.';
  END IF;
END
$$;

DROP TABLE IF EXISTS public.adaptive_concept_progress   CASCADE;
DROP TABLE IF EXISTS public.adaptive_learning_profiles  CASCADE;
DROP TABLE IF EXISTS public.learning_progress           CASCADE;
DROP TABLE IF EXISTS public.chat_messages               CASCADE;
DROP TABLE IF EXISTS public.code_generations            CASCADE;
DROP TABLE IF EXISTS public.learning_achievements       CASCADE;
DROP TABLE IF EXISTS public.leaderboard_preferences     CASCADE;
DROP TABLE IF EXISTS public.aiva_conversations          CASCADE;
DROP TABLE IF EXISTS public.chapter_content             CASCADE;
DROP TABLE IF EXISTS public.research_insights           CASCADE;

-- The slug bridge only existed to translate 'arrays'/'stacks'/'queues' during
-- the import; with the sources gone it has no callers.
DROP FUNCTION IF EXISTS public.legacy_concept_id(TEXT);

INSERT INTO public.legacy_migration_state (step, row_count)
VALUES ('drop_prototype_tables', 10)
ON CONFLICT (step) DO UPDATE SET completed_at = now();
