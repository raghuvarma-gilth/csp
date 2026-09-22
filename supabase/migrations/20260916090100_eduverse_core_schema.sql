-- ============================================================================
-- EduVerse — Canonical curriculum + learning schema
-- ----------------------------------------------------------------------------
-- The prototype had four disconnected progress stores:
--   learning_progress, adaptive_concept_progress, adaptive_learning_profiles,
--   and localStorage. A quiz taken in one never moved the needle in another.
--
-- This migration establishes ONE model:
--   courses -> chapters -> concepts -> prerequisites/objectives
--   student_concept_mastery  (the "Learning DNA" — single source of truth)
--   every activity (quiz, coding, tutor, visual) writes student_attempts,
--   which rolls up into mastery through one trigger.
--
-- Legacy tables are migrated forward and dropped in a later migration, so
-- this file is safe to apply on its own.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Curriculum
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  code        TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  subject     TEXT NOT NULL DEFAULT 'Computer Science',
  status      public.content_status NOT NULL DEFAULT 'draft',
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chapters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      public.content_status NOT NULL DEFAULT 'draft',
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS public.concepts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id        UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT,
  content           TEXT,
  difficulty        SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  estimated_minutes INTEGER NOT NULL DEFAULT 20 CHECK (estimated_minutes > 0),
  visual_key        TEXT,  -- links a concept to its DSA visualisation, e.g. 'two-pointers'
  status            public.content_status NOT NULL DEFAULT 'draft',
  position          INTEGER NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, slug)
);

CREATE INDEX IF NOT EXISTS concepts_chapter_idx ON public.concepts (chapter_id, position);
CREATE INDEX IF NOT EXISTS concepts_status_idx  ON public.concepts (status);

-- Directed prerequisite graph. A concept is unlocked when every prerequisite
-- has reached the mastery threshold.
CREATE TABLE IF NOT EXISTS public.concept_prerequisites (
  concept_id      UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  prerequisite_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, prerequisite_id),
  CONSTRAINT concept_prerequisite_not_self CHECK (concept_id <> prerequisite_id)
);

CREATE TABLE IF NOT EXISTS public.learning_objectives (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  objective  TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Faculty-authored catalogue of known misconceptions, used to classify what
-- a student actually got wrong rather than just "wrong answer".
CREATE TABLE IF NOT EXISTS public.concept_misconceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id  UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  statement   TEXT NOT NULL,   -- the incorrect belief, in the student's words
  correction  TEXT NOT NULL,   -- what is actually true
  probe       TEXT,            -- a question that re-tests the belief
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (concept_id, code)
);

-- ---------------------------------------------------------------------------
-- 2. Learning DNA — one row per (student, concept)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_concept_mastery (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id          UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,

  mastery             NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (mastery    BETWEEN 0 AND 100),
  peak_mastery        NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (peak_mastery BETWEEN 0 AND 100),
  confidence          NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (confidence BETWEEN 0 AND 100),
  accuracy            NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (accuracy   BETWEEN 0 AND 100),

  attempts            INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_attempts    INTEGER NOT NULL DEFAULT 0 CHECK (correct_attempts >= 0),
  misconception_count INTEGER NOT NULL DEFAULT 0 CHECK (misconception_count >= 0),
  total_time_seconds  INTEGER NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),

  status              TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started','in_progress','practicing','mastered','needs_review')),
  first_practiced_at  TIMESTAMPTZ,
  last_practiced_at   TIMESTAMPTZ,
  mastered_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, concept_id),
  CONSTRAINT mastery_correct_lte_attempts CHECK (correct_attempts <= attempts)
);

CREATE INDEX IF NOT EXISTS mastery_user_idx      ON public.student_concept_mastery (user_id);
CREATE INDEX IF NOT EXISTS mastery_weak_idx      ON public.student_concept_mastery (user_id, mastery);
CREATE INDEX IF NOT EXISTS mastery_practiced_idx ON public.student_concept_mastery (user_id, last_practiced_at DESC);

-- Decay risk is derived, never stored stale: a concept that peaked high and
-- has not been touched in weeks is at risk. Returns 0-100.
CREATE OR REPLACE FUNCTION public.concept_decay_risk(
  _peak_mastery      NUMERIC,
  _mastery           NUMERIC,
  _last_practiced_at TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _last_practiced_at IS NULL OR _peak_mastery < 50 THEN 0
    ELSE LEAST(
      100,
      GREATEST(
        0,
        -- days since practice, saturating at 30 days
        (LEAST(EXTRACT(EPOCH FROM (now() - _last_practiced_at)) / 86400.0, 30.0) / 30.0 * 60.0)
        -- plus however far mastery has already slipped from its peak
        + GREATEST(_peak_mastery - _mastery, 0) * 0.4
      )
    )
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Activity log — every learning action lands here
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id       UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  activity         TEXT NOT NULL
                   CHECK (activity IN ('lesson','quiz','practice','coding','tutor','visual','diagnostic','revision','focus')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_sessions_user_idx ON public.learning_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.student_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id       UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  attempt_type     TEXT NOT NULL
                   CHECK (attempt_type IN ('quiz','practice','coding','diagnostic','revision','explain_back')),
  is_correct       BOOLEAN NOT NULL,
  difficulty       SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  score            NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
  response_time_ms INTEGER CHECK (response_time_ms >= 0),
  misconception_id UUID REFERENCES public.concept_misconceptions(id) ON DELETE SET NULL,
  reference_id     UUID,  -- quiz_attempt / coding_attempt this came from
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_attempts_user_concept_idx
  ON public.student_attempts (user_id, concept_id, created_at DESC);

-- Detected misconceptions, per student, with recurrence tracking.
CREATE TABLE IF NOT EXISTS public.student_misconceptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id       UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  misconception_id UUID REFERENCES public.concept_misconceptions(id) ON DELETE SET NULL,
  statement        TEXT NOT NULL,
  correction       TEXT,
  detected_count   INTEGER NOT NULL DEFAULT 1 CHECK (detected_count > 0),
  source           TEXT NOT NULL DEFAULT 'quiz'
                   CHECK (source IN ('quiz','tutor','coding','practice','explain_back')),
  resolved         BOOLEAN NOT NULL DEFAULT false,
  resolved_at      TIMESTAMPTZ,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, concept_id, statement)
);

CREATE INDEX IF NOT EXISTS student_misconceptions_open_idx
  ON public.student_misconceptions (user_id, resolved, last_detected_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Mastery roll-up
--    One trigger keeps student_concept_mastery consistent with the attempt
--    log, so AI tutor / quiz / coding / visual all update the same number.
--
--    Mastery uses an exponentially-weighted update so recent work dominates,
--    scaled by question difficulty. Confidence grows with sample size.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_attempt_to_mastery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row          public.student_concept_mastery;
  _weight       NUMERIC;
  _target       NUMERIC;
  _new_mastery  NUMERIC;
  _new_attempts INTEGER;
  _new_correct  INTEGER;
  _new_status   TEXT;
BEGIN
  INSERT INTO public.student_concept_mastery (user_id, concept_id, first_practiced_at)
  VALUES (NEW.user_id, NEW.concept_id, now())
  ON CONFLICT (user_id, concept_id) DO NOTHING;

  SELECT * INTO _row
    FROM public.student_concept_mastery
   WHERE user_id = NEW.user_id AND concept_id = NEW.concept_id
   FOR UPDATE;

  _new_attempts := _row.attempts + 1;
  _new_correct  := _row.correct_attempts + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;

  -- Harder questions move the needle further, in both directions.
  _weight := 0.18 + (NEW.difficulty - 1) * 0.045;   -- 0.18 .. 0.36

  -- A correct answer pulls toward a ceiling set by difficulty; an incorrect
  -- one pulls toward a floor. Nailing a level-5 question can reach 100;
  -- only ever answering level-1 questions caps out around 70.
  IF NEW.is_correct THEN
    _target := 55 + NEW.difficulty * 9;            -- 64 .. 100
  ELSE
    _target := GREATEST(0, 30 - (5 - NEW.difficulty) * 6);  -- failing easy hurts most
  END IF;

  _new_mastery := ROUND(_row.mastery + (_target - _row.mastery) * _weight, 2);
  _new_mastery := LEAST(100, GREATEST(0, _new_mastery));

  _new_status := CASE
    WHEN _new_mastery >= 85 AND _new_attempts >= 4 THEN 'mastered'
    WHEN _new_mastery < 50  AND _new_attempts >= 3 THEN 'needs_review'
    WHEN _new_attempts >= 3                        THEN 'practicing'
    ELSE 'in_progress'
  END;

  UPDATE public.student_concept_mastery
     SET attempts          = _new_attempts,
         correct_attempts  = _new_correct,
         mastery           = _new_mastery,
         peak_mastery      = GREATEST(peak_mastery, _new_mastery),
         accuracy          = ROUND(_new_correct::NUMERIC / _new_attempts * 100, 2),
         -- confidence saturates as evidence accumulates (10 attempts ~= full)
         confidence        = ROUND(LEAST(100, _new_attempts / 10.0 * 100) * _new_mastery / 100.0, 2),
         status            = _new_status,
         last_practiced_at = now(),
         mastered_at       = CASE
                               WHEN _new_status = 'mastered' AND mastered_at IS NULL THEN now()
                               ELSE mastered_at
                             END,
         updated_at        = now()
   WHERE user_id = NEW.user_id AND concept_id = NEW.concept_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_attempts_update_mastery ON public.student_attempts;
CREATE TRIGGER student_attempts_update_mastery
AFTER INSERT ON public.student_attempts
FOR EACH ROW EXECUTE FUNCTION public.apply_attempt_to_mastery();

-- Keep misconception_count on the mastery row in step.
CREATE OR REPLACE FUNCTION public.sync_misconception_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id    UUID := COALESCE(NEW.user_id, OLD.user_id);
  _concept_id UUID := COALESCE(NEW.concept_id, OLD.concept_id);
BEGIN
  UPDATE public.student_concept_mastery m
     SET misconception_count = (
           SELECT COUNT(*) FROM public.student_misconceptions s
            WHERE s.user_id = _user_id AND s.concept_id = _concept_id AND s.resolved = false
         ),
         updated_at = now()
   WHERE m.user_id = _user_id AND m.concept_id = _concept_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS student_misconceptions_sync ON public.student_misconceptions;
CREATE TRIGGER student_misconceptions_sync
AFTER INSERT OR UPDATE OR DELETE ON public.student_misconceptions
FOR EACH ROW EXECUTE FUNCTION public.sync_misconception_count();

-- ---------------------------------------------------------------------------
-- 5. Assessments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','faculty')),
  difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  status     public.content_status NOT NULL DEFAULT 'published',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id          UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question         TEXT NOT NULL,
  options          JSONB NOT NULL,
  correct_index    SMALLINT NOT NULL CHECK (correct_index >= 0),
  explanation      TEXT NOT NULL,
  question_type    TEXT NOT NULL DEFAULT 'conceptual'
                   CHECK (question_type IN ('conceptual','scenario','code','implementation')),
  difficulty       SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  misconception_id UUID REFERENCES public.concept_misconceptions(id) ON DELETE SET NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- guards against the AI returning correct_index out of range for its options
  CONSTRAINT quiz_questions_options_shape
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  CONSTRAINT quiz_questions_correct_in_range
    CHECK (correct_index < jsonb_array_length(options))
);

CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx ON public.quiz_questions (quiz_id, position);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id         UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  concept_id      UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  score           NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  correct_count   INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  difficulty      SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  answers         JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT quiz_attempts_correct_lte_total CHECK (correct_count <= total_questions)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_idx ON public.quiz_attempts (user_id, completed_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Coding Lab
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coding_problems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id          UUID REFERENCES public.concepts(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  prompt              TEXT NOT NULL,
  difficulty          SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  starter_code        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { "python": "...", "javascript": "..." }
  test_cases          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ input, expected, hidden }]
  expected_complexity TEXT,
  hints               JSONB NOT NULL DEFAULT '[]'::jsonb,  -- progressive, revealed one at a time
  status              public.content_status NOT NULL DEFAULT 'draft',
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coding_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id         UUID NOT NULL REFERENCES public.coding_problems(id) ON DELETE CASCADE,
  stage              TEXT NOT NULL DEFAULT 'approach'
                     CHECK (stage IN ('approach','pseudocode','code','tests','complexity','complete')),
  approach_text      TEXT,
  code               TEXT,
  language           TEXT NOT NULL DEFAULT 'python',
  tests_passed       INTEGER NOT NULL DEFAULT 0 CHECK (tests_passed >= 0),
  tests_total        INTEGER NOT NULL DEFAULT 0 CHECK (tests_total >= 0),
  hints_used         INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  complexity_answer  TEXT,
  is_solved          BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coding_attempts_user_idx ON public.coding_attempts (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Diagnostic assessment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id         UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','completed','abandoned')),
  current_difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (current_difficulty BETWEEN 1 AND 5),
  questions_asked    INTEGER NOT NULL DEFAULT 0,
  correct_count      INTEGER NOT NULL DEFAULT 0,
  score              NUMERIC(5,2),
  result             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { strong: [], weak: [], unassessed: [] }
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.diagnostic_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  concept_id   UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  question     JSONB NOT NULL,
  answer_index SMALLINT,
  is_correct   BOOLEAN NOT NULL,
  difficulty   SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. Recommendations — "what should I do next"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id        UUID REFERENCES public.concepts(id) ON DELETE CASCADE,
  action            TEXT NOT NULL
                    CHECK (action IN ('learn','review','practice','quiz','code','visual','diagnostic')),
  title             TEXT NOT NULL,
  reason            TEXT NOT NULL,
  priority          SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','dismissed','expired')),
  generated_by      TEXT NOT NULL DEFAULT 'rules' CHECK (generated_by IN ('rules','ai')),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendations_active_idx
  ON public.learning_recommendations (user_id, status, priority);

-- Today's Mission: a small, checkable daily plan.
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, label, action, concept_id, done }]
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_date)
);

-- ---------------------------------------------------------------------------
-- 9. Achievements — definitions are shared, awards are earned from real data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'award',
  metric      TEXT NOT NULL
              CHECK (metric IN ('concepts_mastered','problems_solved','problems_debugged',
                                'concepts_recovered','streak_days','quizzes_passed','study_minutes')),
  threshold   INTEGER NOT NULL CHECK (threshold > 0),
  points      INTEGER NOT NULL DEFAULT 10,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- 10. Conversations (AIVA), with retrieved sources kept per message
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  mode       TEXT NOT NULL DEFAULT 'explain'
             CHECK (mode IN ('explain','socratic','hint','practice','revision','exam')),
  title      TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sources         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ title, chapter, snippet, document_id }]
  grounded        BOOLEAN NOT NULL DEFAULT false,      -- false => not verified against course material
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx
  ON public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 11. Research content (replaces research_insights)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  content_type  TEXT NOT NULL
                CHECK (content_type IN ('research_note','case_study','dataset','real_world_application','code_example','reference')),
  content       TEXT NOT NULL,
  code_language TEXT,
  citations     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        public.content_status NOT NULL DEFAULT 'draft',
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a reviewer may never be the author (spec §27)
  CONSTRAINT research_no_self_review CHECK (reviewed_by IS NULL OR reviewed_by <> created_by)
);

CREATE INDEX IF NOT EXISTS research_content_status_idx ON public.research_content (status, concept_id);

-- ---------------------------------------------------------------------------
-- 12. Focus sessions — measurable signals only (spec §31)
--     The old table stored randomly generated wellbeing/energy/focus values.
--     Those columns are dropped; what remains is observable.
-- ---------------------------------------------------------------------------
ALTER TABLE public.focus_sessions
  DROP COLUMN IF EXISTS focus_level,
  DROP COLUMN IF EXISTS engagement,
  DROP COLUMN IF EXISTS wellbeing,
  DROP COLUMN IF EXISTS energy;

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS concept_id            UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_minutes        INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS present_seconds       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_events           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camera_enabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed             BOOLEAN NOT NULL DEFAULT false;

COMMENT ON TABLE public.focus_sessions IS
  'Measurable focus-session telemetry only. Never store inferred emotional or wellbeing state.';

-- ---------------------------------------------------------------------------
-- 13. updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'courses','chapters','concepts','student_concept_mastery','quizzes',
    'coding_problems','coding_attempts','ai_conversations','research_content',
    'daily_missions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 14. Integrity helpers
--
--     Design rule for everything below: any value that feeds mastery,
--     achievements or analytics is written by an Edge Function holding the
--     service role, never by the browser. Tables carrying those values get a
--     SELECT policy and no client INSERT/UPDATE policy at all. Without this a
--     student could POST `is_correct: true` a hundred times and "master" a
--     concept they have never opened.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.concept_is_published(_concept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.concepts
    WHERE id = _concept_id AND status = 'published'
  );
$$;

-- Recomputes the streak from the activity log, so it cannot be inflated by
-- writing to learning_streaks directly.
CREATE OR REPLACE FUNCTION public.refresh_learning_streak(_user_id UUID DEFAULT auth.uid())
RETURNS public.learning_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days      DATE[];
  _current   INTEGER := 0;
  _longest   INTEGER := 0;
  _run       INTEGER := 0;
  _prev      DATE;
  _d         DATE;
  _row       public.learning_streaks;
BEGIN
  IF _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_faculty(auth.uid())) THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(d ORDER BY d)
    INTO _days
    FROM (
      SELECT DISTINCT (started_at AT TIME ZONE 'UTC')::date AS d
        FROM public.learning_sessions
       WHERE user_id = _user_id AND duration_seconds >= 60
    ) s;

  IF _days IS NULL THEN
    _days := ARRAY[]::DATE[];
  END IF;

  FOREACH _d IN ARRAY _days LOOP
    IF _prev IS NOT NULL AND _d = _prev + 1 THEN
      _run := _run + 1;
    ELSE
      _run := 1;
    END IF;
    _longest := GREATEST(_longest, _run);
    _prev := _d;
  END LOOP;

  -- The run only counts as "current" if it reaches today or yesterday.
  IF _prev IS NOT NULL AND _prev >= CURRENT_DATE - 1 THEN
    _current := _run;
  END IF;

  INSERT INTO public.learning_streaks (
    user_id, current_streak, longest_streak, last_active_date, total_active_days
  )
  VALUES (_user_id, _current, _longest, _prev, COALESCE(array_length(_days, 1), 0))
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak    = EXCLUDED.current_streak,
        longest_streak    = GREATEST(public.learning_streaks.longest_streak, EXCLUDED.longest_streak),
        last_active_date  = EXCLUDED.last_active_date,
        total_active_days = EXCLUDED.total_active_days,
        updated_at        = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_learning_streak(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_learning_streak(UUID) TO authenticated;

-- Awards achievements strictly from measured data. Returns only newly earned
-- rows so the UI can celebrate them once.
CREATE OR REPLACE FUNCTION public.evaluate_achievements(_user_id UUID DEFAULT auth.uid())
RETURNS SETOF public.student_achievements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a        public.achievements;
  _measured INTEGER;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
  END IF;

  FOR _a IN SELECT * FROM public.achievements LOOP
    _measured := CASE _a.metric

      WHEN 'concepts_mastered' THEN (
        SELECT COUNT(*) FROM public.student_concept_mastery m
         WHERE m.user_id = _user_id AND m.status = 'mastered')

      WHEN 'problems_solved' THEN (
        SELECT COUNT(DISTINCT c.problem_id) FROM public.coding_attempts c
         WHERE c.user_id = _user_id AND c.is_solved)

      WHEN 'problems_debugged' THEN (
        SELECT COUNT(DISTINCT c.problem_id) FROM public.coding_attempts c
         WHERE c.user_id = _user_id AND c.is_solved AND c.hints_used = 0 AND c.tests_total > 0)

      -- recovered = a misconception was detected on the concept, resolved, and
      -- the concept then reached mastery
      WHEN 'concepts_recovered' THEN (
        SELECT COUNT(*) FROM public.student_concept_mastery m
         WHERE m.user_id = _user_id
           AND m.status = 'mastered'
           AND m.misconception_count = 0
           AND EXISTS (
             SELECT 1 FROM public.student_misconceptions sm
              WHERE sm.user_id = _user_id
                AND sm.concept_id = m.concept_id
                AND sm.resolved))

      WHEN 'streak_days' THEN (
        SELECT COALESCE(MAX(s.longest_streak), 0) FROM public.learning_streaks s
         WHERE s.user_id = _user_id)

      WHEN 'quizzes_passed' THEN (
        SELECT COUNT(*) FROM public.quiz_attempts q
         WHERE q.user_id = _user_id AND q.completed_at IS NOT NULL AND q.score >= 70)

      WHEN 'study_minutes' THEN (
        SELECT COALESCE(SUM(l.duration_seconds), 0) / 60 FROM public.learning_sessions l
         WHERE l.user_id = _user_id)

      ELSE 0
    END;

    IF _measured >= _a.threshold THEN
      RETURN QUERY
        INSERT INTO public.student_achievements (user_id, achievement_id)
        VALUES (_user_id, _a.id)
        ON CONFLICT (user_id, achievement_id) DO NOTHING
        RETURNING *;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_achievements(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 15. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_prerequisites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_objectives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_misconceptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_concept_mastery  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_misconceptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_problems          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_attempts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_missions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_content         ENABLE ROW LEVEL SECURITY;

-- --- Curriculum: published content is readable; faculty curate --------------
CREATE POLICY "Read published courses" ON public.courses
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

CREATE POLICY "Read published chapters" ON public.chapters
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage chapters" ON public.chapters
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

CREATE POLICY "Read published concepts" ON public.concepts
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage concepts" ON public.concepts
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- The prerequisite graph drives the roadmap, so students must be able to read it.
CREATE POLICY "Read prerequisites of published concepts" ON public.concept_prerequisites
  FOR SELECT TO authenticated
  USING (public.concept_is_published(concept_id) OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage prerequisites" ON public.concept_prerequisites
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

CREATE POLICY "Read objectives of published concepts" ON public.learning_objectives
  FOR SELECT TO authenticated
  USING (public.concept_is_published(concept_id) OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage objectives" ON public.learning_objectives
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- Faculty-only: the misconception catalogue is an answer key. Students see the
-- relevant correction copied onto their own student_misconceptions row instead.
CREATE POLICY "Faculty manage misconception catalogue" ON public.concept_misconceptions
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- --- Learning DNA: read-only to its owner, written by the trigger -----------
CREATE POLICY "Students read their own mastery" ON public.student_concept_mastery
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

-- --- Activity --------------------------------------------------------------
CREATE POLICY "Students manage their own sessions" ON public.learning_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Faculty read all sessions" ON public.learning_sessions
  FOR SELECT TO authenticated
  USING (public.is_faculty(auth.uid()));

-- Append-only from the server; no client INSERT policy on purpose.
CREATE POLICY "Students read their own attempts" ON public.student_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

CREATE POLICY "Students read their own misconceptions" ON public.student_misconceptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

-- --- Assessments -----------------------------------------------------------
CREATE POLICY "Read published quizzes" ON public.quizzes
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage quizzes" ON public.quizzes
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- quiz_questions holds correct_index. RLS is row-level, not column-level, so
-- students are kept out entirely and receive questions (answers stripped)
-- through the quiz Edge Function.
CREATE POLICY "Faculty manage quiz questions" ON public.quiz_questions
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

CREATE POLICY "Students read their own quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

-- --- Coding Lab ------------------------------------------------------------
CREATE POLICY "Read published coding problems" ON public.coding_problems
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_faculty(auth.uid()));
CREATE POLICY "Faculty manage coding problems" ON public.coding_problems
  FOR ALL TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- Students own their drafts. tests_passed/is_solved are overwritten by the
-- grader Edge Function, and only that function writes the student_attempts row
-- that actually moves mastery.
CREATE POLICY "Students manage their own coding attempts" ON public.coding_attempts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Faculty read all coding attempts" ON public.coding_attempts
  FOR SELECT TO authenticated
  USING (public.is_faculty(auth.uid()));

-- --- Diagnostic (adaptive question selection happens server-side) ----------
CREATE POLICY "Students read their own diagnostics" ON public.diagnostic_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

CREATE POLICY "Students read their own diagnostic responses" ON public.diagnostic_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diagnostic_sessions s
     WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_faculty(auth.uid()))
  ));

-- --- Recommendations & missions -------------------------------------------
CREATE POLICY "Students read their own recommendations" ON public.learning_recommendations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Dismiss / mark done is a legitimate client action.
CREATE POLICY "Students update their own recommendations" ON public.learning_recommendations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students manage their own missions" ON public.daily_missions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- --- Achievements ----------------------------------------------------------
CREATE POLICY "Everyone reads achievement definitions" ON public.achievements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage achievement definitions" ON public.achievements
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Awarded exclusively by evaluate_achievements(); no client INSERT policy.
CREATE POLICY "Students read their own achievements" ON public.student_achievements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_faculty(auth.uid()));

-- --- Conversations ---------------------------------------------------------
CREATE POLICY "Students read their own conversations" ON public.ai_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students delete their own conversations" ON public.ai_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students rename their own conversations" ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages are written by the AIVA Edge Function so an assistant turn cannot
-- be forged client-side and later shown as if the tutor had said it.
CREATE POLICY "Students read their own messages" ON public.ai_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students delete their own messages" ON public.ai_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- --- Research content ------------------------------------------------------
CREATE POLICY "Read published research content" ON public.research_content
  FOR SELECT TO authenticated
  USING (status = 'published' OR auth.uid() = created_by OR public.is_faculty(auth.uid()));

CREATE POLICY "Research experts create their own content" ON public.research_content
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_research_expert(auth.uid())
    AND status IN ('draft', 'submitted')
    AND reviewed_by IS NULL
  );

-- An author may keep editing while unreviewed, but cannot approve or publish.
CREATE POLICY "Research experts edit their unreviewed content" ON public.research_content
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'submitted'));

CREATE POLICY "Research experts delete their drafts" ON public.research_content
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');

CREATE POLICY "Faculty review research content" ON public.research_content
  FOR UPDATE TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));
