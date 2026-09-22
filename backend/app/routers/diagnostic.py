"""
Adaptive placement check.

Every answer is written to `student_attempts` as real evidence, so the mastery
it produces comes from the same trigger as everything else — the diagnostic does
not "seed" scores it did not measure. Concepts that were never reached are
reported as unassessed, not as zero, because a concept nobody asked about is not
a concept the student failed.

The answer key lives in `quiz_questions`, which has no student SELECT policy, so
nothing the browser can read reveals the correct option before answering. The
`pending_question_id` guard means an old question cannot be re-submitted to farm
a second attempt at the same item.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep
from ..db import admin_db
from ..errors import PublicError
from ..services import gemini

router = APIRouter(tags=["diagnostic"])

MAX_QUESTIONS = 10

QUESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "question": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},
        "correct_index": {"type": "integer"},
        "explanation": {"type": "string"},
    },
    "required": ["question", "options", "correct_index", "explanation"],
}


class StartRequest(BaseModel):
    chapterId: str | None = None


class AnswerRequest(BaseModel):
    sessionId: str
    questionId: str
    answerIndex: int | None = Field(default=None, ge=0, le=10)


class AbandonRequest(BaseModel):
    sessionId: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp_difficulty(value: int) -> int:
    return min(5, max(1, value))


async def _generate_question(concept: dict[str, Any], difficulty: int) -> dict[str, Any]:
    system = "\n".join(
        part
        for part in [
            "You write a single diagnostic multiple-choice question for a data-structures course.",
            f"Difficulty {difficulty} on a 1-5 scale, where 1 is recall and 5 needs reasoning "
            "about an unfamiliar case.",
            "Exactly 4 options, exactly one correct, correct_index is 0-based.",
            "Distractors must be beliefs a real student holds, not obvious throwaways.",
            "The explanation is one or two sentences and says why the correct option is correct.",
            "Do not mention lectures, page numbers, instructors or anything you were not given.",
            "",
            f"CONCEPT: {concept['title']}",
            f"SUMMARY: {concept['summary']}" if concept.get("summary") else "",
            f"MATERIAL:\n{(concept.get('content') or '')[:4000]}" if concept.get("content") else "",
        ]
        if part
    )

    result = await gemini.generate_json(
        [gemini.user_message("Write the question now.")],
        QUESTION_SCHEMA,
        system=system,
        temperature=0.6,
        max_output_tokens=700,
    )

    options = result.get("options") if isinstance(result, dict) else None
    correct = result.get("correct_index") if isinstance(result, dict) else None
    usable = (
        isinstance(options, list)
        and 2 <= len(options) <= 6
        and isinstance(correct, int)
        and 0 <= correct < len(options)
    )
    if not usable:
        raise PublicError(
            "The AI returned an unusable question. Please try again.",
            status=502,
            code="question_generation_failed",
        )
    return result


async def _store_question(
    quiz_id: str, generated: dict[str, Any], difficulty: int, position: int
) -> dict[str, Any]:
    return await admin_db().insert_one(
        "quiz_questions",
        {
            "quiz_id": quiz_id,
            "question": generated["question"],
            "options": generated["options"],
            "correct_index": generated["correct_index"],
            "explanation": generated["explanation"],
            "difficulty": difficulty,
            "position": position,
        },
    )


@router.post("/diagnostic/start")
async def diagnostic_start(payload: StartRequest, user: CurrentUserDep) -> dict[str, Any]:
    gemini.require_configured()
    db = admin_db()

    filters: dict[str, Any] = {"status": "published"}
    if payload.chapterId:
        filters["chapter_id"] = payload.chapterId

    concepts = await db.select(
        "concepts",
        "id, title, summary, content, position, chapter_id, chapters(title, position)",
        filters=filters,
    )
    if not concepts:
        raise PublicError(
            "There is no published material to assess yet.", status=404, code="no_concepts"
        )

    ordered = sorted(
        concepts,
        key=lambda concept: (
            (concept.get("chapters") or {}).get("position", 0),
            concept.get("position", 0),
        ),
    )
    plan = [concept["id"] for concept in ordered[:MAX_QUESTIONS]]

    # Abandon anything they walked away from, so "in_progress" means one thing.
    await db.update(
        "diagnostic_sessions",
        {"status": "abandoned"},
        filters={"user_id": user.id, "status": "in_progress"},
    )

    # status "draft" — this quiz is a container for the answer key, not a
    # published quiz anyone can open.
    quiz = await db.insert_one(
        "quizzes",
        {"title": "Placement check", "source": "ai", "difficulty": 2, "status": "draft"},
    )
    session = await db.insert_one(
        "diagnostic_sessions",
        {
            "user_id": user.id,
            "chapter_id": payload.chapterId,
            "current_difficulty": 2,
            "result": {"quiz_id": quiz["id"], "plan": plan},
        },
    )

    generated = await _generate_question(ordered[0], 2)
    stored = await _store_question(quiz["id"], generated, 2, 0)

    await db.update(
        "diagnostic_sessions",
        {"result": {"quiz_id": quiz["id"], "plan": plan, "pending_question_id": stored["id"]}},
        filters={"id": session["id"]},
    )

    return {
        "sessionId": session["id"],
        "position": 1,
        "total": len(plan),
        "difficulty": 2,
        "conceptTitle": ordered[0]["title"],
        "question": {
            "id": stored["id"],
            "question": generated["question"],
            "options": generated["options"],
        },
    }


async def _load_session(session_id: str, user_id: str) -> dict[str, Any]:
    session = await admin_db().maybe_single(
        "diagnostic_sessions",
        "id, user_id, status, current_difficulty, questions_asked, correct_count, result, "
        "chapter_id, started_at",
        filters={"id": session_id},
    )
    if not session or session["user_id"] != user_id:
        raise PublicError(
            "That placement check was not found.", status=404, code="session_not_found"
        )
    return session


@router.post("/diagnostic/abandon")
async def diagnostic_abandon(payload: AbandonRequest, user: CurrentUserDep) -> dict[str, Any]:
    session = await _load_session(payload.sessionId, user.id)
    await admin_db().update(
        "diagnostic_sessions", {"status": "abandoned"}, filters={"id": session["id"]}
    )
    return {"status": "abandoned"}


@router.post("/diagnostic/answer")
async def diagnostic_answer(payload: AnswerRequest, user: CurrentUserDep) -> dict[str, Any]:
    gemini.require_configured()
    db = admin_db()

    session = await _load_session(payload.sessionId, user.id)
    if session["status"] != "in_progress":
        raise PublicError(
            "This placement check is already finished.", status=409, code="session_closed"
        )

    state: dict[str, Any] = session.get("result") or {}
    plan: list[str] = state.get("plan") or []

    if payload.questionId != state.get("pending_question_id"):
        raise PublicError(
            "That question is no longer the current one.", status=409, code="stale_question"
        )

    question = await db.maybe_single(
        "quiz_questions",
        "id, question, options, correct_index, explanation, difficulty, position",
        filters={"id": payload.questionId},
    )
    if not question:
        raise PublicError("That question was not found.", status=404, code="question_not_found")

    position = question["position"]
    concept_id = plan[position] if position < len(plan) else None
    is_correct = payload.answerIndex == question["correct_index"]

    await db.insert(
        "diagnostic_responses",
        {
            "session_id": session["id"],
            "concept_id": concept_id,
            "question": {
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "correct_index": question["correct_index"],
                "explanation": question["explanation"],
            },
            "answer_index": payload.answerIndex,
            "is_correct": is_correct,
            "difficulty": question["difficulty"],
            "position": position,
        },
        returning="minimal",
    )

    # The student really answered this — it counts, exactly like a quiz answer.
    if concept_id:
        await db.insert(
            "student_attempts",
            {
                "user_id": user.id,
                "concept_id": concept_id,
                "attempt_type": "diagnostic",
                "is_correct": is_correct,
                "difficulty": question["difficulty"],
                "score": 100 if is_correct else 0,
                "reference_id": session["id"],
            },
            returning="minimal",
        )

    questions_asked = session["questions_asked"] + 1
    correct_count = session["correct_count"] + (1 if is_correct else 0)
    next_difficulty = clamp_difficulty(session["current_difficulty"] + (1 if is_correct else -1))
    next_index = position + 1
    finished = next_index >= len(plan) or questions_asked >= MAX_QUESTIONS

    feedback = {
        "isCorrect": is_correct,
        "correctIndex": question["correct_index"],
        "explanation": question["explanation"],
    }

    if not finished:
        next_concept = await db.maybe_single(
            "concepts", "id, title, summary, content", filters={"id": plan[next_index]}
        )
        if not next_concept:
            raise PublicError(
                "The next concept could not be loaded.", status=500, code="concept_missing"
            )

        generated = await _generate_question(next_concept, next_difficulty)
        stored = await _store_question(
            state["quiz_id"], generated, next_difficulty, next_index
        )

        await db.update(
            "diagnostic_sessions",
            {
                "questions_asked": questions_asked,
                "correct_count": correct_count,
                "current_difficulty": next_difficulty,
                "result": {**state, "pending_question_id": stored["id"]},
            },
            filters={"id": session["id"]},
        )

        return {
            "feedback": feedback,
            "position": next_index + 1,
            "total": len(plan),
            "difficulty": next_difficulty,
            "conceptTitle": next_concept["title"],
            "question": {
                "id": stored["id"],
                "question": generated["question"],
                "options": generated["options"],
            },
        }

    # ---- finish -------------------------------------------------------------
    responses = await db.select(
        "diagnostic_responses",
        "concept_id, is_correct, difficulty",
        filters={"session_id": session["id"]},
    )

    answered = {row["concept_id"] for row in responses if row.get("concept_id")}
    strong = [row["concept_id"] for row in responses if row["is_correct"] and row.get("concept_id")]
    weak = [
        row["concept_id"] for row in responses if not row["is_correct"] and row.get("concept_id")
    ]
    unassessed = [concept_id for concept_id in plan if concept_id not in answered]

    score = round(correct_count / questions_asked * 100, 2) if questions_asked else 0.0

    await db.update(
        "diagnostic_sessions",
        {
            "status": "completed",
            "questions_asked": questions_asked,
            "correct_count": correct_count,
            "current_difficulty": next_difficulty,
            "score": score,
            "completed_at": now_iso(),
            "result": {
                **state,
                "pending_question_id": None,
                "strong": strong,
                "weak": weak,
                "unassessed": unassessed,
            },
        },
        filters={"id": session["id"]},
    )

    started = session.get("started_at")
    duration = 0
    if started:
        try:
            began = datetime.fromisoformat(started.replace("Z", "+00:00"))
            duration = max(0, round((datetime.now(timezone.utc) - began).total_seconds()))
        except ValueError:
            duration = 0

    await db.insert(
        "learning_sessions",
        {
            "user_id": user.id,
            "activity": "diagnostic",
            "ended_at": now_iso(),
            "duration_seconds": duration,
        },
        returning="minimal",
    )

    async def titles_for(concept_ids: list[str]) -> list[dict[str, Any]]:
        unique = list(dict.fromkeys(concept_ids))
        if not unique:
            return []
        return await db.select("concepts", "id, title, slug", filters={"id": ("in", unique)})

    return {
        "feedback": feedback,
        "completed": True,
        "score": score,
        "questionsAsked": questions_asked,
        "correctCount": correct_count,
        "strong": await titles_for(strong),
        "weak": await titles_for(weak),
        # Never reached, so never guessed at.
        "unassessed": await titles_for(unassessed),
    }


@router.get("/diagnostic/latest")
async def diagnostic_latest(user: CurrentUserDep) -> dict[str, Any]:
    """The student's most recent check, so the UI can resume or show the result."""
    session = await user.db().maybe_single(
        "diagnostic_sessions",
        "id, status, score, questions_asked, correct_count, result, started_at, completed_at",
        filters={"user_id": user.id},
        order="started_at.desc",
    )
    return {"session": session}
