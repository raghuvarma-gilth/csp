import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateJson, geminiConfigured } from "../_shared/gemini.ts";

/**
 * Starts an adaptive quiz for one concept.
 *
 * The answer key never leaves the server: quiz_questions has no student SELECT
 * policy, and the payload below deliberately omits correct_index and
 * explanation. Grading happens in quiz-submit.
 */

const QUESTION_COUNT = 5;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer" },
          explanation: { type: "string" },
          question_type: { type: "string", enum: ["conceptual", "scenario", "code", "implementation"] },
          misconception_code: { type: "string", nullable: true },
        },
        required: ["question", "options", "correct_index", "explanation", "question_type"],
      },
    },
  },
  required: ["questions"],
};

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  question_type: "conceptual" | "scenario" | "code" | "implementation";
  misconception_code?: string | null;
}

/** Mastery drives the level: weak concepts get easier questions, not harder. */
const difficultyFor = (mastery: number, attempts: number): number => {
  if (attempts === 0) return 2;
  if (mastery >= 85) return 5;
  if (mastery >= 70) return 4;
  if (mastery >= 45) return 3;
  if (mastery >= 25) return 2;
  return 1;
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (!geminiConfigured()) {
      throw new PublicError(
        "Adaptive quizzes are not configured yet. An administrator needs to add a Gemini API key to this project.",
        503,
        "ai_not_configured",
      );
    }

    const user = await requireUser(req);
    const db = adminClient();

    const body = await req.json().catch(() => ({}));
    const conceptId = typeof body.conceptId === "string" ? body.conceptId : null;
    if (!conceptId) throw new PublicError("No concept was selected.", 400, "missing_concept");

    const { data: concept } = await db
      .from("concepts")
      .select("id, title, summary, content, difficulty, status, chapters(title)")
      .eq("id", conceptId)
      .maybeSingle();

    if (!concept || concept.status !== "published") {
      throw new PublicError("That concept is not available.", 404, "concept_not_found");
    }

    const [{ data: mastery }, { data: misconceptions }, { data: objectives }, { data: openMisconceptions }] =
      await Promise.all([
        db
          .from("student_concept_mastery")
          .select("mastery, attempts")
          .eq("user_id", user.id)
          .eq("concept_id", conceptId)
          .maybeSingle(),
        db.from("concept_misconceptions").select("id, code, statement, correction").eq("concept_id", conceptId),
        db.from("learning_objectives").select("objective").eq("concept_id", conceptId).order("position"),
        db
          .from("student_misconceptions")
          .select("statement")
          .eq("user_id", user.id)
          .eq("concept_id", conceptId)
          .eq("resolved", false),
      ]);

    const difficulty = difficultyFor(Number(mastery?.mastery ?? 0), Number(mastery?.attempts ?? 0));

    const misconceptionCatalogue = (misconceptions ?? [])
      .map((m) => `- ${m.code}: students wrongly believe "${m.statement}" (truth: ${m.correction})`)
      .join("\n");

    const targeted = (openMisconceptions ?? []).map((m) => `- ${m.statement}`).join("\n");

    const system = [
      "You write diagnostic multiple-choice questions for a data-structures course.",
      `Write exactly ${QUESTION_COUNT} questions on the concept below, at difficulty ${difficulty} on a 1-5 scale.`,
      "Every question has 4 options, exactly one correct. correct_index is 0-based.",
      "Distractors must be plausible and, wherever possible, each should embody a real misconception from the catalogue — set misconception_code to that code.",
      "The explanation says why the right answer is right AND why the tempting wrong one is wrong.",
      "Do not reference lecture numbers, page numbers, instructors or anything you were not given.",
      "",
      `CONCEPT: ${concept.title}`,
      concept.summary ? `SUMMARY: ${concept.summary}` : "",
      objectives?.length ? `LEARNING OBJECTIVES:\n${objectives.map((o) => `- ${o.objective}`).join("\n")}` : "",
      misconceptionCatalogue ? `MISCONCEPTION CATALOGUE:\n${misconceptionCatalogue}` : "",
      targeted ? `THIS STUDENT CURRENTLY BELIEVES (target at least one question at these):\n${targeted}` : "",
      "",
      "LESSON MATERIAL:",
      (concept.content ?? "").slice(0, 6000),
    ]
      .filter(Boolean)
      .join("\n");

    const generated = await generateJson<{ questions: GeneratedQuestion[] }>({
      system,
      turns: [{ role: "user", content: `Generate the ${QUESTION_COUNT} questions now.` }],
      temperature: 0.6,
      maxOutputTokens: 2600,
      responseSchema: SCHEMA,
    });

    const codeToId = new Map((misconceptions ?? []).map((m) => [m.code, m.id]));

    const valid = (generated.questions ?? []).filter(
      (q) =>
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.length <= 6 &&
        Number.isInteger(q.correct_index) &&
        q.correct_index >= 0 &&
        q.correct_index < q.options.length &&
        typeof q.question === "string" &&
        typeof q.explanation === "string",
    );

    if (valid.length === 0) {
      throw new PublicError(
        "The AI returned no usable questions. Please try again.",
        502,
        "quiz_generation_failed",
      );
    }

    const { data: quiz, error: quizError } = await db
      .from("quizzes")
      .insert({
        concept_id: conceptId,
        title: `${concept.title} — level ${difficulty}`,
        source: "ai",
        difficulty,
        status: "published",
      })
      .select("id")
      .single();
    if (quizError) throw quizError;

    const { data: inserted, error: questionsError } = await db
      .from("quiz_questions")
      .insert(
        valid.map((q, index) => ({
          quiz_id: quiz.id,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          question_type: q.question_type ?? "conceptual",
          difficulty,
          misconception_id: q.misconception_code ? (codeToId.get(q.misconception_code) ?? null) : null,
          position: index,
        })),
      )
      .select("id, question, options, question_type, position")
      .order("position");
    if (questionsError) throw questionsError;

    const { data: attempt, error: attemptError } = await db
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        quiz_id: quiz.id,
        concept_id: conceptId,
        total_questions: inserted.length,
        difficulty,
      })
      .select("id")
      .single();
    if (attemptError) throw attemptError;

    return json({
      attemptId: attempt.id,
      quizId: quiz.id,
      conceptTitle: concept.title,
      difficulty,
      // No correct_index, no explanation. The client cannot grade itself.
      questions: inserted.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options as string[],
        type: q.question_type,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
});
