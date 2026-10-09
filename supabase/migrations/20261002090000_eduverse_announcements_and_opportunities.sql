-- ===========================================================================
-- Faculty announcements and industry opportunities
--
-- Until now the only thing a faculty or industry account could produce was a
-- `research_content` row. That made both registration forms close to
-- decorative: a professor had no way to tell their students anything, and an
-- industry professional had no way to post the internship that was the reason
-- they signed up. These two tables are the missing half.
--
-- Why two tables and not eight. The brief lists announcements, workshops,
-- internships, jobs, projects, challenges and in-demand skills. Six of those
-- are the same row — a title, a body, an organisation, a link, a closing date —
-- differing only in the word printed on the badge, so they are one table with a
-- `kind` discriminator, exactly the idiom `research_content.content_type`
-- already uses. "In-demand skills" is not a thing somebody authors in its own
-- right; it is the `skills` array on the opportunity that wants them, which is
-- both more useful and attributable to a real poster. A company profile is a
-- property of the poster, carried here as `organisation`, rather than a
-- separate entity nobody would maintain.
--
-- Both tables ride the existing `content_status` pipeline
-- (draft → submitted → approved → published → archived) and both are reviewed
-- by faculty or an administrator. Nothing new is invented about the workflow.
--
-- What IS new, and stronger than `research_content` manages:
--
--   · `*_reviewed_before_live` — a row cannot be `approved` or `published`
--     unless `reviewed_by` is set. Combined with the no-self-review CHECK, it
--     is not possible to reach a student-visible status without naming a
--     reviewer who is not the author. `research_content` relies on the API to
--     fill `reviewed_by` in; here the database insists.
--
--   · `stamp_reviewer()` — a BEFORE UPDATE trigger that overwrites
--     `reviewed_by` with `auth.uid()` on a review transition. A browser
--     therefore cannot name somebody else as the reviewer of its own work: the
--     trigger puts the real caller in the column and the CHECK above rejects
--     the row. The service role has no `auth.uid()`, so the backend's own
--     value survives — and the backend has already verified the token and
--     refused self-review before it gets here.
--
-- Outward-facing URLs are constrained to http(s) in the table definition.
-- These are links a student clicks, and `javascript:` in an apply button is
-- not something that should depend on the frontend remembering to filter it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Faculty announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Optional: an announcement may be about one course or about everything.
  course_id   UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  -- Past this moment the read function stops returning the row. A deadline
  -- reminder for a date that has gone is worse than no reminder.
  expires_at  TIMESTAMPTZ,
  status      public.content_status NOT NULL DEFAULT 'draft',
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT announcements_no_self_review
    CHECK (reviewed_by IS NULL OR reviewed_by <> created_by),
  CONSTRAINT announcements_reviewed_before_live
    CHECK (status NOT IN ('approved', 'published') OR reviewed_by IS NOT NULL)
);

COMMENT ON TABLE public.announcements IS
  'Faculty-authored notices for students. Reviewed by another member of staff '
  'before students can read them; see announcements_reviewed_before_live.';

CREATE INDEX IF NOT EXISTS announcements_status_idx
  ON public.announcements (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS announcements_author_idx
  ON public.announcements (created_by, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Industry opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One row shape, six labels. Adding a seventh is a CHECK change and a label
  -- in src/components/workspace/pipeline.tsx, not a new table.
  kind             TEXT NOT NULL
                   CHECK (kind IN ('internship','job','project','workshop','challenge')),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  organisation     TEXT NOT NULL,
  organisation_url TEXT,
  location         TEXT,
  apply_url        TEXT,
  deadline         DATE,
  -- What the opportunity actually asks for. This is the honest version of an
  -- "in-demand skills" feature: every skill here is attached to a real posting
  -- somebody is accountable for.
  skills           TEXT[] NOT NULL DEFAULT '{}',
  -- Optional tie to curriculum, so "this is what arrays are for" has a link.
  concept_id       UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  status           public.content_status NOT NULL DEFAULT 'draft',
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  review_note      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT opportunities_no_self_review
    CHECK (reviewed_by IS NULL OR reviewed_by <> created_by),
  CONSTRAINT opportunities_reviewed_before_live
    CHECK (status NOT IN ('approved', 'published') OR reviewed_by IS NOT NULL),
  -- Students click these. Refusing anything but http(s) here means a
  -- `javascript:` or `data:` URL never reaches the markup in the first place.
  CONSTRAINT opportunities_apply_url_http
    CHECK (apply_url IS NULL OR apply_url ~* '^https?://'),
  CONSTRAINT opportunities_org_url_http
    CHECK (organisation_url IS NULL OR organisation_url ~* '^https?://')
);

COMMENT ON TABLE public.opportunities IS
  'Industry-posted internships, jobs, projects, workshops and challenges. '
  'Reviewed by faculty or an administrator before students can see them.';

CREATE INDEX IF NOT EXISTS opportunities_status_idx
  ON public.opportunities (status, deadline);
CREATE INDEX IF NOT EXISTS opportunities_author_idx
  ON public.opportunities (created_by, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 3. updated_at, as everywhere else
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['announcements', 'opportunities'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 4. The reviewer is whoever is actually calling
-- ---------------------------------------------------------------------------
-- Approving is the one action in this product where "who did it" cannot be
-- taken from the request, because the request is exactly what an author would
-- forge to approve their own work. On a review transition this trigger
-- overwrites `reviewed_by` with the authenticated caller. A browser gets
-- stamped with its own id and then hits `*_no_self_review`; the service role
-- has no `auth.uid()`, so the backend's verified value is kept.
CREATE OR REPLACE FUNCTION public.stamp_reviewer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'published')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.reviewed_by := COALESCE(auth.uid(), NEW.reviewed_by);
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_stamp_reviewer ON public.announcements;
CREATE TRIGGER announcements_stamp_reviewer
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.stamp_reviewer();

DROP TRIGGER IF EXISTS opportunities_stamp_reviewer ON public.opportunities;
CREATE TRIGGER opportunities_stamp_reviewer
BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.stamp_reviewer();

-- ---------------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------------
-- Shaped exactly like `research_content`: read published (or your own, or
-- anything if you are staff); author your own drafts; revise only what has not
-- been signed off; faculty review. Authoring and reviewing are separate
-- policies because they are separate powers.
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- --- announcements ---------------------------------------------------------
DROP POLICY IF EXISTS "Read published announcements" ON public.announcements;
CREATE POLICY "Read published announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (status = 'published' OR auth.uid() = created_by OR public.is_faculty(auth.uid()));

DROP POLICY IF EXISTS "Faculty create their own announcements" ON public.announcements;
CREATE POLICY "Faculty create their own announcements" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_faculty(auth.uid())
    AND status IN ('draft', 'submitted')
    AND reviewed_by IS NULL
  );

DROP POLICY IF EXISTS "Authors edit their unreviewed announcements" ON public.announcements;
CREATE POLICY "Authors edit their unreviewed announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'submitted'));

DROP POLICY IF EXISTS "Authors delete their announcement drafts" ON public.announcements;
CREATE POLICY "Authors delete their announcement drafts" ON public.announcements
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');

DROP POLICY IF EXISTS "Faculty review announcements" ON public.announcements;
CREATE POLICY "Faculty review announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- --- opportunities ---------------------------------------------------------
DROP POLICY IF EXISTS "Read published opportunities" ON public.opportunities;
CREATE POLICY "Read published opportunities" ON public.opportunities
  FOR SELECT TO authenticated
  USING (status = 'published' OR auth.uid() = created_by OR public.is_faculty(auth.uid()));

-- Industry professionals post these. Faculty review them but do not author
-- them, which is why this is `is_industry_expert` and not `is_contributor`.
DROP POLICY IF EXISTS "Industry create their own opportunities" ON public.opportunities;
CREATE POLICY "Industry create their own opportunities" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_industry_expert(auth.uid())
    AND status IN ('draft', 'submitted')
    AND reviewed_by IS NULL
  );

DROP POLICY IF EXISTS "Authors edit their unreviewed opportunities" ON public.opportunities;
CREATE POLICY "Authors edit their unreviewed opportunities" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'submitted'));

DROP POLICY IF EXISTS "Authors delete their opportunity drafts" ON public.opportunities;
CREATE POLICY "Authors delete their opportunity drafts" ON public.opportunities
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');

DROP POLICY IF EXISTS "Faculty review opportunities" ON public.opportunities;
CREATE POLICY "Faculty review opportunities" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (public.is_faculty(auth.uid())) WITH CHECK (public.is_faculty(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. What students read
-- ---------------------------------------------------------------------------
-- Same reasoning as `published_contributions()`: a student cannot read other
-- people's `profiles` rows and cannot read `user_roles` at all, so "posted by
-- Professor X" is not something the browser can assemble. Both functions are
-- SECURITY DEFINER and take no arguments, so the `status = 'published'` filter
-- is the whole query rather than a parameter a caller could widen.
--
-- Both also drop items that have run out. The student dashboard counts these
-- rows, and "3 open internships" has to mean three a student can still apply
-- to — an expired listing left in the count would be exactly the invented
-- statistic this product refuses to show.

CREATE OR REPLACE FUNCTION public.published_announcements()
RETURNS TABLE (
  id           UUID,
  title        TEXT,
  body         TEXT,
  pinned       BOOLEAN,
  course_id    UUID,
  course_title TEXT,
  author_name  TEXT,
  author_role  public.app_role,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.title,
    a.body,
    a.pinned,
    a.course_id,
    c.title AS course_title,
    p.display_name AS author_name,
    public.current_role_for(a.created_by) AS author_role,
    a.created_at,
    a.updated_at
  FROM public.announcements a
  LEFT JOIN public.courses c
         ON c.id = a.course_id
        AND c.status = 'published'
  LEFT JOIN public.profiles p
         ON p.user_id = a.created_by
  WHERE a.status = 'published'
    AND (a.expires_at IS NULL OR a.expires_at > now())
  ORDER BY a.pinned DESC, a.updated_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.published_announcements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_announcements() TO authenticated;

CREATE OR REPLACE FUNCTION public.published_opportunities()
RETURNS TABLE (
  id               UUID,
  kind             TEXT,
  title            TEXT,
  description      TEXT,
  organisation     TEXT,
  organisation_url TEXT,
  location         TEXT,
  apply_url        TEXT,
  deadline         DATE,
  skills           TEXT[],
  concept_id       UUID,
  concept_slug     TEXT,
  concept_title    TEXT,
  author_name      TEXT,
  author_role      public.app_role,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.kind,
    o.title,
    o.description,
    o.organisation,
    o.organisation_url,
    o.location,
    o.apply_url,
    o.deadline,
    o.skills,
    o.concept_id,
    c.slug  AS concept_slug,
    c.title AS concept_title,
    p.display_name AS author_name,
    public.current_role_for(o.created_by) AS author_role,
    o.created_at,
    o.updated_at
  FROM public.opportunities o
  LEFT JOIN public.concepts c
         ON c.id = o.concept_id
        AND c.status = 'published'
  LEFT JOIN public.profiles p
         ON p.user_id = o.created_by
  WHERE o.status = 'published'
    AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)
  -- Closing soonest first; undated last rather than first, because a listing
  -- with no deadline is the least urgent thing on the page.
  ORDER BY (o.deadline IS NULL), o.deadline ASC, o.updated_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.published_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_opportunities() TO authenticated;
