-- ============================================================================
-- EduVerse — achievement ladder rescaled, and a curriculum inventory
-- ----------------------------------------------------------------------------
-- WHY
--
-- 20260916090300 defined twelve achievements for a curriculum of 11 concepts
-- and 6 coding problems. After 20261007090000-090400 the database holds:
--
--     6 courses · 16 chapters · 60 concepts · 38 coding problems
--
-- So the top achievement — "Course Complete", threshold 11 — was reachable at
-- 18% of the curriculum, and its description named one specific course while
-- the metric it uses (`concepts_mastered`) counts across all of them. A student
-- who mastered eleven graph concepts would have earned "Master every concept in
-- Data Structures Fundamentals" without opening that course.
--
-- This file fixes that description and extends both ladders to the real scale.
-- Every threshold below is a count this curriculum can actually reach; none is
-- aspirational. `evaluate_achievements()` computes each metric from measured
-- activity, so nothing here can be granted by a client.
--
-- The `metric` CHECK constraint on public.achievements permits exactly seven
-- values; everything here uses one of them. Adding a new metric would mean
-- altering that constraint AND teaching evaluate_achievements() to compute it,
-- so this migration deliberately stays inside the existing vocabulary.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Correct the misleading row
--     The code is the conflict key, so the row is updated in place and any
--     already-granted student_achievements rows keep pointing at it.
-- ---------------------------------------------------------------------------
UPDATE public.achievements
   SET title       = 'A Course''s Worth',
       description = 'Master eleven concepts — as many as the first course contains.',
       icon        = 'graduation-cap'
 WHERE code = 'course-complete';

-- ---------------------------------------------------------------------------
-- 2. Extend both ladders to the current curriculum
--     Positions continue from 12, where the original list stopped.
-- ---------------------------------------------------------------------------
INSERT INTO public.achievements (code, title, description, icon, metric, threshold, points, position)
VALUES
  -- concepts_mastered: 60 concepts exist
  ('concepts-twenty',  'Twenty Down',        'Master twenty concepts — a third of the curriculum.',                 'layers',        'concepts_mastered', 20,  120, 13),
  ('concepts-thirty',  'Halfway',            'Master thirty concepts — half of everything published.',              'target',        'concepts_mastered', 30,  200, 14),
  ('concepts-forty5',  'Three Quarters',     'Master forty-five of the sixty published concepts.',                  'trending-up',   'concepts_mastered', 45,  320, 15),
  ('concepts-all',     'Every Concept',      'Master all sixty concepts across all six courses.',                   'trophy',        'concepts_mastered', 60,  600, 16),

  -- problems_solved: 38 coding problems exist
  ('solves-ten',       'Ten Solved',         'Solve ten coding problems.',                                          'code',          'problems_solved',   10,  70,  17),
  ('solves-twenty',    'Twenty Solved',      'Solve twenty coding problems.',                                       'terminal',      'problems_solved',   20,  150, 18),
  ('solves-all',       'Full Problem Set',   'Solve all thirty-eight coding problems.',                             'trophy',        'problems_solved',   38,  400, 19),

  -- problems_debugged: solved with no hints used
  ('unaided-ten',      'Unaided Ten',        'Solve ten problems without using a single hint.',                     'target',        'problems_debugged', 10,  180, 20),
  ('unaided-twenty',   'On Your Own',        'Solve twenty problems without using a single hint.',                  'award',         'problems_debugged', 20,  360, 21),

  -- concepts_recovered: a misconception resolved, then the concept mastered
  ('comeback-five',    'Five Comebacks',     'Resolve a misconception and master the concept, five times over.',    'refresh-cw',    'concepts_recovered', 5,  140, 22),
  ('comeback-fifteen', 'Nothing Sticks',     'Resolve and then master fifteen concepts you once had wrong.',        'refresh-cw',    'concepts_recovered', 15, 340, 23),

  -- streak_days: the original ladder stopped at 30
  ('streak-sixty',     'Two Months',         'Study on sixty consecutive days.',                                    'flame',         'streak_days',       60,  280, 24),
  ('streak-hundred',   'One Hundred Days',   'Study on one hundred consecutive days.',                              'flame',         'streak_days',       100, 500, 25),

  -- quizzes_passed: 70% or better
  ('quiz-twenty',      'Quiz Regular',       'Pass twenty quizzes with 70% or higher.',                             'award',         'quizzes_passed',    20,  120, 26),
  ('quiz-fifty',       'Quiz Veteran',       'Pass fifty quizzes with 70% or higher.',                              'award',         'quizzes_passed',    50,  300, 27),

  -- study_minutes: the original ladder stopped at 300 (five hours)
  ('deep-work-twenty', 'Twenty Hours',       'Accumulate twenty hours of measured study time.',                     'clock',         'study_minutes',     1200, 200, 28),
  ('deep-work-fifty',  'Fifty Hours',        'Accumulate fifty hours of measured study time.',                      'clock',         'study_minutes',     3000, 450, 29)
ON CONFLICT (code) DO UPDATE
  SET title       = EXCLUDED.title,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      metric      = EXCLUDED.metric,
      threshold   = EXCLUDED.threshold,
      points      = EXCLUDED.points,
      position    = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 3. Inventory check
--     Not a constraint — a loud notice if the curriculum and this file have
--     drifted apart. If you add a course and the counts below change, the
--     thresholds above and the descriptions naming "sixty concepts" and
--     "thirty-eight coding problems" need revisiting. A silently wrong
--     description is exactly the kind of invented number this project forbids.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _courses  INTEGER;
  _chapters INTEGER;
  _concepts INTEGER;
  _problems INTEGER;
BEGIN
  SELECT count(*) INTO _courses  FROM public.courses          WHERE status = 'published';
  SELECT count(*) INTO _chapters FROM public.chapters         WHERE status = 'published';
  SELECT count(*) INTO _concepts FROM public.concepts         WHERE status = 'published';
  SELECT count(*) INTO _problems FROM public.coding_problems  WHERE status = 'published';

  RAISE NOTICE 'EduVerse curriculum: % courses, % chapters, % concepts, % coding problems',
    _courses, _chapters, _concepts, _problems;

  IF _concepts <> 60 THEN
    RAISE WARNING
      'Published concept count is % but the achievement ladder was written for 60. Review thresholds in this migration.',
      _concepts;
  END IF;

  IF _problems <> 38 THEN
    RAISE WARNING
      'Published coding problem count is % but the achievement ladder was written for 38. Review thresholds in this migration.',
      _problems;
  END IF;
END
$$;
