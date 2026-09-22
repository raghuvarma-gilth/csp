-- ============================================================================
-- EduVerse — Phase 3: Security Foundation
-- ----------------------------------------------------------------------------
-- Closes two verified vulnerabilities in the existing project:
--
--   1. PRIVILEGE ESCALATION. Migration 20260108063648 granted every user
--      INSERT/UPDATE/DELETE on their own `user_roles` row, so any student
--      could self-assign `faculty` or `research_expert` from the browser.
--
--   2. PUBLIC CONTENT LEAK. `chapter_content` carried a
--      `FOR SELECT USING (true)` policy, making every row (including
--      `user_id`) readable by anyone holding the anon key, unauthenticated.
--
-- Roles are now server-controlled: signup always yields `student`, and
-- elevation happens only through an admin-approved request.
-- ============================================================================

-- Prerequisite: 20260916085900 must have committed the 'admin' enum value.

-- ---------------------------------------------------------------------------
-- 1. Content lifecycle status, shared by every authored entity
--    Draft -> Submitted -> Approved -> Published -> Archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE public.content_status AS ENUM (
      'draft', 'submitted', 'approved', 'published', 'archived'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Role helpers (SECURITY DEFINER so RLS policies can call them without
--    recursing back into user_roles' own policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- Can this user author/curate course material?
CREATE OR REPLACE FUNCTION public.is_faculty(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'faculty'::public.app_role)
      OR public.has_role(_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_research_expert(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'research_expert'::public.app_role)
      OR public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- Highest-privilege role, used by the client to pick a dashboard.
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
    WHEN 'student'         THEN 4
  END
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Lock down user_roles
--    Every client-side write path is removed. The only way a row is created
--    is the signup trigger (always 'student') or an admin approval.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own role"         ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own role"         ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles"          ON public.user_roles;

CREATE POLICY "Users read their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins read every role"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Deliberately absent: any INSERT/UPDATE/DELETE policy for the row owner.
-- A student cannot promote themselves.

-- ---------------------------------------------------------------------------
-- 4. Signup always creates a profile + the `student` role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Role is assigned server-side and is ALWAYS 'student'. Client-supplied
  -- role hints in raw_user_meta_data are ignored by design.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: anyone who already exists without a role becomes a student.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'student'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Role elevation requests (the only legitimate promotion path)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role public.app_role NOT NULL,
  justification TEXT NOT NULL CHECK (char_length(justification) BETWEEN 20 AND 2000),
  institution   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'admin' is never self-serviceable.
  CONSTRAINT role_requests_elevatable_role
    CHECK (requested_role IN ('faculty'::public.app_role, 'research_expert'::public.app_role))
);

CREATE UNIQUE INDEX IF NOT EXISTS role_requests_one_pending_per_user
  ON public.role_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS role_requests_status_idx ON public.role_requests (status, created_at DESC);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own role requests" ON public.role_requests;
CREATE POLICY "Users read their own role requests"
ON public.role_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users create their own role request" ON public.role_requests;
CREATE POLICY "Users create their own role request"
ON public.role_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

-- Only admins may move a request out of 'pending'.
DROP POLICY IF EXISTS "Admins review role requests" ON public.role_requests;
CREATE POLICY "Admins review role requests"
ON public.role_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Admin-only approval. Grants the role and stamps the review in one txn.
CREATE OR REPLACE FUNCTION public.review_role_request(
  _request_id UUID,
  _approve    BOOLEAN,
  _note       TEXT DEFAULT NULL
)
RETURNS public.role_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.role_requests;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators can review role requests'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id FOR UPDATE;

  IF _req IS NULL THEN
    RAISE EXCEPTION 'Role request % not found', _request_id USING ERRCODE = 'P0002';
  END IF;

  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Role request % has already been reviewed', _request_id
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.role_requests
     SET status      = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = _note,
         updated_at  = now()
   WHERE id = _request_id
  RETURNING * INTO _req;

  IF _approve THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_req.user_id, _req.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN _req;
END;
$$;

REVOKE ALL ON FUNCTION public.review_role_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_role_request(UUID, BOOLEAN, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Close the chapter_content leak
--    The table is superseded by the curriculum schema in the next migration;
--    until that data is migrated we at least stop serving it to the world.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view chapter content"          ON public.chapter_content;
DROP POLICY IF EXISTS "Faculty can manage their own chapter content" ON public.chapter_content;

ALTER TABLE public.chapter_content
  ADD COLUMN IF NOT EXISTS status public.content_status NOT NULL DEFAULT 'draft';

-- Anything that existed before this migration was already world-readable,
-- so treat it as published rather than silently hiding a faculty member's work.
UPDATE public.chapter_content SET status = 'published' WHERE status = 'draft';

CREATE POLICY "Authenticated users read published chapter content"
ON public.chapter_content FOR SELECT
TO authenticated
USING (status = 'published');

CREATE POLICY "Authors read their own chapter content"
ON public.chapter_content FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Faculty write their own chapter content"
ON public.chapter_content FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_faculty(auth.uid()));

CREATE POLICY "Faculty update their own chapter content"
ON public.chapter_content FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.is_faculty(auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.is_faculty(auth.uid()));

CREATE POLICY "Admins manage all chapter content"
ON public.chapter_content FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Research insights: no more self-approval
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Research experts can manage their own insights" ON public.research_insights;
DROP POLICY IF EXISTS "Everyone can view approved insights"            ON public.research_insights;

ALTER TABLE public.research_insights
  ALTER COLUMN is_approved SET DEFAULT false;

ALTER TABLE public.research_insights
  ADD COLUMN IF NOT EXISTS status      public.content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE public.research_insights
   SET status = 'published'
 WHERE is_approved IS TRUE AND status = 'draft';

CREATE POLICY "Authenticated users read published insights"
ON public.research_insights FOR SELECT
TO authenticated
USING (status = 'published');

CREATE POLICY "Authors read their own insights"
ON public.research_insights FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Research experts write their own insights"
ON public.research_insights FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_research_expert(auth.uid())
  AND status IN ('draft', 'submitted')
  AND is_approved IS FALSE
);

-- An author may keep editing, but may not approve or publish their own work.
CREATE POLICY "Research experts update their unapproved insights"
ON public.research_insights FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_research_expert(auth.uid())
  AND status IN ('draft', 'submitted')
)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'submitted')
  AND is_approved IS FALSE
);

CREATE POLICY "Faculty and admins review insights"
ON public.research_insights FOR UPDATE
TO authenticated
USING (public.is_faculty(auth.uid()))
WITH CHECK (public.is_faculty(auth.uid()));

CREATE POLICY "Authors delete their own drafts"
ON public.research_insights FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'draft');

-- ---------------------------------------------------------------------------
-- 8. Private course-material storage
--    The bucket was public:true with an INSERT policy that let ANY
--    authenticated user write into ANY folder. Both are fixed here; the app
--    now reads via short-lived signed URLs.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = ARRAY[
         'application/pdf',
         'text/plain',
         'text/markdown',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 WHERE id = 'learning-materials';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'learning-materials', 'learning-materials', false, 26214400,
       ARRAY['application/pdf', 'text/plain', 'text/markdown']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'learning-materials');

DROP POLICY IF EXISTS "Authenticated users can upload learning materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view learning materials"                ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own learning materials"     ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own learning materials"     ON storage.objects;

-- Uploads are restricted to faculty, and only into their own {user_id}/ folder.
CREATE POLICY "Faculty upload their own learning materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-materials'
  AND public.is_faculty(auth.uid())
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners and faculty read learning materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'learning-materials'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_faculty(auth.uid())
  )
);

CREATE POLICY "Owners update their learning materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'learning-materials'
  AND public.is_faculty(auth.uid())
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners delete their learning materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'learning-materials'
  AND public.is_faculty(auth.uid())
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ---------------------------------------------------------------------------
-- 9. Profiles: richer, and readable by faculty for class analytics
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institution   TEXT,
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS learning_goal TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at  TIMESTAMPTZ;

DROP POLICY IF EXISTS "Faculty read student profiles" ON public.profiles;
CREATE POLICY "Faculty read student profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_faculty(auth.uid()));

DROP TRIGGER IF EXISTS update_role_requests_updated_at ON public.role_requests;
CREATE TRIGGER update_role_requests_updated_at
BEFORE UPDATE ON public.role_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
