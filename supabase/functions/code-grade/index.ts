import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generate, generateJson, geminiConfigured } from "../_shared/gemini.ts";

/**
 * Talk2Code — the coding mentor.
 *
 * `run` really executes the student's JavaScript against the stored test cases.
 * Nothing here reports a pass it did not observe: if the code throws, the error
 * text is returned as-is, and if a language has no runtime available in this
 * environment the response says so rather than quietly grading it as correct.
 *
 * Python problems are still fully usable — the mentor reviews approach,
 * pseudocode and complexity — but `run` refuses them instead of pretending to
 * have executed them.
 */

type Action = "run" | "mentor" | "hint";

const RUN_TIMEOUT_MS = 4000;

/**
 * Executed inside a worker (or, where workers are unavailable, inside this
 * isolate). Kept as source text so both paths run byte-identical logic.
 */
const RUNNER_SOURCE = `
function normalise(value) {
  if (value === undefined) return "__undefined__";
  if (typeof value === "number" && Number.isNaN(value)) return "__nan__";
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = normalise(value[key]);
    return out;
  }
  return value;
}

function equal(a, b) {
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

function preview(value) {
  try {
    const text = JSON.stringify(normalise(value));
    return text === undefined ? String(value) : text.slice(0, 300);
  } catch (_) {
    return String(value).slice(0, 300);
  }
}

function runAll(code, entry, cases) {
  var fn;
  try {
    fn = new Function(code + "\\n; return typeof " + entry + " === 'function' ? " + entry + " : undefined;")();
  } catch (error) {
    return { compileError: String((error && error.message) || error) };
  }
  if (typeof fn !== "function") {
    return { compileError: 'No function named "' + entry + '" was found. Keep the function name from the starter code.' };
  }

  var results = [];
  for (var i = 0; i < cases.length; i++) {
    var test = cases[i];
    var startedAt = Date.now();
    try {
      var args = JSON.parse(JSON.stringify(test.args || []));
      var received = fn.apply(null, args);
      results.push({
        passed: equal(received, test.expected),
        received: preview(received),
        ms: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        passed: false,
        error: String((error && error.message) || error).slice(0, 300),
        ms: Date.now() - startedAt,
      });
    }
  }
  return { results: results };
}
`;

interface CaseResult {
  passed: boolean;
  received?: string;
  error?: string;
  ms?: number;
}

interface RunOutcome {
  compileError?: string;
  results?: CaseResult[];
}

/**
 * A worker can be terminated mid-loop, so an infinite loop in student code
 * costs one timeout instead of the whole request. Where the runtime has no
 * Worker, execution falls back to this isolate and the platform's own request
 * limit is the only guard — the response reports which happened.
 */
const runJavaScript = async (
  code: string,
  entry: string,
  cases: Array<{ args: unknown[]; expected: unknown }>,
): Promise<{ outcome: RunOutcome; sandbox: "worker" | "inline"; timedOut: boolean }> => {
  if (typeof Worker === "undefined") {
    const runAll = new Function(`${RUNNER_SOURCE}; return runAll;`)() as (
      c: string,
      e: string,
      t: unknown[],
    ) => RunOutcome;
    return { outcome: runAll(code, entry, cases), sandbox: "inline", timedOut: false };
  }

  const source = `${RUNNER_SOURCE}
self.onmessage = (event) => {
  const { code, entry, cases } = event.data;
  self.postMessage(runAll(code, entry, cases));
};`;

  const url = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
  const worker = new Worker(url, { type: "module" });

  try {
    const outcome = await new Promise<RunOutcome | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), RUN_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent) => {
        clearTimeout(timer);
        resolve(event.data as RunOutcome);
      };
      worker.onerror = (event: ErrorEvent) => {
        clearTimeout(timer);
        resolve({ compileError: event.message ?? "The code could not be loaded." });
      };
      worker.postMessage({ code, entry, cases });
    });

    if (outcome === null) {
      return { outcome: {}, sandbox: "worker", timedOut: true };
    }
    return { outcome, sandbox: "worker", timedOut: false };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
};

/** Derives the expected function name from the starter code, e.g. `removeValue`. */
const entryNameFrom = (starter: string, fallback: string): string =>
  starter.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/)?.[1] ??
  starter.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/)?.[1] ??
  fallback;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    const db = adminClient();

    const body = await req.json().catch(() => ({}));
    const action: Action = ["run", "mentor", "hint"].includes(body.action) ? body.action : "run";
    const problemId = typeof body.problemId === "string" ? body.problemId : null;
    if (!problemId) throw new PublicError("No problem was selected.", 400, "missing_problem");

    const { data: problem } = await db
      .from("coding_problems")
      .select(
        "id, concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status",
      )
      .eq("id", problemId)
      .maybeSingle();

    if (!problem || problem.status !== "published") {
      throw new PublicError("That problem is not available.", 404, "problem_not_found");
    }

    // ---- hint ------------------------------------------------------------
    if (action === "hint") {
      const hints = (problem.hints as string[]) ?? [];
      const used = Number.isInteger(body.hintsUsed) ? Math.max(0, body.hintsUsed) : 0;
      if (used >= hints.length) {
        throw new PublicError("There are no more hints for this problem.", 404, "no_more_hints");
      }
      return json({ hint: hints[used], hintsUsed: used + 1, hintsTotal: hints.length });
    }

    // ---- mentor ----------------------------------------------------------
    if (action === "mentor") {
      if (!geminiConfigured()) {
        throw new PublicError(
          "The coding mentor is not configured yet. An administrator needs to add a Gemini API key.",
          503,
          "ai_not_configured",
        );
      }

      const stage = ["approach", "pseudocode", "code", "complexity"].includes(body.stage)
        ? (body.stage as string)
        : "approach";
      const studentText = typeof body.text === "string" ? body.text.trim() : "";
      if (!studentText) throw new PublicError("Write something first.", 400, "empty_text");

      const stageBrief: Record<string, string> = {
        approach:
          "The student is describing their plan in plain English. Judge the plan, not the syntax. If the plan is wrong, ask one question that exposes the flaw instead of correcting it outright.",
        pseudocode:
          "The student is writing pseudocode. Check the control flow and the loop invariant. Do not write real code.",
        code: "Review their code for correctness and clarity. Point at the first thing that would fail and why. Do not paste a corrected solution.",
        complexity:
          "They are stating time and space complexity. Say whether it is right, and if not, ask what happens as n doubles.",
      };

      const feedback = await generateJson<{
        verdict: "on_track" | "needs_work" | "off_track";
        feedback: string;
        next_question: string | null;
      }>({
        system: [
          "You are a coding mentor. You never hand over the solution — you move the student one step forward.",
          stageBrief[stage],
          "",
          `PROBLEM: ${problem.title}`,
          problem.prompt,
          problem.expected_complexity ? `TARGET COMPLEXITY: ${problem.expected_complexity}` : "",
          "",
          "Reply in markdown, under 180 words.",
        ]
          .filter(Boolean)
          .join("\n"),
        turns: [{ role: "user", content: `My ${stage}:\n\n${studentText}` }],
        temperature: 0.4,
        maxOutputTokens: 700,
        responseSchema: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["on_track", "needs_work", "off_track"] },
            feedback: { type: "string" },
            next_question: { type: "string", nullable: true },
          },
          required: ["verdict", "feedback"],
        },
      });

      await db.from("coding_attempts").insert({
        user_id: user.id,
        problem_id: problem.id,
        stage,
        approach_text: stage === "approach" || stage === "pseudocode" ? studentText : null,
        complexity_answer: stage === "complexity" ? studentText : null,
        code: stage === "code" ? studentText : null,
        language: typeof body.language === "string" ? body.language : "javascript",
      });

      return json(feedback);
    }

    // ---- run -------------------------------------------------------------
    const language = typeof body.language === "string" ? body.language : "javascript";
    const code = typeof body.code === "string" ? body.code : "";
    if (!code.trim()) throw new PublicError("Write some code first.", 400, "empty_code");
    if (code.length > 20000) throw new PublicError("That submission is too long.", 400, "code_too_long");

    if (language !== "javascript") {
      throw new PublicError(
        `EduVerse can only execute JavaScript submissions right now, so ${language} code cannot be tested here. Switch the editor to JavaScript to run the tests, or use "Review my code" for mentor feedback on your ${language} solution.`,
        400,
        "language_not_runnable",
      );
    }

    const cases = ((problem.test_cases as Array<{ args: unknown[]; expected: unknown; hidden?: boolean }>) ?? []).map(
      (c) => ({ args: c.args ?? [], expected: c.expected, hidden: Boolean(c.hidden) }),
    );
    if (cases.length === 0) {
      throw new PublicError("This problem has no test cases yet.", 409, "no_test_cases");
    }

    const entry = entryNameFrom(((problem.starter_code as Record<string, string>) ?? {}).javascript ?? "", "solve");
    const { outcome, sandbox, timedOut } = await runJavaScript(code, entry, cases);

    if (timedOut) {
      await db.from("coding_attempts").insert({
        user_id: user.id,
        problem_id: problem.id,
        stage: "tests",
        code,
        language,
        tests_total: cases.length,
        tests_passed: 0,
        is_solved: false,
      });
      return json({
        timedOut: true,
        testsPassed: 0,
        testsTotal: cases.length,
        message: `Your code ran for more than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. That usually means a loop never ends.`,
        results: [],
      });
    }

    if (outcome.compileError) {
      await db.from("coding_attempts").insert({
        user_id: user.id,
        problem_id: problem.id,
        stage: "code",
        code,
        language,
        tests_total: cases.length,
        tests_passed: 0,
        is_solved: false,
      });
      return json({
        compileError: outcome.compileError,
        testsPassed: 0,
        testsTotal: cases.length,
        results: [],
      });
    }

    const results = outcome.results ?? [];
    const testsPassed = results.filter((r) => r.passed).length;
    const isSolved = testsPassed === cases.length;

    await db.from("coding_attempts").insert({
      user_id: user.id,
      problem_id: problem.id,
      stage: isSolved ? "complete" : "tests",
      code,
      language,
      tests_total: cases.length,
      tests_passed: testsPassed,
      is_solved: isSolved,
    });

    // Real evidence — one attempt row, graded by execution, feeding mastery.
    if (problem.concept_id) {
      await db.from("student_attempts").insert({
        user_id: user.id,
        concept_id: problem.concept_id,
        attempt_type: "coding",
        is_correct: isSolved,
        difficulty: problem.difficulty,
        score: Number(((testsPassed / cases.length) * 100).toFixed(2)),
        reference_id: problem.id,
      });

      await db.from("learning_sessions").insert({
        user_id: user.id,
        concept_id: problem.concept_id,
        activity: "coding",
        ended_at: new Date().toISOString(),
        duration_seconds: Number.isInteger(body.durationSeconds) ? Math.max(0, body.durationSeconds) : 0,
      });
    }

    let newAchievements: string[] = [];
    if (isSolved) {
      const { data: rows } = await db.rpc("evaluate_achievements", { _user_id: user.id });
      if (rows?.length) {
        const { data: defs } = await db
          .from("achievements")
          .select("title")
          .in("id", rows.map((r: { achievement_id: string }) => r.achievement_id));
        newAchievements = (defs ?? []).map((d) => d.title);
      }
    }

    // A failing submission gets one short, honest explanation of the first
    // failure — only when the AI is actually available.
    let coaching: string | null = null;
    const firstFailure = results.findIndex((r) => !r.passed);
    if (!isSolved && firstFailure >= 0 && geminiConfigured()) {
      try {
        coaching = await generate({
          system: [
            "You are a coding mentor. In under 90 words, explain what is going wrong — do not write the corrected code.",
            `PROBLEM: ${problem.title}`,
            problem.prompt.slice(0, 1200),
          ].join("\n"),
          turns: [
            {
              role: "user",
              content: [
                "My code:",
                "```javascript",
                code.slice(0, 4000),
                "```",
                `It failed on input ${JSON.stringify(cases[firstFailure].args)}.`,
                `Expected ${JSON.stringify(cases[firstFailure].expected)}, got ${
                  results[firstFailure].error ? `an error: ${results[firstFailure].error}` : results[firstFailure].received
                }.`,
              ].join("\n"),
            },
          ],
          temperature: 0.3,
          maxOutputTokens: 400,
        });
      } catch (cause) {
        // Coaching is a bonus; never fail the grading because the AI is down.
        console.error("Coaching unavailable:", cause);
      }
    }

    return json({
      sandbox,
      testsPassed,
      testsTotal: cases.length,
      isSolved,
      coaching,
      newAchievements,
      results: results.map((r, i) => ({
        index: i,
        hidden: cases[i].hidden,
        passed: r.passed,
        durationMs: r.ms ?? null,
        // Hidden cases stay hidden even after a failure — otherwise they are
        // just visible cases with extra steps.
        args: cases[i].hidden ? null : cases[i].args,
        expected: cases[i].hidden ? null : cases[i].expected,
        received: cases[i].hidden ? null : (r.received ?? null),
        error: r.error ?? null,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
});
