/**
 * The mastery scale, defined once.
 *
 * Every surface that draws a mastery number — roadmap node, DNA grid, progress
 * bar, concept header — routes through here, so "amber" always means the same
 * band of understanding no matter where a student sees it.
 */

export type MasteryStatus =
  | "not_started"
  | "in_progress"
  | "practicing"
  | "mastered"
  | "needs_review";

export interface MasteryRecord {
  concept_id: string;
  mastery: number;
  peak_mastery: number;
  confidence: number;
  accuracy: number;
  attempts: number;
  correct_attempts: number;
  status: MasteryStatus;
  last_practiced_at: string | null;
  total_time_seconds: number;
}

/**
 * The bar for "I can do this" — the threshold a course or module counts a
 * concept as confident at.
 *
 * Deliberately below the 85% that earns `mastered`: progress rings count what
 * a student can already use, and holding them to the mastery bar would show a
 * course as untouched while they were most of the way through it. Defined here
 * because Learn and Home both draw rings over the same courses, and two local
 * copies of 60 would eventually disagree about the same course.
 */
export const CONFIDENT_MASTERY = 60;

export const MASTERY_BANDS = [
  { min: 85, key: "full", label: "Mastered", className: "bg-mastery-full", text: "text-mastery-full" },
  { min: 70, key: "high", label: "Strong", className: "bg-mastery-high", text: "text-mastery-high" },
  { min: 45, key: "mid", label: "Developing", className: "bg-mastery-mid", text: "text-mastery-mid" },
  { min: 1, key: "low", label: "Shaky", className: "bg-mastery-low", text: "text-mastery-low" },
  { min: 0, key: "none", label: "Not started", className: "bg-mastery-none", text: "text-muted-foreground" },
] as const;

export const masteryBand = (value: number) =>
  MASTERY_BANDS.find((band) => value >= band.min) ?? MASTERY_BANDS[MASTERY_BANDS.length - 1];

export const masteryColor = (value: number) => masteryBand(value).className;
export const masteryTextColor = (value: number) => masteryBand(value).text;
export const masteryLabel = (value: number) => masteryBand(value).label;

export const STATUS_LABEL: Record<MasteryStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  practicing: "Practising",
  mastered: "Mastered",
  needs_review: "Needs review",
};

/**
 * Mirrors public.concept_decay_risk(). Kept in sync with
 * supabase/functions/_shared/decay.ts and the SQL function of the same name —
 * if you change one, change all three.
 */
export const decayRisk = (
  peakMastery: number,
  mastery: number,
  lastPracticedAt: string | null,
): number => {
  if (!lastPracticedAt || peakMastery < 50) return 0;
  const days = Math.min((Date.now() - new Date(lastPracticedAt).getTime()) / 86_400_000, 30);
  return Math.min(100, Math.max(0, (days / 30) * 60 + Math.max(peakMastery - mastery, 0) * 0.4));
};

export const daysSince = (iso: string | null): number | null =>
  iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export const formatMinutes = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

export const ACTION_LABEL: Record<string, string> = {
  learn: "Learn",
  review: "Review",
  practice: "Practise",
  quiz: "Quiz",
  code: "Code",
  visual: "Visualise",
  diagnostic: "Placement check",
};
