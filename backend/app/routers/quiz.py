"""
Adaptive quizzes: generate, then grade.

The split matters. `/quiz-start` writes the questions *and their answer key*
into `quiz_questions`, a table with no student SELECT policy, and returns only
the stems and options. `/quiz-submit` is the only place a comparison against
`correct_index` happens, and `student_attempts` — the table the mastery trigger
reads — has no client INSERT policy at all. So a student cannot post themselves
a score, and cannot read the answers before answering. Both properties survive
someone opening devtools and reading this file.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep
from ..db import admin_db
from ..errors import PublicError
from ..services import ai as gemini

router = APIRouter(tags=["quiz"])

QUESTION_COUNT = 5

QUESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "correct_index": {"type": "integer"},
                    "explanation": {"type": "string"},
                    "question_type": {
                        "type": "string",
                        "enum": ["conceptual", "scenario", "code", "implementation"],
                    },
                    "misconception_code": {"type": "string", "nullable": True},
                },
                "required": ["question", "options", "correct_index", "explanation", "question_type"],
            },
        }
    },
    "required": ["questions"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def difficulty_for(mastery: float, attempts: int) -> int:
    """Weak concepts get *easier* questions, not harder ones."""
    if attempts == 0:
        return 2
    if mastery >= 85:
        return 5
    if mastery >= 70:
        return 4
    if mastery >= 45:
        return 3
    if mastery >= 25:
        return 2
    return 1


class StartRequest(BaseModel):
    conceptId: str


class SubmittedAnswer(BaseModel):
    questionId: str
    answerIndex: int | None = None
    responseTimeMs: int | None = Field(default=None, ge=0)


class SubmitRequest(BaseModel):
    attemptId: str
    answers: list[SubmittedAnswer] = Field(default_factory=list)


@router.post("/quiz-start")
async def quiz_start(payload: StartRequest, user: CurrentUserDep) -> dict[str, Any]:
    gemini.require_configured()
    db = admin_db()

    concept = await db.maybe_single(
        "concepts",
        "id, title, summary, content, difficulty, status, chapters(title)",
        filters={"id": payload.conceptId},
    )
    if not concept or concept.get("status") != "published":
        raise PublicError("That concept is not available.", status=404, code="concept_not_found")

    mastery = await db.maybe_single(
        "student_concept_mastery",
        "mastery, attempts",
        filters={"user_id": user.id, "concept_id": payload.conceptId},
    )
    misconceptions = await db.select(
        "concept_misconceptions",
        "id, code, statement, correction",
        filters={"concept_id": payload.conceptId},
    )
    objectives = await db.select(
        "learning_objectives", "objective", filters={"concept_id": payload.conceptId}, order="position"
    )
    open_misconceptions = await db.select(
        "student_misconceptions",
        "statement",
        filters={"user_id": user.id, "concept_id": payload.conceptId, "resolved": False},
    )

    difficulty = difficulty_for(
        float(mastery.get("mastery", 0) if mastery else 0),
        int(mastery.get("attempts", 0) if mastery else 0),
    )

    catalogue = "\n".join(
        f'- {item["code"]}: students wrongly believe "{item["statement"]}" (truth: {item["correction"]})'
        for item in misconceptions
    )
    targeted = "\n".join(f'- {item["statement"]}' for item in open_misconceptions)

    system_lines = [
        "You write diagnostic multiple-choice questions for a data-structures course.",
        f"Write exactly {QUESTION_COUNT} questions on the concept below, at difficulty {difficulty} on a 1-5 scale.",
        "Every question has 4 options, exactly one correct. correct_index is 0-based.",
        "Distractors must be plausible and, wherever possible, each should embody a real misconception "
        "from the catalogue — set misconception_code to that code.",
        "The explanation says why the right answer is right AND why the tempting wrong one is wrong.",
        "Do not reference lecture numbers, page numbers, instructors or anything you were not given.",
        "",
        f"CONCEPT: {concept['title']}",
    ]
    if concept.get("summary"):
        system_lines.append(f"SUMMARY: {concept['summary']}")
    if objectives:
        joined = "\n".join(f"- {item['objective']}" for item in objectives)
        system_lines.append(f"LEARNING OBJECTIVES:\n{joined}")
    if catalogue:
        system_lines.append(f"MISCONCEPTION CATALOGUE:\n{catalogue}")
    if targeted:
        system_lines.append(
            f"THIS STUDENT CURRENTLY BELIEVES (target at least one question at these):\n{targeted}"
        )
    system_lines += ["", "LESSON MATERIAL:", (concept.get("content") or "")[:6000]]

    generated = await gemini.generate_json(
        [gemini.user_message(f"Generate the {QUESTION_COUNT} questions now.")],
        QUESTION_SCHEMA,
        system="\n".join(system_lines),
        temperature=0.6,
        max_output_tokens=2600,
    )

    code_to_id = {item["code"]: item["id"] for item in misconceptions}

    valid = [
        question
        for question in (generated or {}).get("questions", [])
        if isinstance(question.get("options"), list)
        and 2 <= len(question["options"]) <= 6
        and isinstance(question.get("correct_index"), int)
        and 0 <= question["correct_index"] < len(question["options"])
        and isinstance(question.get("question"), str)
        and isinstance(question.get("explanation"), str)
    ]

    if not valid:
        raise PublicError(
            "The AI returned no usable questions. Please try again.",
            status=502,
            code="quiz_generation_failed",
        )

    quiz = await db.insert_one(
        "quizzes",
        {
            "concept_id": payload.conceptId,
            "title": f"{concept['title']} — level {difficulty}",
            "source": "ai",
            "difficulty": difficulty,
            "status": "published",
        },
    )

    inserted = await db.insert(
        "quiz_questions",
        [
            {
                "quiz_id": quiz["id"],
                "question": question["question"],
                "options": question["options"],
                "correct_index": question["correct_index"],
                "explanation": question["explanation"],
                "question_type": question.get("question_type") or "conceptual",
                "difficulty": difficulty,
                "misconception_id": code_to_id.get(question.get("misconception_code") or ""),
                "position": index,
            }
            for index, question in enumerate(valid)
        ],
    )
    inserted.sort(key=lambda row: row["position"])

    attempt = await db.insert_one(
        "quiz_attempts",
        {
            "user_id": user.id,
            "quiz_id": quiz["id"],
            "concept_id": payload.conceptId,
            "total_questions": len(inserted),
            "difficulty": difficulty,
        },
    )

    return {
        "attemptId": attempt["id"],
        "quizId": quiz["id"],
        "conceptTitle": concept["title"],
        "difficulty": difficulty,
        # No correct_index, no explanation. The client cannot grade itself.
        "questions": [
            {
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "type": question["question_type"],
            }
            for question in inserted
        ],
    }


@router.post("/quiz-submit")
async def quiz_submit(payload: SubmitRequest, user: CurrentUserDep) -> dict[str, Any]:
    db = admin_db()

    attempt = await db.maybe_single(
        "quiz_attempts",
        "id, user_id, quiz_id, concept_id, difficulty, total_questions, completed_at",
        filters={"id": payload.attemptId},
    )
    if not attempt or attempt["user_id"] != user.id:
        raise PublicError("That quiz attempt was not found.", status=404, code="attempt_not_found")
    if attempt.get("completed_at"):
        raise PublicError("This quiz has already been submitted.", status=409, code="already_submitted")

    questions = await db.select(
        "quiz_questions",
        "id, question, options, correct_index, explanation, misconception_id, difficulty, position",
        filters={"quiz_id": attempt["quiz_id"]},
        order="position",
    )
    if not questions:
        raise PublicError("This quiz has no questions.", status=404, code="quiz_empty")

    submitted = {answer.questionId: answer for answer in payload.answers}

    results = []
    for question in questions:
        answer = submitted.get(question["id"])
        answer_index = answer.answerIndex if answer else None
        results.append(
            {
                "questionId": question["id"],
                "question": question["question"],
                "options": question["options"],
                "answerIndex": answer_index,
                "correctIndex": question["correct_index"],
                "isCorrect": answer_index == question["correct_index"],
                "explanation": question["explanation"],
                "misconceptionId": question["misconception_id"],
                "difficulty": question["difficulty"],
                "responseTimeMs": answer.responseTimeMs if answer else None,
            }
        )

    correct_count = sum(1 for result in results if result["isCorrect"])
    score = round(correct_count / len(results) * 100, 2)

    # One attempt row per question — this is what feeds the mastery trigger.
    await db.insert(
        "student_attempts",
        [
            {
                "user_id": user.id,
                "concept_id": attempt["concept_id"],
                "attempt_type": "quiz",
                "is_correct": result["isCorrect"],
                "difficulty": result["difficulty"],
                "score": 100 if result["isCorrect"] else 0,
                "response_time_ms": result["responseTimeMs"],
                "misconception_id": None if result["isCorrect"] else result["misconceptionId"],
                "reference_id": attempt["id"],
            }
            for result in results
        ],
        returning="minimal",
    )

    await db.update(
        "quiz_attempts",
        {
            "score": score,
            "correct_count": correct_count,
            "completed_at": now_iso(),
            "answers": [
                {
                    "question_id": result["questionId"],
                    "answer_index": result["answerIndex"],
                    "is_correct": result["isCorrect"],
                }
                for result in results
            ],
        },
        filters={"id": attempt["id"]},
    )

    newly_detected = await _record_misconceptions(db, user.id, attempt["concept_id"], results)

    total_ms = sum(result["responseTimeMs"] or 0 for result in results)
    await db.insert(
        "learning_sessions",
        {
            "user_id": user.id,
            "concept_id": attempt["concept_id"],
            "activity": "quiz",
            "ended_at": now_iso(),
            "duration_seconds": max(0, round(total_ms / 1000)),
        },
        returning="minimal",
    )

    updated = await db.maybe_single(
        "student_concept_mastery",
        "mastery, status, confidence, accuracy, attempts",
        filters={"user_id": user.id, "concept_id": attempt["concept_id"]},
    )

    return {
        "score": score,
        "correctCount": correct_count,
        "totalQuestions": len(results),
        "mastery": (
            {
                "value": float(updated["mastery"]),
                "status": updated["status"],
                "confidence": float(updated["confidence"]),
                "accuracy": float(updated["accuracy"]),
                "attempts": updated["attempts"],
            }
            if updated
            else None
        ),
        "misconceptions": newly_detected,
        "newAchievements": await award_achievements(user.id),
        # The answer key is released only now, after the answers are locked in.
        "review": [
            {
                "questionId": result["questionId"],
                "question": result["question"],
                "options": result["options"],
                "answerIndex": result["answerIndex"],
                "correctIndex": result["correctIndex"],
                "isCorrect": result["isCorrect"],
                "explanation": result["explanation"],
            }
            for result in results
        ],
    }


async def _record_misconceptions(
    db: Any, user_id: str, concept_id: str, results: list[dict[str, Any]]
) -> list[dict[str, str]]:
    """A wrong answer tied to a catalogued misconception is evidence of it."""
    detected: list[dict[str, str]] = []

    for result in results:
        if result["isCorrect"] or not result["misconceptionId"]:
            continue

        catalogue = await db.maybe_single(
            "concept_misconceptions",
            "id, statement, correction",
            filters={"id": result["misconceptionId"]},
        )
        if not catalogue:
            continue

        existing = await db.maybe_single(
            "student_misconceptions",
            "id, detected_count",
            filters={"user_id": user_id, "concept_id": concept_id, "statement": catalogue["statement"]},
        )
        if existing:
            await db.update(
                "student_misconceptions",
                {
                    "detected_count": existing["detected_count"] + 1,
                    "last_detected_at": now_iso(),
                    "resolved": False,
                    "resolved_at": None,
                },
                filters={"id": existing["id"]},
            )
        else:
            await db.insert(
                "student_misconceptions",
                {
                    "user_id": user_id,
                    "concept_id": concept_id,
                    "misconception_id": catalogue["id"],
                    "statement": catalogue["statement"],
                    "correction": catalogue["correction"],
                    "source": "quiz",
                },
                returning="minimal",
            )
        detected.append({"statement": catalogue["statement"], "correction": catalogue["correction"]})

    # Answering a misconception-bearing question correctly clears it.
    cleared = [
        result["misconceptionId"]
        for result in results
        if result["isCorrect"] and result["misconceptionId"]
    ]
    if cleared:
        await db.update(
            "student_misconceptions",
            {"resolved": True, "resolved_at": now_iso()},
            filters={"user_id": user_id, "resolved": False, "misconception_id": ("in", cleared)},
        )

    return detected


async def award_achievements(user_id: str) -> list[dict[str, Any]]:
    """
    Achievements are recomputed by a SQL function from measured rows. The client
    never claims one, and this returns only what the function actually granted.
    """
    db = admin_db()
    granted = await db.rpc("evaluate_achievements", {"_user_id": user_id})
    if not granted:
        return []

    ids = [row["achievement_id"] for row in granted if row.get("achievement_id")]
    if not ids:
        return []

    definitions = await db.select(
        "achievements", "code, title, description, icon, points", filters={"id": ("in", ids)}
    )
    return definitions
