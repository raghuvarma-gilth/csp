import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { MasteryRecord } from "@/lib/mastery";

/**
 * Every read the student experience makes, in one place.
 *
 * All of these read published content and the caller's own rows — RLS enforces
 * both, so a query here cannot return someone else's record even if the filter
 * were wrong. Nothing in this file fabricates a default: an absent mastery row
 * means "not started", which the UI says, rather than a zero that looks measured.
 */

export interface ConceptSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: number;
  estimated_minutes: number;
  visual_key: string | null;
  position: number;
  chapter_id: string;
}

export interface ChapterSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  position: number;
  course_id: string;
  concepts: ConceptSummary[];
}

export interface CourseSummary {
  id: string;
  slug: string;
  code: string | null;
  title: string;
  description: string | null;
  subject: string;
  chapters: ChapterSummary[];
}

const CURRICULUM_KEY = ["curriculum"] as const;

export const useCurriculum = () =>
  useQuery({
    queryKey: CURRICULUM_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CourseSummary[]> => {
      const [{ data: courses, error: coursesError }, { data: chapters, error: chaptersError }, { data: concepts, error: conceptsError }] =
        await Promise.all([
          supabase
            .from("courses")
            .select("id, slug, code, title, description, subject, position")
            .eq("status", "published")
            .order("position"),
          supabase
            .from("chapters")
            .select("id, slug, title, description, position, course_id")
            .eq("status", "published")
            .order("position"),
          supabase
            .from("concepts")
            .select("id, slug, title, summary, difficulty, estimated_minutes, visual_key, position, chapter_id")
            .eq("status", "published")
            .order("position"),
        ]);

      if (coursesError) throw coursesError;
      if (chaptersError) throw chaptersError;
      if (conceptsError) throw conceptsError;

      return (courses ?? []).map((course) => ({
        ...course,
        chapters: (chapters ?? [])
          .filter((chapter) => chapter.course_id === course.id)
          .map((chapter) => ({
            ...chapter,
            concepts: (concepts ?? []).filter((concept) => concept.chapter_id === chapter.id),
          })),
      }));
    },
  });

export interface ModuleDetail {
  course: { id: string; slug: string; code: string | null; title: string; description: string | null; subject: string };
  module: { id: string; slug: string; title: string; description: string | null; position: number };
  concepts: ConceptSummary[];
  /** Every objective across the module's concepts, so the module can state its own outcomes. */
  objectives: Array<{ id: string; concept_id: string; objective: string; position: number }>;
  problems: Array<{ id: string; slug: string; title: string; difficulty: number; concept_id: string }>;
  /** The other modules in the same course, in order, for previous/next navigation. */
  siblings: Array<{ id: string; slug: string; title: string; position: number }>;
}

/**
 * One module — a chapter, read as a destination of its own.
 *
 * Addressed by course slug *and* module slug because `chapters` is only
 * UNIQUE (course_id, slug): two courses may both have a module called
 * `introduction`, so a slug alone would be ambiguous the first time a second
 * course is published.
 *
 * The module's stated outcomes are the objectives already attached to its
 * concepts, gathered here rather than stored a second time. Duplicating them
 * on the chapter row would create two versions of the same sentence that drift
 * apart the moment somebody edits one.
 */
export const useModule = (courseSlug: string | undefined, moduleSlug: string | undefined) =>
  useQuery({
    queryKey: ["module", courseSlug, moduleSlug],
    enabled: Boolean(courseSlug && moduleSlug),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ModuleDetail> => {
      const { data: chapter, error: chapterError } = await supabase
        .from("chapters")
        .select(
          "id, slug, title, description, position, course_id, courses!inner(id, slug, code, title, description, subject, status)",
        )
        .eq("slug", moduleSlug!)
        .eq("status", "published")
        .eq("courses.slug", courseSlug!)
        .eq("courses.status", "published")
        .maybeSingle();

      if (chapterError) throw chapterError;
      if (!chapter) throw new Error("That module could not be found, or it has not been published yet.");

      const course = chapter.courses as unknown as ModuleDetail["course"];

      const [{ data: concepts, error: conceptsError }, { data: siblings, error: siblingsError }] = await Promise.all([
        supabase
          .from("concepts")
          .select("id, slug, title, summary, difficulty, estimated_minutes, visual_key, position, chapter_id")
          .eq("chapter_id", chapter.id)
          .eq("status", "published")
          .order("position"),
        supabase
          .from("chapters")
          .select("id, slug, title, position")
          .eq("course_id", chapter.course_id)
          .eq("status", "published")
          .order("position"),
      ]);

      if (conceptsError) throw conceptsError;
      if (siblingsError) throw siblingsError;

      const conceptIds = (concepts ?? []).map((concept) => concept.id);

      // `.in()` on an empty list is a query with no possible result, so skip it
      // rather than ask the server a question with a known answer.
      const [objectives, problems] = conceptIds.length
        ? await Promise.all([
            supabase
              .from("learning_objectives")
              .select("id, concept_id, objective, position")
              .in("concept_id", conceptIds)
              .order("position"),
            supabase
              .from("coding_problems")
              .select("id, slug, title, difficulty, concept_id")
              .in("concept_id", conceptIds)
              .eq("status", "published"),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      if (objectives.error) throw objectives.error;
      if (problems.error) throw problems.error;

      return {
        course,
        module: {
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          description: chapter.description,
          position: chapter.position,
        },
        concepts: concepts ?? [],
        objectives: objectives.data ?? [],
        problems: problems.data ?? [],
        siblings: siblings ?? [],
      };
    },
  });

export const useMastery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["mastery", user?.id],
    enabled: Boolean(user),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Map<string, MasteryRecord>> => {
      const { data, error } = await supabase
        .from("student_concept_mastery")
        .select(
          "concept_id, mastery, peak_mastery, confidence, accuracy, attempts, correct_attempts, status, last_practiced_at, total_time_seconds",
        )
        .eq("user_id", user!.id);
      if (error) throw error;

      return new Map(
        (data ?? []).map((row) => [
          row.concept_id,
          {
            concept_id: row.concept_id,
            mastery: Number(row.mastery),
            peak_mastery: Number(row.peak_mastery),
            confidence: Number(row.confidence),
            accuracy: Number(row.accuracy),
            attempts: row.attempts,
            correct_attempts: row.correct_attempts,
            status: row.status as MasteryRecord["status"],
            last_practiced_at: row.last_practiced_at,
            total_time_seconds: row.total_time_seconds,
          },
        ]),
      );
    },
  });
};

export const usePrerequisites = () =>
  useQuery({
    queryKey: ["prerequisites"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concept_prerequisites")
        .select("concept_id, prerequisite_id");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useConcept = (slug: string | undefined) =>
  useQuery({
    queryKey: ["concept", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      // `concepts` is UNIQUE (chapter_id, slug) rather than globally unique, so
      // two modules may legitimately both hold a concept called `introduction`.
      // `maybeSingle()` raises on the second row, which would take a lesson
      // page down over an editorial coincidence; taking the first in course
      // order keeps it deterministic instead.
      const { data: rows, error } = await supabase
        .from("concepts")
        .select(
          "id, slug, title, summary, content, difficulty, estimated_minutes, visual_key, position, chapter_id, chapters(id, slug, title, course_id, courses(id, slug, title))",
        )
        .eq("slug", slug!)
        .eq("status", "published")
        .order("position")
        .limit(1);
      if (error) throw error;
      const concept = rows?.[0];
      if (!concept) throw new Error("That concept could not be found, or it has not been published yet.");

      const [{ data: objectives }, { data: prerequisites }, { data: problems }] = await Promise.all([
        supabase.from("learning_objectives").select("id, objective, position").eq("concept_id", concept.id).order("position"),
        supabase.from("concept_prerequisites").select("prerequisite_id, concepts!concept_prerequisites_prerequisite_id_fkey(id, slug, title)").eq("concept_id", concept.id),
        supabase
          .from("coding_problems")
          .select("id, slug, title, difficulty")
          .eq("concept_id", concept.id)
          .eq("status", "published"),
      ]);

      return {
        concept,
        objectives: objectives ?? [],
        prerequisites: (prerequisites ?? [])
          .map((row) => row.concepts as unknown as { id: string; slug: string; title: string } | null)
          .filter(Boolean) as Array<{ id: string; slug: string; title: string }>,
        problems: problems ?? [],
      };
    },
  });

export const useRecommendations = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recommendations", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_recommendations")
        .select("id, concept_id, action, title, reason, priority, estimated_minutes, status, created_at")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("priority")
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useStreak = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["streak", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_streaks")
        .select("current_streak, longest_streak, last_active_date, total_active_days")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useMisconceptions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["misconceptions", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_misconceptions")
        .select("id, concept_id, statement, correction, detected_count, source, resolved, last_detected_at, concepts(slug, title)")
        .eq("user_id", user!.id)
        .eq("resolved", false)
        .order("detected_count", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useAchievements = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["achievements", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [{ data: definitions, error: defError }, { data: earned, error: earnedError }] = await Promise.all([
        supabase.from("achievements").select("id, code, title, description, icon, metric, threshold, points, position").order("position"),
        supabase.from("student_achievements").select("achievement_id, earned_at").eq("user_id", user!.id),
      ]);
      if (defError) throw defError;
      if (earnedError) throw earnedError;

      const earnedMap = new Map((earned ?? []).map((row) => [row.achievement_id, row.earned_at]));
      return (definitions ?? []).map((definition) => ({
        ...definition,
        earnedAt: earnedMap.get(definition.id) ?? null,
      }));
    },
  });
};

/** Invalidates everything a completed activity can change. */
export const useRefreshLearningState = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["mastery"] });
    void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    void queryClient.invalidateQueries({ queryKey: ["streak"] });
    void queryClient.invalidateQueries({ queryKey: ["achievements"] });
    void queryClient.invalidateQueries({ queryKey: ["misconceptions"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  };
};
