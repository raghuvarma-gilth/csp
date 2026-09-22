-- ============================================================================
-- EduVerse — add the `admin` role
-- ----------------------------------------------------------------------------
-- Kept in its own migration on purpose: PostgreSQL will not let a newly added
-- enum value be *referenced* inside the same transaction that adds it, and
-- `supabase db push` runs each migration file in one transaction. The security
-- migration that follows needs to write 'admin'::app_role in function bodies,
-- so the value has to be committed first.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END
$$;
