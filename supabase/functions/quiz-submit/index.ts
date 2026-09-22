import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

/**
 * Grades a quiz attempt server-side and writes the evidence that mastery is
 * computed from.
 *
 * The browser sends answers only. It cannot send `is_correct`, a score, or a
 * mastery value — student_attempts has no client INSERT policy, so the
 * exponentially-weighted mastery trigger can only ever be fed by this function.
 */

interface SubmittedAnswer {
  questionId: string;
  answerIndex: number | null;
  responseTimeMs?: number;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    const db = adminClient();

    const body = await req.json().catch(() => ({}));
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
    const answers: SubmittedAnswer[] = Array.isArray(body.answers) ? body.answers : [];

    if (!attemptId) throw new PublicError("No quiz attempt was provided.", 400, "missing_attempt");

    const { data: attempt } = await db
      .from("quiz_attempts")
      .select("id, user_id, quiz_id, concept_id, difficulty, total_questions, completed_at")
      .eq("id", attemptId)
      .maybeSingle();

    if (!attempt || attempt.user_id !== user.id) {
      throw new PublicError("That quiz attempt was not found.", 404, "attempt_not_found");
    }
    if (attempt.completed_at) {
      throw new PublicError("This quiz has already been submitted.", 409, "already_submitted");
    }

    const { data: questions, error: questionsError } = await db
      .from("quiz_questions")
      .select("id, question, options, correct_index, explanation, misconception_id, difficulty, position")
      .eq("quiz_id", attempt.quiz_id!)
      .order("position");
    if (questionsError) throw questionsError;
    if (!questions?.length) throw new PublicError("This quiz has no questions.", 404, "quiz_empty");

    const answerFor = new Map(answers.map((a) => [a.questionId, a]));

    const results = questions.map((q) => {
      const submitted = answerFor.get(q.id);
      const answerIndex = typeof submitted?.answerIndex === "number" ? submitted.answerIndex : null;
      const isCorrect = answerIndex === q.correct_index;
      return {
        questionId: q.id,
        question: q.question,
        options: q.options as string[],
        answerIndex,
        correctIndex: q.correct_index,
        isCorrect,
        explanation: q.explanation,
        misconceptionId: q.misconception_id,
        difficulty: q.difficulty,
        responseTimeMs: submitted?.responseTimeMs ?? null,
      };
    });

    const correctCount = results.filter((r) => r.isCorrect).length;
    const score = Number(((correctCount / results.length) * 100).toFixed(2));

    // One attempt row per question — this is what feeds mastery.
    const { error: attemptsError } = await db.from("student_attempts").insert(
      results.map((r) => ({
        user_id: user.id,
        concept_id: attempt.concept_id!,
        attempt_type: "quiz",
        is_correct: r.isCorrect,
        difficulty: r.difficulty,
        score: r.isCorrect ? 100 : 0,
        response_time_ms: r.responseTimeMs,
        misconception_id: !r.isCorrect ? r.misconceptionId : null,
        reference_id: attempt.id,
      })),
    );
    if (attemptsError) throw attemptsError;

    await db
      .from("quiz_attempts")
      .update({
        score,
        correct_count: correctCount,
        completed_at: new Date().toISOString(),
        answers: results.map((r) => ({
          question_id: r.questionId,
          answer_index: r.answerIndex,
          is_correct: r.isCorrect,
        })),
      })
      .eq("id", attempt.id);

    // --- Misconceptions ----------------------------------------------------
    const wrongWithMisconception = results.filter((r) => !r.isCorrect && r.misconceptionId);
    const newlyDetected: Array<{ statement: string; correction: string }> = [];

    for (const wrong of wrongWithMisconception) {
      const { data: catalogue } = await db
        .from("concept_misconceptions")
        .select("id, statement, correction")
        .eq("id", wrong.misconceptionId!)
        .maybeSingle();
      if (!catalogue) continue;

      const { data: existing } = await db
        .from("student_misconceptions")
        .select("id, detected_count")
        .eq("user_id", user.id)
        .eq("concept_id", attempt.concept_id!)
        .eq("statement", catalogue.statement)
        .maybeSingle();

      if (existing) {
        await db
          .from("student_misconceptions")
          .update({
            detected_count: existing.detected_count + 1,
            last_detected_at: new Date().toISOString(),
            resolved: false,
            resolved_at: null,
          })
          .eq("id", existing.id);
      } else {
        await db.from("student_misconceptions").insert({
          user_id: user.id,
          concept_id: attempt.concept_id!,
          misconception_id: catalogue.id,
          statement: catalogue.statement,
          correction: catalogue.correction,
          source: "quiz",
        });
      }
      newlyDetected.push({ statement: catalogue.statement, correction: catalogue.correction });
    }

    // A misconception the student just answered correctly counts as resolved.
    const correctMisconceptionIds = results
      .filter((r) => r.isCorrect && r.misconceptionId)
      .map((r) => r.misconceptionId!);

    if (correctMisconceptionIds.length > 0) {
      await db
        .from("student_misconceptions")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("resolved", false)
        .in("misconception_id", correctMisconceptionIds);
    }

    // --- Session + derived state ------------------------------------------
    const totalTimeMs = results.reduce((sum, r) => sum + (r.responseTimeMs ?? 0), 0);
    await db.from("learning_sessions").insert({
      user_id: user.id,
      concept_id: attempt.concept_id,
      activity: "quiz",
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.round(totalTimeMs / 1000)),
    });

    const { data: updatedMastery } = await db
      .from("student_concept_mastery")
      .select("mastery, status, confidence, accuracy, attempts")
      .eq("user_id", user.id)
      .eq("concept_id", attempt.concept_id!)
      .maybeSingle();

    // Achievements are recomputed from measured data, never awarded by the client.
    const { data: newAchievementRows } = await db.rpc("evaluate_achievements", { _user_id: user.id });
    let newAchievements: Array<{ code: string; title: string; description: string; icon: string; points: number }> = [];
    if (newAchievementRows?.length) {
      const { data: defs } = await db
        .from("achievements")
        .select("id, code, title, description, icon, points")
        .in(
          "id",
          newAchievementRows.map((r: { achievement_id: string }) => r.achievement_id),
        );
      newAchievements = (defs ?? []).map(({ code, title, description, icon, points }) => ({
        code,
        title,
        description,
        icon,
        points,
      }));
    }

    return json({
      score,
      correctCount,
      totalQuestions: results.length,
      mastery: updatedMastery
        ? {
            value: Number(updatedMastery.mastery),
            status: updatedMastery.status,
            confidence: Number(updatedMastery.confidence),
            accuracy: Number(updatedMastery.accuracy),
            attempts: updatedMastery.attempts,
          }
        : null,
      misconceptions: newlyDetected,
      newAchievements,
      // Answer key is released only after submission.
      review: results.map((r) => ({
        questionId: r.questionId,
        question: r.question,
        options: r.options,
        answerIndex: r.answerIndex,
        correctIndex: r.correctIndex,
        isCorrect: r.isCorrect,
        explanation: r.explanation,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
});
