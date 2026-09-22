/**
 * TypeScript mirror of public.concept_decay_risk() in
 * 20260916090100_eduverse_core_schema.sql.
 *
 * It exists so the planner can rank hundreds of concepts without a round trip
 * per concept. If you change the SQL, change this too — they must agree, or the
 * roadmap and the database will tell the student two different stories.
 */
export const decayRisk = (
  peakMastery: number,
  mastery: number,
  lastPracticedAt: string | null,
): number => {
  if (!lastPracticedAt || peakMastery < 50) return 0;

  const days = Math.min(
    (Date.now() - new Date(lastPracticedAt).getTime()) / 86_400_000,
    30,
  );
  const fromTime = (days / 30) * 60;
  const fromSlip = Math.max(peakMastery - mastery, 0) * 0.4;

  return Math.min(100, Math.max(0, fromTime + fromSlip));
};
