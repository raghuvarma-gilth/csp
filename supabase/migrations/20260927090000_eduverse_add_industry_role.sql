-- ============================================================================
-- EduVerse — add the `industry_expert` role
-- ----------------------------------------------------------------------------
-- Alone in its own file for the same reason `admin` was: PostgreSQL refuses to
-- let a newly added enum value be *referenced* in the same transaction that
-- adds it, and `supabase db push` wraps each migration file in one transaction.
-- The migration that follows writes 'industry_expert'::app_role into CHECK
-- constraints and function bodies, so the label has to be committed first.
--
-- The role is for a practitioner from industry who contributes real-world
-- applications, case studies and worked code alongside the curriculum. Like
-- faculty and research experts it is granted only by an administrator
-- approving a request; unlike faculty it carries no authority to approve or
-- publish, and no access to course-material storage.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'industry_expert'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'industry_expert';
  END IF;
END
$$;
