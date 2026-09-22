import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateJson, geminiConfigured } from "../_shared/gemini.ts";

/**
 * Adaptive placement check.
 *
 * Every answer is written to student_attempts as real evidence, so the mastery
 * it produces comes from the same trigger as everything else — the diagnostic
 * does not "seed" scores it did not measure. Concepts that were never reached
 * are reported as unassessed, not as zero.
 *
 * The answer key is held in quiz_questions, which has no student SELECT policy,
 * so nothing the browser can read reveals the correct option before answering.
 */

const MAX_QUESTIONS = 10;

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correct_index: { type: "integer" },
    explanation: { type: "string" },
  },
  required: ["question", "options", "correct_index", "explanation"],
};

interface Generated {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface SessionState {
  quiz_id?: string;
  plan?: string[];
  pending_question_id?: string | null;
  strong?: string[];
  weak?: string[];
  unassessed?: string[];
}

const clampDifficulty = (value: number) => Math.min(5, Math.max(1, value));

const generateQuestion = async (
  concept: { title: string; summary: string | null; content: string | null },
  difficulty: number,
): Promise<Generated> => {
  const result = await generateJson<Generated>({
    system: [
      "You write a single diagnostic multiple-choice question for a data-structures course.",
      `Difficulty ${difficulty} on a 1-5 scale, where 1 is recall and 5 needs reasoning about an unfamiliar case.`,
      "Exactly 4 options, exactly one correct, correct_index is 0-based.",
      "Distractors must be beliefs a real student holds, not obvious throwaways.",
      "The explanation is one or two sentences and says why the correct option is correct.",
      "Do not mention lectures, page numbers, instructors or anything you were not given.",
      "",
      `CONCEPT: ${concept.title}`,
      concept.summary ? `SUMMARY: ${concept.summary}` : "",
      concept.content ? `MATERIAL:\n${concept.content.slice(0, 4000)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    turns: [{ role: "user", content: "Write the question now." }],
    temperature: 0.6,
    maxOutputTokens: 700,
    responseSchema: QUESTION_SCHEMA,
  });

  const valid =
    Array.isArray(result.options) &&
    result.options.length >= 2 &&
    result.options.length <= 6 &&
    Number.isInteger(result.correct_index) &&
    result.correct_index >= 0 &&
    result.correct_index < result.options.length;

  if (!valid) {
    throw new PublicError("The AI returned an unusable question. Please try again.", 502, "question_generation_failed");
  }
  return result;
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (!geminiConfigured()) {
      throw new PublicError(
        "The placement check is not configured yet. An administrator needs to add a Gemini API key to this project.",
        503,
        "ai_not_configured",
      );
    }

    const user = await requireUser(req);
    const db = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = body.action === "answer" ? "answer" : body.action === "abandon" ? "abandon" : "start";

    // ---- start -----------------------------------------------------------
    if (action === "start") {
      const chapterId = typeof body.chapterId === "string" ? body.chapterId : null;

      let query = db
        .from("concepts")
        .select("id, title, summary, content, position, chapter_id, chapters(title, position)")
        .eq("status", "published");
      if (chapterId) query = query.eq("chapter_id", chapterId);

      const { data: concepts, error: conceptsError } = await query;
      if (conceptsError) throw conceptsError;
      if (!concepts?.length) {
        throw new PublicError("There is no published material to assess yet.", 404, "no_concepts");
      }

      const ordered = [...concepts].sort((a, b) => {
        const ca = (a.chapters as { position: number } | null)?.position ?? 0;
        const cb = (b.chapters as { position: number } | null)?.position ?? 0;
        return ca - cb || a.position - b.position;
      });
      const plan = ordered.slice(0, MAX_QUESTIONS).map((c) => c.id);

      // Abandon any check they walked away from, so "in_progress" means one thing.
      await db
        .from("diagnostic_sessions")
        .update({ status: "abandoned" })
        .eq("user_id", user.id)
        .eq("status", "in_progress");

      const { data: quiz, error: quizError } = await db
        .from("quizzes")
        .insert({ title: "Placement check", source: "ai", difficulty: 2, status: "draft" })
        .select("id")
        .single();
      if (quizError) throw quizError;

      const { data: session, error: sessionError } = await db
        .from("diagnostic_sessions")
        .insert({
          user_id: user.id,
          chapter_id: chapterId,
          current_difficulty: 2,
          result: { quiz_id: quiz.id, plan } satisfies SessionState,
        })
        .select("id, current_difficulty, questions_asked, result")
        .single();
      if (sessionError) throw sessionError;

      const first = ordered[0];
      const generated = await generateQuestion(first, 2);

      const { data: stored, error: storeError } = await db
        .from("quiz_questions")
        .insert({
          quiz_id: quiz.id,
          question: generated.question,
          options: generated.options,
          correct_index: generated.correct_index,
          explanation: generated.explanation,
          difficulty: 2,
          position: 0,
        })
        .select("id")
        .single();
      if (storeError) throw storeError;

      await db
        .from("diagnostic_sessions")
        .update({ result: { quiz_id: quiz.id, plan, pending_question_id: stored.id } satisfies SessionState })
        .eq("id", session.id);

      return json({
        sessionId: session.id,
        position: 1,
        total: plan.length,
        difficulty: 2,
        conceptTitle: first.title,
        question: { id: stored.id, question: generated.question, options: generated.options },
      });
    }

    // ---- shared session lookup -------------------------------------------
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) throw new PublicError("No placement check was provided.", 400, "missing_session");

    const { data: session } = await db
      .from("diagnostic_sessions")
      .select("id, user_id, status, current_difficulty, questions_asked, correct_count, result, chapter_id, started_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.user_id !== user.id) {
      throw new PublicError("That placement check was not found.", 404, "session_not_found");
    }

    if (action === "abandon") {
      await db.from("diagnostic_sessions").update({ status: "abandoned" }).eq("id", session.id);
      return json({ status: "abandoned" });
    }

    if (session.status !== "in_progress") {
      throw new PublicError("This placement check is already finished.", 409, "session_closed");
    }

    // ---- answer ----------------------------------------------------------
    const state = (session.result ?? {}) as SessionState;
    const plan = state.plan ?? [];
    const questionId = typeof body.questionId === "string" ? body.questionId : null;
    const answerIndex = Number.isInteger(body.answerIndex) ? body.answerIndex : null;

    if (!questionId || questionId !== state.pending_question_id) {
      throw new PublicError("That question is no longer the current one.", 409, "stale_question");
    }

    const { data: question } = await db
      .from("quiz_questions")
      .select("id, question, options, correct_index, explanation, difficulty, position")
      .eq("id", questionId)
      .maybeSingle();
    if (!question) throw new PublicError("That question was not found.", 404, "question_not_found");

    const conceptId = plan[question.position] ?? null;
    const isCorrect = answerIndex === question.correct_index;

    await db.from("diagnostic_responses").insert({
      session_id: session.id,
      concept_id: conceptId,
      question: {
        id: question.id,
        question: question.question,
        options: question.options,
        correct_index: question.correct_index,
        explanation: question.explanation,
      },
      answer_index: answerIndex,
      is_correct: isCorrect,
      difficulty: question.difficulty,
      position: question.position,
    });

    // The student really answered this — it counts, exactly like a quiz answer.
    if (conceptId) {
      await db.from("student_attempts").insert({
        user_id: user.id,
        concept_id: conceptId,
        attempt_type: "diagnostic",
        is_correct: isCorrect,
        difficulty: question.difficulty,
        score: isCorrect ? 100 : 0,
        reference_id: session.id,
      });
    }

    const questionsAsked = session.questions_asked + 1;
    const correctCount = session.correct_count + (isCorrect ? 1 : 0);
    const nextDifficulty = clampDifficulty(session.current_difficulty + (isCorrect ? 1 : -1));
    const nextIndex = question.position + 1;
    const finished = nextIndex >= plan.length || questionsAsked >= MAX_QUESTIONS;

    const feedback = {
      isCorrect,
      correctIndex: question.correct_index,
      explanation: question.explanation,
    };

    if (!finished) {
      const { data: nextConcept } = await db
        .from("concepts")
        .select("id, title, summary, content")
        .eq("id", plan[nextIndex])
        .maybeSingle();
      if (!nextConcept) throw new PublicError("The next concept could not be loaded.", 500, "concept_missing");

      const generated = await generateQuestion(nextConcept, nextDifficulty);
      const { data: stored, error: storeError } = await db
        .from("quiz_questions")
        .insert({
          quiz_id: state.quiz_id!,
          question: generated.question,
          options: generated.options,
          correct_index: generated.correct_index,
          explanation: generated.explanation,
          difficulty: nextDifficulty,
          position: nextIndex,
        })
        .select("id")
        .single();
      if (storeError) throw storeError;

      await db
        .from("diagnostic_sessions")
        .update({
          questions_asked: questionsAsked,
          correct_count: correctCount,
          current_difficulty: nextDifficulty,
          result: { ...state, pending_question_id: stored.id } satisfies SessionState,
        })
        .eq("id", session.id);

      return json({
        feedback,
        position: nextIndex + 1,
        total: plan.length,
        difficulty: nextDifficulty,
        conceptTitle: nextConcept.title,
        question: { id: stored.id, question: generated.question, options: generated.options },
      });
    }

    // ---- finish ----------------------------------------------------------
    const { data: responses } = await db
      .from("diagnostic_responses")
      .select("concept_id, is_correct, difficulty")
      .eq("session_id", session.id);

    const answeredConcepts = new Set((responses ?? []).map((r) => r.concept_id).filter(Boolean) as string[]);
    const strong = (responses ?? []).filter((r) => r.is_correct).map((r) => r.concept_id).filter(Boolean) as string[];
    const weak = (responses ?? []).filter((r) => !r.is_correct).map((r) => r.concept_id).filter(Boolean) as string[];
    const unassessed = plan.filter((id) => !answeredConcepts.has(id));

    const score = Number(((correctCount / questionsAsked) * 100).toFixed(2));

    await db
      .from("diagnostic_sessions")
      .update({
        status: "completed",
        questions_asked: questionsAsked,
        correct_count: correctCount,
        current_difficulty: nextDifficulty,
        score,
        completed_at: new Date().toISOString(),
        result: { ...state, pending_question_id: null, strong, weak, unassessed } satisfies SessionState,
      })
      .eq("id", session.id);

    await db.from("learning_sessions").insert({
      user_id: user.id,
      activity: "diagnostic",
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(
        0,
        Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000),
      ),
    });

    const titlesFor = async (ids: string[]) => {
      if (ids.length === 0) return [];
      const { data } = await db.from("concepts").select("id, title, slug").in("id", ids);
      return data ?? [];
    };

    const [strongConcepts, weakConcepts, unassessedConcepts] = await Promise.all([
      titlesFor(strong),
      titlesFor(weak),
      titlesFor(unassessed),
    ]);

    return json({
      feedback,
      completed: true,
      score,
      questionsAsked,
      correctCount,
      strong: strongConcepts,
      weak: weakConcepts,
      // Never reached, so never guessed at.
      unassessed: unassessedConcepts,
    });
  } catch (error) {
    return handleError(error);
  }
});
