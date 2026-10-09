-- ============================================================================
-- EduVerse — registration intent, industry contributions, and the student-
--            facing contribution library
-- ----------------------------------------------------------------------------
-- This migration answers one product requirement: the register page asks which
-- kind of person is signing up (student / professor / industry professional),
-- and what professors and industry professionals publish is visible to
-- students.
--
-- It does that WITHOUT letting a browser choose a role, which is the whole
-- reason the old signup role picker was torn out. The mechanism:
--
--   * `handle_new_user` still writes exactly one row to `user_roles`, and it is
--     still always 'student'. That line is unchanged and is the security
--     property that matters.
--   * The picker's value arrives as `raw_user_meta_data->>'signup_intent'`,
--     which is attacker-controlled. The trigger treats it as a *request*: it
--     inserts a PENDING row into `role_requests`, the same table and the same
--     queue that /request-access writes to. An administrator still has to
--     approve it before `user_roles` changes.
--   * So the worst a forged intent can achieve is a pending request that an
--     administrator will read and reject — which is precisely what an honest
--     request achieves too. Nothing is gained. Three independent layers stop
--     anything worse: the IN-list below, the `role_requests_elevatable_role`
--     CHECK, and the absence of any INSERT policy on `user_roles`.
--
-- The visibility half reuses the pipeline that already exists rather than
-- adding a second one: contributors write `research_content`, faculty approve
-- and publish it, and students read only `published`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. `industry_expert` becomes a requestable role
-- ---------------------------------------------------------------------------
-- 'admin' stays absent: it is granted out of band and has no request path.
ALTER TABLE public.role_requests
  DROP CONSTRAINT IF EXISTS role_requests_elevatable_role;

ALTER TABLE public.role_requests
  ADD CONSTRAINT role_requests_elevatable_role
  CHECK (requested_role IN (
    'faculty'::public.app_role,
    'research_expert'::public.app_role,
    'industry_expert'::public.app_role
  ));

-- ---------------------------------------------------------------------------
-- 2. Role helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_industry_expert(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'industry_expert'::public.app_role)
      OR public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- Anyone who may AUTHOR material for review. Deliberately distinct from
-- is_faculty: authoring and signing off are different powers, and this function
-- must never be used to gate an approval.
CREATE OR REPLACE FUNCTION public.is_contributor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'faculty'::public.app_role)
      OR public.has_role(_user_id, 'research_expert'::public.app_role)
      OR public.has_role(_user_id, 'industry_expert'::public.app_role)
      OR public.has_role(_user_id, 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.is_industry_expert(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_contributor(UUID)     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_industry_expert(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_contributor(UUID)     TO authenticated;

-- The client picks a dashboard from this. `industry_expert` ranks below the two
-- curriculum roles and above student.
CREATE OR REPLACE FUNCTION public.current_role_for(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin'           THEN 1
    WHEN 'faculty'         THEN 2
    WHEN 'research_expert' THEN 3
    WHEN 'industry_expert' THEN 4
    WHEN 'student'         THEN 5
  END
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Signup: always a student, plus a pending request when one was asked for
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _intent      TEXT;
  _institution TEXT;
  _label       TEXT;
BEGIN
  /* Bounded before anything else touches it. This value arrives inside
     `raw_user_meta_data`, which the client controls completely — the form's
     maxLength is a courtesy, and a direct POST to the auth endpoint has no form
     at all. It matters because `role_requests.justification` carries
     CHECK (char_length BETWEEN 20 AND 2000) and the text built below embeds
     this string: an institution of a few thousand characters would push the
     generated justification past that CHECK. Since this is an AFTER INSERT
     trigger on auth.users, a failed CHECK does not merely skip the request —
     it aborts the transaction, so the account is never created and the caller
     gets an opaque 500 from signup. Truncating turns that into a slightly
     clipped institution name, which is the better of the two outcomes. */
  _institution := nullif(left(btrim(COALESCE(NEW.raw_user_meta_data ->> 'signup_institution', '')), 160), '');

  INSERT INTO public.profiles (user_id, display_name, institution)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    _institution
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- The role. Always 'student', whatever the client sent. This is the line that
  -- makes the register page's picker safe to have.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- The intent. Untrusted, so it becomes a request in the admin queue and
  -- nothing else. Anything outside this list -- including 'admin' -- is dropped
  -- silently: there is no error to report to someone who did not ask for it,
  -- and a forged value deserves no feedback.
  _intent := lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'signup_intent', '')));

  IF _intent IN ('faculty', 'industry_expert') THEN
    _label := CASE _intent
      WHEN 'faculty' THEN 'Professor / faculty'
      ELSE 'Industry professional'
    END;

    /* Wrapped in its own block so that recording the intent can never stop the
       account from being created. This trigger fires AFTER INSERT ON auth.users,
       so anything raised here aborts the signup transaction — which would mean a
       constraint on `role_requests` deciding whether a person can register at
       all. Those are separate concerns and this keeps them separate. If the
       insert fails the person still holds a student account and /request-access
       is the same queue by another door, so nothing is lost but a shortcut. */
    BEGIN
      -- The justification is written here, by the server, and says plainly that
      -- nobody has checked this claim yet. An administrator reading the queue
      -- must not mistake a self-declaration for a verified credential.
      INSERT INTO public.role_requests (user_id, requested_role, justification, institution)
      VALUES (
        NEW.id,
        _intent::public.app_role,
        format(
          'Selected "%s" on the registration form%s. This is a self-declaration made at signup and '
          'nothing about it has been verified. Confirm this person is who they say they are before '
          'approving.',
          _label,
          COALESCE(', giving ' || _institution || ' as their institution', '')
        ),
        _institution
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: could not record signup intent % for user %: %',
        _intent, NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Contributors may author research content
-- ---------------------------------------------------------------------------
-- Previously INSERT was research_expert-only, so a professor or an industry
-- contributor had a role and nothing to do with it. Authoring opens up;
-- approving does not. The UPDATE and DELETE policies already key off
-- `created_by` and a non-final status, so an industry author can revise their
-- own drafts and nobody else's, and the "Faculty review research content"
-- policy remains the only route to approved/published.
DROP POLICY IF EXISTS "Research experts create their own content" ON public.research_content;
DROP POLICY IF EXISTS "Contributors create their own research content" ON public.research_content;

CREATE POLICY "Contributors create their own research content" ON public.research_content
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_contributor(auth.uid())
    AND status IN ('draft', 'submitted')
    AND reviewed_by IS NULL
  );

-- ---------------------------------------------------------------------------
-- 5. What students see: published contributions, with attribution
-- ---------------------------------------------------------------------------
-- A student cannot read `profiles` rows belonging to other people, and cannot
-- read `user_roles` at all — both correct, and both mean the client cannot
-- assemble "who wrote this" for itself. This function does it server-side.
--
-- It is SECURITY DEFINER and takes no arguments, so the `status = 'published'`
-- filter below is not a client-side filter a caller can widen: it is the only
-- query there is. `research_content`'s own SELECT policy independently limits a
-- non-author, non-faculty reader to published rows, so the gate holds in two
-- places.
--
-- `concept_slug` is joined through a published-only condition. An unpublished
-- concept yields NULL and the UI then offers no link, rather than sending a
-- student to a page RLS will refuse them.
CREATE OR REPLACE FUNCTION public.published_contributions()
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  content_type  TEXT,
  content       TEXT,
  code_language TEXT,
  citations     JSONB,
  concept_id    UUID,
  concept_slug  TEXT,
  concept_title TEXT,
  author_name   TEXT,
  author_role   public.app_role,
  updated_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rc.id,
    rc.title,
    rc.content_type,
    rc.content,
    rc.code_language,
    rc.citations,
    rc.concept_id,
    c.slug  AS concept_slug,
    c.title AS concept_title,
    p.display_name AS author_name,
    public.current_role_for(rc.created_by) AS author_role,
    rc.updated_at
  FROM public.research_content rc
  LEFT JOIN public.concepts c
         ON c.id = rc.concept_id
        AND c.status = 'published'
  LEFT JOIN public.profiles p
         ON p.user_id = rc.created_by
  WHERE rc.status = 'published'
  ORDER BY rc.updated_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.published_contributions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_contributions() TO authenticated;

-- Reading this list is a per-student query over a status index; make it one.
CREATE INDEX IF NOT EXISTS research_content_published_idx
  ON public.research_content (updated_at DESC)
  WHERE status = 'published';
