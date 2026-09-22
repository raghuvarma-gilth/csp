"""
Focus sessions — measurable signals only.

The prototype displayed "wellbeing 72%", "energy 65%" and an emotional state,
all produced by `Math.random()`. Those columns are gone (migration 090100 drops
them) and nothing here replaces them with a different guess.

What remains is observable by the browser and verifiable here:

  * `present_seconds`  — time the tab was actually visible (Page Visibility API)
  * `away_events`      — how many times it stopped being visible
  * `interaction_count`— real keystroke/click/scroll events
  * `target_minutes`   — what the student set out to do
  * `completed`        — whether they reached it

The server clamps `present_seconds` to the wall-clock age of the session, so a
client cannot report more focused time than the session has existed. None of
this is a psychological measurement and the UI must not present it as one.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep
from ..db import admin_db
from ..errors import PublicError

router = APIRouter(tags=["focus"])

MAX_TARGET_MINUTES = 180


class StartRequest(BaseModel):
    targetMinutes: int = Field(default=25, ge=5, le=MAX_TARGET_MINUTES)
    conceptId: str | None = None
    cameraEnabled: bool = False


class ProgressRequest(BaseModel):
    sessionId: str
    presentSeconds: int = Field(default=0, ge=0)
    awayEvents: int = Field(default=0, ge=0)
    interactionCount: int = Field(default=0, ge=0)


class StopRequest(ProgressRequest):
    pass


def now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed_seconds(started_at: str | None) -> int:
    if not started_at:
        return 0
    try:
        began = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if not began.tzinfo:
        began = began.replace(tzinfo=timezone.utc)
    return max(0, int((now() - began).total_seconds()))


async def _own_session(session_id: str, user_id: str) -> dict[str, Any]:
    session = await admin_db().maybe_single(
        "focus_sessions",
        "id, user_id, concept_id, target_minutes, present_seconds, away_events, "
        "interaction_count, camera_enabled, completed, started_at, ended_at, duration_minutes",
        filters={"id": session_id},
    )
    if not session or session["user_id"] != user_id:
        raise PublicError("That focus session was not found.", status=404, code="session_not_found")
    return session


@router.post("/focus/start")
async def focus_start(payload: StartRequest, user: CurrentUserDep) -> dict[str, Any]:
    db = admin_db()

    # Close anything left open, so "running" means one session.
    stale = await db.select(
        "focus_sessions",
        "id, started_at, present_seconds",
        filters={"user_id": user.id, "ended_at": ("is", None)},
    )
    for row in stale:
        await db.update(
            "focus_sessions",
            {
                "ended_at": now().isoformat(),
                "duration_minutes": round(_elapsed_seconds(row["started_at"]) / 60),
                "completed": False,
            },
            filters={"id": row["id"]},
        )

    session = await db.insert_one(
        "focus_sessions",
        {
            "user_id": user.id,
            "concept_id": payload.conceptId,
            "target_minutes": payload.targetMinutes,
            "camera_enabled": payload.cameraEnabled,
        },
    )
    return {
        "sessionId": session["id"],
        "startedAt": session["started_at"],
        "targetMinutes": session["target_minutes"],
        "closedStale": len(stale),
    }


@router.post("/focus/progress")
async def focus_progress(payload: ProgressRequest, user: CurrentUserDep) -> dict[str, Any]:
    """Periodic checkpoint, so a closed tab does not lose the whole session."""
    session = await _own_session(payload.sessionId, user.id)
    if session["ended_at"]:
        raise PublicError("That session has already ended.", status=409, code="session_closed")

    elapsed = _elapsed_seconds(session["started_at"])
    present = min(payload.presentSeconds, elapsed)

    await admin_db().update(
        "focus_sessions",
        {
            "present_seconds": present,
            "away_events": payload.awayEvents,
            "interaction_count": payload.interactionCount,
        },
        filters={"id": session["id"]},
    )
    return {"presentSeconds": present, "elapsedSeconds": elapsed}


@router.post("/focus/stop")
async def focus_stop(payload: StopRequest, user: CurrentUserDep) -> dict[str, Any]:
    session = await _own_session(payload.sessionId, user.id)
    if session["ended_at"]:
        raise PublicError("That session has already ended.", status=409, code="session_closed")

    db = admin_db()
    elapsed = _elapsed_seconds(session["started_at"])
    present = min(payload.presentSeconds, elapsed)
    duration_minutes = round(elapsed / 60)
    completed = present >= session["target_minutes"] * 60

    await db.update(
        "focus_sessions",
        {
            "present_seconds": present,
            "away_events": payload.awayEvents,
            "interaction_count": payload.interactionCount,
            "duration_minutes": duration_minutes,
            "completed": completed,
            "ended_at": now().isoformat(),
        },
        filters={"id": session["id"]},
    )

    # A focus session is study time, so it belongs in the same activity log as
    # everything else the streak is computed from.
    if elapsed >= 60:
        await db.insert(
            "learning_sessions",
            {
                "user_id": user.id,
                "concept_id": session["concept_id"],
                "activity": "focus",
                "ended_at": now().isoformat(),
                "duration_seconds": present,
            },
            returning="minimal",
        )

    focus_ratio = round(present / elapsed * 100) if elapsed else None

    return {
        "sessionId": session["id"],
        "presentSeconds": present,
        "elapsedSeconds": elapsed,
        "awayEvents": payload.awayEvents,
        "interactionCount": payload.interactionCount,
        "durationMinutes": duration_minutes,
        "completed": completed,
        # The share of the session the tab was visible. Not a measure of
        # attention, concentration or mood — just visibility.
        "presentPercent": focus_ratio,
    }


@router.get("/focus/history")
async def focus_history(user: CurrentUserDep) -> dict[str, Any]:
    rows = await user.db().select(
        "focus_sessions",
        "id, concept_id, target_minutes, present_seconds, away_events, interaction_count, "
        "duration_minutes, completed, started_at, ended_at",
        filters={"user_id": user.id},
        order="started_at.desc",
        limit=30,
    )

    finished = [row for row in rows if row["ended_at"]]
    total_seconds = sum(row["present_seconds"] or 0 for row in finished)

    return {
        "sessions": rows,
        "summary": {
            "sessions": len(finished),
            "completed": sum(1 for row in finished if row["completed"]),
            "totalPresentSeconds": total_seconds,
            "medianAwayEvents": (
                sorted(row["away_events"] or 0 for row in finished)[len(finished) // 2]
                if finished
                else None
            ),
        },
    }
