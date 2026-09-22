import { preflight, handleError, json } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { decayRisk } from "../_shared/decay.ts";

/**
 * "What should I do next" — computed, not guessed.
 *
 * Every recommendation below is derived from a row the student actually
 * produced: a mastery record, a misconception detected in a real attempt, a
 * prerequisite that is genuinely unmet. There is no model call here on purpose —
 * a plan that changes shape each time you ask it is not a plan, and inventing
 * "you seem to be struggling with recursion" from nothing is exactly the kind of
 * fake personalisation this rewrite exists to remove.
 *
 * When there is no evidence yet, the honest answer is one recommendation: take
 * the diagnostic.
 */

interface Candidate {
  conceptId: string;
  action: "learn" | "review" | "practice" | "quiz" | "code" | "visual" | "diagnostic";
  title: string;
  reason: string;
  priority: number;
  estimatedMinutes: number;
}

const MAX_RECOMMENDATIONS = 8;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    const db = adminClient();

    const [
      { data: concepts },
      { data: mastery },
      { data: prerequisites },
      { data: misconceptions },
      { data: problems },
      { data: solved },
    ] = await Promise.all([
      db
        .from("concepts")
        .select("id, title, slug, difficulty, estimated_minutes, visual_key, position, chapter_id, chapters(title, position, course_id)")
        .eq("status", "published")
        .order("position"),
      db
        .from("student_concept_mastery")
        .select("concept_id, mastery, peak_mastery, status, attempts, last_practiced_at")
        .eq("user_id", user.id),
      db.from("concept_prerequisites").select("concept_id, prerequisite_id"),
      db
        .from("student_misconceptions")
        .select("concept_id, statement, detected_count")
        .eq("user_id", user.id)
        .eq("resolved", false),
      db.from("coding_problems").select("id, concept_id, title").eq("status", "published"),
      db.from("coding_attempts").select("problem_id").eq("user_id", user.id).eq("is_solved", true),
    ]);

    const conceptList = concepts ?? [];
    const masteryBy = new Map((mastery ?? []).map((m) => [m.concept_id, m]));
    const solvedProblems = new Set((solved ?? []).map((s) => s.problem_id));

    const prereqsOf = new Map<string, string[]>();
    for (const edge of prerequisites ?? []) {
      const list = prereqsOf.get(edge.concept_id) ?? [];
      list.push(edge.prerequisite_id);
      prereqsOf.set(edge.concept_id, list);
    }

    const misconceptionsBy = new Map<string, { count: number; statement: string }>();
    for (const m of misconceptions ?? []) {
      if (!m.concept_id) continue;
      const existing = misconceptionsBy.get(m.concept_id);
      misconceptionsBy.set(m.concept_id, {
        count: (existing?.count ?? 0) + 1,
        statement: existing?.statement ?? m.statement,
      });
    }

    const unsolvedProblemFor = new Map<string, string>();
    for (const p of problems ?? []) {
      if (p.concept_id && !solvedProblems.has(p.id) && !unsolvedProblemFor.has(p.concept_id)) {
        unsolvedProblemFor.set(p.concept_id, p.title);
      }
    }

    const candidates: Candidate[] = [];
    const hasEvidence = (mastery ?? []).some((m) => Number(m.attempts) > 0);

    if (!hasEvidence) {
      candidates.push({
        conceptId: conceptList[0]?.id ?? "",
        action: "diagnostic",
        title: "Take the placement check",
        reason:
          "You have not answered anything yet, so there is nothing to base a plan on. Twelve adaptive questions is enough to find your starting point.",
        priority: 1,
        estimatedMinutes: 12,
      });
    }

    for (const concept of conceptList) {
      const record = masteryBy.get(concept.id);
      const value = Number(record?.mastery ?? 0);
      const peak = Number(record?.peak_mastery ?? 0);
      const attempts = Number(record?.attempts ?? 0);
      const risk = decayRisk(peak, value, record?.last_practiced_at ?? null);

      // 1. Decay — something they earned and are now losing.
      if (risk >= 40) {
        const days = record?.last_practiced_at
          ? Math.floor((Date.now() - new Date(record.last_practiced_at).getTime()) / 86_400_000)
          : 0;
        candidates.push({
          conceptId: concept.id,
          action: "review",
          title: `Refresh ${concept.title}`,
          reason: `You reached ${Math.round(peak)}% here and last practised it ${days} day${days === 1 ? "" : "s"} ago. A short review now costs far less than relearning it.`,
          priority: 1,
          estimatedMinutes: 8,
        });
        continue;
      }

      // 2. An active misconception is the highest-value thing to fix.
      const misconception = misconceptionsBy.get(concept.id);
      if (misconception) {
        candidates.push({
          conceptId: concept.id,
          action: "practice",
          title: `Clear up ${concept.title}`,
          reason: `You answered as though "${misconception.statement}". Targeted practice on this one idea is worth more than another pass over the chapter.`,
          priority: 1,
          estimatedMinutes: 10,
        });
        continue;
      }

      // 3. Started but not solid.
      if (attempts > 0 && value < 70) {
        candidates.push({
          conceptId: concept.id,
          action: "quiz",
          title: `Push ${concept.title} past 70%`,
          reason: `You are at ${Math.round(value)}% after ${attempts} question${attempts === 1 ? "" : "s"}. The quiz adapts to that level, so it will not throw the hardest cases at you yet.`,
          priority: 2,
          estimatedMinutes: 10,
        });
        continue;
      }

      // 4. Unlocked and untouched — the next thing to learn.
      if (attempts === 0 && value === 0) {
        const prereqs = prereqsOf.get(concept.id) ?? [];
        const unmet = prereqs.filter((id) => Number(masteryBy.get(id)?.mastery ?? 0) < 60);
        if (unmet.length === 0) {
          candidates.push({
            conceptId: concept.id,
            action: "learn",
            title: `Learn ${concept.title}`,
            reason: prereqs.length
              ? "Everything this builds on is solid, so it is unlocked."
              : "This is a starting point — nothing has to come before it.",
            priority: prereqs.length ? 2 : 3,
            estimatedMinutes: concept.estimated_minutes ?? 15,
          });
        }
        continue;
      }

      // 5. Solid understanding, untested in code.
      const problemTitle = unsolvedProblemFor.get(concept.id);
      if (value >= 70 && problemTitle) {
        candidates.push({
          conceptId: concept.id,
          action: "code",
          title: `Implement: ${problemTitle}`,
          reason: `You understand ${concept.title} at ${Math.round(value)}%. Writing it is what turns that into something you can use under pressure.`,
          priority: 3,
          estimatedMinutes: 25,
        });
        continue;
      }

      // 6. Struggling with something that has a visualisation.
      if (concept.visual_key && attempts > 0 && value < 50) {
        candidates.push({
          conceptId: concept.id,
          action: "visual",
          title: `See ${concept.title} run`,
          reason: "Watching the steps often does more for a stuck mental model than reading the same paragraph again.",
          priority: 3,
          estimatedMinutes: 6,
        });
      }
    }

    candidates.sort((a, b) => a.priority - b.priority || a.estimatedMinutes - b.estimatedMinutes);
    const plan = candidates.slice(0, MAX_RECOMMENDATIONS);

    // Replace the old plan rather than piling up stale advice.
    await db
      .from("learning_recommendations")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("status", "active");

    let inserted: Array<Record<string, unknown>> = [];
    if (plan.length > 0) {
      const { data, error } = await db
        .from("learning_recommendations")
        .insert(
          plan.map((c) => ({
            user_id: user.id,
            concept_id: c.conceptId || null,
            action: c.action,
            title: c.title,
            reason: c.reason,
            priority: c.priority,
            estimated_minutes: c.estimatedMinutes,
            generated_by: "rules",
          })),
        )
        .select("id, concept_id, action, title, reason, priority, estimated_minutes, status");
      if (error) throw error;
      inserted = data ?? [];
    }

    // Today's mission — the first three things, as checkable tasks.
    const today = new Date().toISOString().slice(0, 10);
    const tasks = inserted.slice(0, 3).map((r) => ({
      id: r.id,
      label: r.title,
      action: r.action,
      concept_id: r.concept_id,
      done: false,
    }));

    if (tasks.length > 0) {
      await db
        .from("daily_missions")
        .upsert({ user_id: user.id, mission_date: today, tasks }, { onConflict: "user_id,mission_date" });
    }

    const { data: streak } = await db.rpc("refresh_learning_streak", { _user_id: user.id });

    return json({
      generatedAt: new Date().toISOString(),
      hasEvidence,
      recommendations: inserted.map((r) => ({
        id: r.id,
        conceptId: r.concept_id,
        action: r.action,
        title: r.title,
        reason: r.reason,
        priority: r.priority,
        estimatedMinutes: r.estimated_minutes,
      })),
      mission: tasks.length ? { date: today, tasks } : null,
      streak: streak ?? null,
    });
  } catch (error) {
    return handleError(error);
  }
});
