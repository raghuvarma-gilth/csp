"""
"What should I do next" — computed, not guessed.

Every recommendation below is derived from a row the student actually produced:
a mastery record, a misconception detected in a real attempt, a prerequisite
that is genuinely unmet. There is no model call here on purpose — a plan that
changes shape each time you ask for it is not a plan, and inventing "you seem to
be struggling with recursion" out of nothing is exactly the kind of fake
personalisation this rewrite exists to remove.

When there is no evidence yet, the honest answer is a single recommendation:
take the diagnostic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

from fastapi import APIRouter

from ..auth import CurrentUserDep
from ..db import admin_db
from ..services.decay import decay_risk

router = APIRouter(tags=["plan"])

MAX_RECOMMENDATIONS = 8

Action = Literal["learn", "review", "practice", "quiz", "code", "visual", "diagnostic"]


class Candidate(TypedDict):
    conceptId: str
    action: Action
    title: str
    reason: str
    priority: int
    estimatedMinutes: int


def _days_since(iso: str | None) -> int:
    if not iso:
        return 0
    try:
        moment = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if not moment.tzinfo:
        moment = moment.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - moment).total_seconds() // 86_400))


@router.post("/learning-plan")
async def learning_plan(user: CurrentUserDep) -> dict[str, Any]:
    db = admin_db()

    concepts = await db.select(
        "concepts",
        "id, title, slug, difficulty, estimated_minutes, visual_key, position, chapter_id",
        filters={"status": "published"},
        order="position",
    )
    mastery_rows = await db.select(
        "student_concept_mastery",
        "concept_id, mastery, peak_mastery, status, attempts, last_practiced_at",
        filters={"user_id": user.id},
    )
    prerequisites = await db.select("concept_prerequisites", "concept_id, prerequisite_id")
    misconceptions = await db.select(
        "student_misconceptions",
        "concept_id, statement, detected_count",
        filters={"user_id": user.id, "resolved": False},
    )
    problems = await db.select(
        "coding_problems", "id, concept_id, title, slug", filters={"status": "published"}
    )
    solved = await db.select(
        "coding_attempts", "problem_id", filters={"user_id": user.id, "is_solved": True}
    )

    mastery_by = {row["concept_id"]: row for row in mastery_rows}
    solved_ids = {row["problem_id"] for row in solved}

    prereqs_of: dict[str, list[str]] = {}
    for edge in prerequisites:
        prereqs_of.setdefault(edge["concept_id"], []).append(edge["prerequisite_id"])

    misconception_by: dict[str, str] = {}
    for row in misconceptions:
        if row.get("concept_id") and row["concept_id"] not in misconception_by:
            misconception_by[row["concept_id"]] = row["statement"]

    unsolved_problem: dict[str, str] = {}
    for problem in problems:
        concept_id = problem.get("concept_id")
        if concept_id and problem["id"] not in solved_ids and concept_id not in unsolved_problem:
            unsolved_problem[concept_id] = problem["title"]

    candidates: list[Candidate] = []
    has_evidence = any(int(row["attempts"] or 0) > 0 for row in mastery_rows)

    if not has_evidence:
        candidates.append(
            {
                "conceptId": concepts[0]["id"] if concepts else "",
                "action": "diagnostic",
                "title": "Take the placement check",
                "reason": (
                    "You have not answered anything yet, so there is nothing to base a plan on. "
                    "Ten adaptive questions is enough to find your starting point."
                ),
                "priority": 1,
                "estimatedMinutes": 12,
            }
        )

    for concept in concepts:
        record = mastery_by.get(concept["id"])
        value = float(record["mastery"]) if record else 0.0
        peak = float(record["peak_mastery"]) if record else 0.0
        attempts = int(record["attempts"]) if record else 0
        last_practised = record.get("last_practiced_at") if record else None
        risk = decay_risk(peak, value, last_practised)

        # 1. Decay — something they earned and are now losing.
        if risk >= 40:
            days = _days_since(last_practised)
            candidates.append(
                {
                    "conceptId": concept["id"],
                    "action": "review",
                    "title": f"Refresh {concept['title']}",
                    "reason": (
                        f"You reached {round(peak)}% here and last practised it {days} "
                        f"day{'' if days == 1 else 's'} ago. A short review now costs far less "
                        "than relearning it."
                    ),
                    "priority": 1,
                    "estimatedMinutes": 8,
                }
            )
            continue

        # 2. An active misconception is the highest-value thing to fix.
        statement = misconception_by.get(concept["id"])
        if statement:
            candidates.append(
                {
                    "conceptId": concept["id"],
                    "action": "practice",
                    "title": f"Clear up {concept['title']}",
                    "reason": (
                        f'You answered as though "{statement}". Targeted practice on this one '
                        "idea is worth more than another pass over the chapter."
                    ),
                    "priority": 1,
                    "estimatedMinutes": 10,
                }
            )
            continue

        # 3. Started but not solid.
        if attempts > 0 and value < 70:
            candidates.append(
                {
                    "conceptId": concept["id"],
                    "action": "quiz",
                    "title": f"Push {concept['title']} past 70%",
                    "reason": (
                        f"You are at {round(value)}% after {attempts} "
                        f"question{'' if attempts == 1 else 's'}. The quiz adapts to that level, "
                        "so it will not throw the hardest cases at you yet."
                    ),
                    "priority": 2,
                    "estimatedMinutes": 10,
                }
            )
            continue

        # 4. Unlocked and untouched — the next thing to learn.
        if attempts == 0 and value == 0:
            prereqs = prereqs_of.get(concept["id"], [])
            unmet = [
                prereq
                for prereq in prereqs
                if float((mastery_by.get(prereq) or {}).get("mastery", 0) or 0) < 60
            ]
            if not unmet:
                candidates.append(
                    {
                        "conceptId": concept["id"],
                        "action": "learn",
                        "title": f"Learn {concept['title']}",
                        "reason": (
                            "Everything this builds on is solid, so it is unlocked."
                            if prereqs
                            else "This is a starting point — nothing has to come before it."
                        ),
                        "priority": 2 if prereqs else 3,
                        "estimatedMinutes": concept.get("estimated_minutes") or 15,
                    }
                )
            continue

        # 5. Solid understanding, untested in code.
        problem_title = unsolved_problem.get(concept["id"])
        if value >= 70 and problem_title:
            candidates.append(
                {
                    "conceptId": concept["id"],
                    "action": "code",
                    "title": f"Implement: {problem_title}",
                    "reason": (
                        f"You understand {concept['title']} at {round(value)}%. Writing it is "
                        "what turns that into something you can use under pressure."
                    ),
                    "priority": 3,
                    "estimatedMinutes": 25,
                }
            )
            continue

        # 6. Struggling with something that has a visualisation.
        if concept.get("visual_key") and attempts > 0 and value < 50:
            candidates.append(
                {
                    "conceptId": concept["id"],
                    "action": "visual",
                    "title": f"See {concept['title']} run",
                    "reason": (
                        "Watching the steps often does more for a stuck mental model than "
                        "reading the same paragraph again."
                    ),
                    "priority": 3,
                    "estimatedMinutes": 6,
                }
            )

    candidates.sort(key=lambda item: (item["priority"], item["estimatedMinutes"]))
    plan = candidates[:MAX_RECOMMENDATIONS]

    # Replace the old plan rather than piling up stale advice.
    await db.update(
        "learning_recommendations",
        {"status": "expired"},
        filters={"user_id": user.id, "status": "active"},
    )

    inserted: list[dict[str, Any]] = []
    if plan:
        inserted = await db.insert(
            "learning_recommendations",
            [
                {
                    "user_id": user.id,
                    "concept_id": item["conceptId"] or None,
                    "action": item["action"],
                    "title": item["title"],
                    "reason": item["reason"],
                    "priority": item["priority"],
                    "estimated_minutes": item["estimatedMinutes"],
                    "generated_by": "rules",
                }
                for item in plan
            ],
        )
        inserted.sort(key=lambda row: (row["priority"], row["estimated_minutes"]))

    # Today's mission — the first three things, as checkable tasks.
    today = datetime.now(timezone.utc).date().isoformat()
    tasks = [
        {
            "id": row["id"],
            "label": row["title"],
            "action": row["action"],
            "concept_id": row["concept_id"],
            "done": False,
        }
        for row in inserted[:3]
    ]
    if tasks:
        await db.upsert(
            "daily_missions",
            {"user_id": user.id, "mission_date": today, "tasks": tasks},
            on_conflict="user_id,mission_date",
            returning="minimal",
        )

    streak = await db.rpc("refresh_learning_streak", {"_user_id": user.id})

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "hasEvidence": has_evidence,
        "recommendations": [
            {
                "id": row["id"],
                "conceptId": row["concept_id"],
                "action": row["action"],
                "title": row["title"],
                "reason": row["reason"],
                "priority": row["priority"],
                "estimatedMinutes": row["estimated_minutes"],
            }
            for row in inserted
        ],
        "mission": {"date": today, "tasks": tasks} if tasks else None,
        "streak": streak,
    }
