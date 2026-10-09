"""
Talk2Code — the coding mentor, and the grader behind it.

`run` really executes the submission against the stored test cases and reports
what it observed. A pass here means a process exited and its output matched;
nothing asks a language model whether the code works. If the server has no
runtime for the chosen language, the response says exactly that instead of
quietly grading it as correct.

The mentor (`mentor`) and hints (`hint`) are deliberately separate actions and
never reveal a solution — the Deno version behaved the same way, and the rule
survives the port: a mentor that writes the answer is not a mentor.

Hidden test cases stay hidden even after a failure. Otherwise they are visible
cases with extra steps.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep
from ..config import settings
from ..db import admin_db
from ..errors import PublicError
from ..services import ai as gemini, sandbox
from .quiz import award_achievements

logger = logging.getLogger("eduverse.code")

router = APIRouter(tags=["code"])

MAX_CODE_CHARS = 20_000

Stage = Literal["approach", "pseudocode", "code", "complexity"]

STAGE_BRIEF: dict[str, str] = {
    "approach": (
        "The student is describing their plan in plain English. Judge the plan, not the syntax. "
        "If the plan is wrong, ask one question that exposes the flaw instead of correcting it "
        "outright."
    ),
    "pseudocode": (
        "The student is writing pseudocode. Check the control flow and the loop invariant. "
        "Do not write real code."
    ),
    "code": (
        "Review their code for correctness and clarity. Point at the first thing that would fail "
        "and why. Do not paste a corrected solution."
    ),
    "complexity": (
        "They are stating time and space complexity. Say whether it is right, and if not, ask "
        "what happens as n doubles."
    ),
}

MENTOR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["on_track", "needs_work", "off_track"]},
        "feedback": {"type": "string"},
        "next_question": {"type": "string", "nullable": True},
    },
    "required": ["verdict", "feedback"],
}


class HintRequest(BaseModel):
    problemId: str
    hintsUsed: int = Field(default=0, ge=0)


class MentorRequest(BaseModel):
    problemId: str
    stage: str = "approach"
    text: str = Field(min_length=1, max_length=MAX_CODE_CHARS)
    language: str = "python"


class RunRequest(BaseModel):
    problemId: str
    language: str = "python"
    code: str = Field(min_length=1, max_length=MAX_CODE_CHARS)
    durationSeconds: int = Field(default=0, ge=0, le=86_400)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def entry_name_from(starter: str, language: str, fallback: str = "solve") -> str:
    """The function the tests will call, taken from the starter code the student was given."""
    if language == "python":
        match = re.search(r"^\s*def\s+([A-Za-z_]\w*)\s*\(", starter, re.MULTILINE)
        return match.group(1) if match else fallback

    match = re.search(r"function\s+([A-Za-z_$][\w$]*)\s*\(", starter)
    if match:
        return match.group(1)
    match = re.search(r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(", starter)
    return match.group(1) if match else fallback


async def _load_problem(problem_id: str) -> dict[str, Any]:
    problem = await admin_db().maybe_single(
        "coding_problems",
        "id, concept_id, slug, title, prompt, difficulty, starter_code, test_cases, "
        "expected_complexity, hints, status",
        filters={"id": problem_id},
    )
    if not problem or problem.get("status") != "published":
        raise PublicError("That problem is not available.", status=404, code="problem_not_found")
    return problem


@router.get("/code/languages")
async def languages(user: CurrentUserDep) -> dict[str, Any]:
    """
    What this server can actually execute. The editor reads this so it can label
    a language as review-only rather than offering a Run button that will fail.
    """
    runnable = sandbox.runnable_languages()
    return {
        "runnable": runnable,
        "executionEnabled": bool(runnable),
        "note": (
            None
            if runnable
            else "Code execution is turned off on this server. The mentor and hints still work."
        ),
    }


@router.post("/code-hint")
async def code_hint(payload: HintRequest, user: CurrentUserDep) -> dict[str, Any]:
    problem = await _load_problem(payload.problemId)
    hints: list[str] = problem.get("hints") or []

    if payload.hintsUsed >= len(hints):
        raise PublicError(
            "There are no more hints for this problem.", status=404, code="no_more_hints"
        )

    return {
        "hint": hints[payload.hintsUsed],
        "hintsUsed": payload.hintsUsed + 1,
        "hintsTotal": len(hints),
    }


@router.post("/code-mentor")
async def code_mentor(payload: MentorRequest, user: CurrentUserDep) -> dict[str, Any]:
    gemini.require_configured()

    problem = await _load_problem(payload.problemId)
    stage = payload.stage if payload.stage in STAGE_BRIEF else "approach"
    text = payload.text.strip()
    if not text:
        raise PublicError("Write something first.", status=400, code="empty_text")

    system = "\n".join(
        part
        for part in [
            "You are a coding mentor. You never hand over the solution — you move the student "
            "one step forward.",
            STAGE_BRIEF[stage],
            "",
            f"PROBLEM: {problem['title']}",
            problem["prompt"],
            (
                f"TARGET COMPLEXITY: {problem['expected_complexity']}"
                if problem.get("expected_complexity")
                else ""
            ),
            "",
            "Reply in markdown, under 180 words.",
        ]
        if part is not None
    )

    feedback = await gemini.generate_json(
        [gemini.user_message(f"My {stage}:\n\n{text}")],
        MENTOR_SCHEMA,
        system=system,
        temperature=0.4,
        max_output_tokens=700,
    )

    await admin_db().insert(
        "coding_attempts",
        {
            "user_id": user.id,
            "problem_id": problem["id"],
            "stage": stage,
            "approach_text": text if stage in ("approach", "pseudocode") else None,
            "complexity_answer": text if stage == "complexity" else None,
            "code": text if stage == "code" else None,
            "language": payload.language,
        },
        returning="minimal",
    )

    return {
        "verdict": feedback.get("verdict", "needs_work"),
        "feedback": feedback["feedback"],
        "nextQuestion": feedback.get("next_question"),
    }


@router.post("/code-run")
async def code_run(payload: RunRequest, user: CurrentUserDep) -> dict[str, Any]:
    db = admin_db()
    problem = await _load_problem(payload.problemId)

    language = payload.language.lower().strip() or "python"
    code = payload.code.strip()
    if not code:
        raise PublicError("Write some code first.", status=400, code="empty_code")

    raw_cases: list[dict[str, Any]] = problem.get("test_cases") or []
    cases = [
        {
            "args": case.get("args") or case.get("input") or [],
            "expected": case.get("expected"),
            "hidden": bool(case.get("hidden")),
        }
        for case in raw_cases
        if isinstance(case, dict)
    ]
    if not cases:
        raise PublicError("This problem has no test cases yet.", status=409, code="no_test_cases")

    starter = (problem.get("starter_code") or {}).get(language, "")
    entry = entry_name_from(starter, language)

    # Raises `language_not_runnable` / `code_execution_disabled` rather than
    # guessing a result — the caller shows that as a real message.
    outcome = await sandbox.run_submission(language, code, entry, cases)

    tests_total = len(cases)

    if outcome.timed_out:
        await db.insert(
            "coding_attempts",
            {
                "user_id": user.id,
                "problem_id": problem["id"],
                "stage": "tests",
                "code": code,
                "language": language,
                "tests_total": tests_total,
                "tests_passed": 0,
                "is_solved": False,
            },
            returning="minimal",
        )
        return {
            "timedOut": True,
            "testsPassed": 0,
            "testsTotal": tests_total,
            "message": outcome.error,
            "stdout": outcome.stdout,
            "results": [],
        }

    # A compile/import error means no test ever ran — reported as its own state,
    # not as "0 of 8 passed", which would read like eight wrong answers.
    if outcome.error and not outcome.results:
        await db.insert(
            "coding_attempts",
            {
                "user_id": user.id,
                "problem_id": problem["id"],
                "stage": "code",
                "code": code,
                "language": language,
                "tests_total": tests_total,
                "tests_passed": 0,
                "is_solved": False,
            },
            returning="minimal",
        )
        return {
            "compileError": outcome.error,
            "testsPassed": 0,
            "testsTotal": tests_total,
            "stdout": outcome.stdout,
            "results": [],
        }

    results = outcome.results
    tests_passed = outcome.passed_count
    is_solved = tests_passed == tests_total and tests_total > 0

    await db.insert(
        "coding_attempts",
        {
            "user_id": user.id,
            "problem_id": problem["id"],
            "stage": "complete" if is_solved else "tests",
            "code": code,
            "language": language,
            "tests_total": tests_total,
            "tests_passed": tests_passed,
            "is_solved": is_solved,
        },
        returning="minimal",
    )

    # Real evidence — one attempt row, graded by execution, feeding mastery.
    if problem.get("concept_id"):
        await db.insert(
            "student_attempts",
            {
                "user_id": user.id,
                "concept_id": problem["concept_id"],
                "attempt_type": "coding",
                "is_correct": is_solved,
                "difficulty": problem["difficulty"],
                "score": round(tests_passed / tests_total * 100, 2),
                "reference_id": problem["id"],
            },
            returning="minimal",
        )
        await db.insert(
            "learning_sessions",
            {
                "user_id": user.id,
                "concept_id": problem["concept_id"],
                "activity": "coding",
                "ended_at": now_iso(),
                "duration_seconds": payload.durationSeconds,
            },
            returning="minimal",
        )

    new_achievements = await award_achievements(user.id) if is_solved else []

    coaching = await _coach_on_failure(problem, code, language, cases, results, is_solved)

    return {
        "language": language,
        "entry": entry,
        "testsPassed": tests_passed,
        "testsTotal": tests_total,
        "isSolved": is_solved,
        "coaching": coaching,
        "stdout": outcome.stdout,
        "newAchievements": [item["title"] for item in new_achievements],
        "results": [
            {
                "index": index,
                "hidden": cases[index]["hidden"],
                "passed": result.passed,
                "args": None if cases[index]["hidden"] else cases[index]["args"],
                "expected": None if cases[index]["hidden"] else cases[index]["expected"],
                "received": None if cases[index]["hidden"] else result.received,
                "error": result.error,
            }
            for index, result in enumerate(results)
            if index < len(cases)
        ],
    }


async def _coach_on_failure(
    problem: dict[str, Any],
    code: str,
    language: str,
    cases: list[dict[str, Any]],
    results: list[sandbox.CaseResult],
    is_solved: bool,
) -> str | None:
    """
    One short explanation of the *first* failure. Coaching is a bonus: if Gemini
    is unconfigured or down, grading still stands on its own.
    """
    if is_solved or not settings.ai_configured:
        return None

    first = next((index for index, result in enumerate(results) if not result.passed), -1)
    if first < 0 or first >= len(cases):
        return None

    case = cases[first]
    result = results[first]
    observed = f"an error: {result.error}" if result.error else (result.received or "nothing")

    try:
        return await gemini.generate(
            [
                gemini.user_message(
                    "\n".join(
                        [
                            "My code:",
                            f"```{language}",
                            code[:4000],
                            "```",
                            f"It failed on input {json.dumps(case['args'])}.",
                            f"Expected {json.dumps(case['expected'])}, got {observed}.",
                        ]
                    )
                )
            ],
            system="\n".join(
                [
                    "You are a coding mentor. In under 90 words, explain what is going wrong — "
                    "do not write the corrected code.",
                    f"PROBLEM: {problem['title']}",
                    (problem.get("prompt") or "")[:1200],
                ]
            ),
            temperature=0.3,
            max_output_tokens=400,
        )
    except Exception:
        logger.warning("Coaching unavailable for problem %s", problem["id"], exc_info=True)
        return None
