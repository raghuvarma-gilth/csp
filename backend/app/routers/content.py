"""
The content workflow, and the role-request queue.

Two rules drive this module, both from the specification and both enforced here
on the server rather than in the UI:

1. Content moves `draft → submitted → approved → published → archived`. Students
   only ever read `published`. A faculty member cannot jump a draft straight to
   published, because "approved" is the record that somebody checked it.

2. Nobody approves their own work. `research_content` carries a database CHECK
   (`research_no_self_review`) that makes self-review impossible even if this
   code were wrong, and the check here exists to produce a readable message
   instead of a constraint violation.

Role requests are the *only* path to an elevated role, and approving one is
admin-only. The `role_requests_elevatable_role` constraint means 'admin' cannot
be requested at all — an administrator is created out of band, never by the
application.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import AdminDep, CurrentUser, CurrentUserDep, require_role, roles_of
from ..db import admin_db
from ..errors import PublicError

router = APIRouter(tags=["content"])

Status = Literal["draft", "submitted", "approved", "published", "archived"]

# Which transitions exist at all. Anything not listed is refused.
TRANSITIONS: dict[str, set[str]] = {
    "draft": {"submitted", "archived"},
    "submitted": {"approved", "draft", "archived"},
    "approved": {"published", "draft", "archived"},
    "published": {"archived"},
    "archived": {"draft"},
}

# Transitions that are a review decision, and so need someone other than the author.
REVIEW_TRANSITIONS = {"approved", "published"}

TABLES: dict[str, str] = {
    "course": "courses",
    "chapter": "chapters",
    "concept": "concepts",
    "problem": "coding_problems",
    "research": "research_content",
}

COLUMNS: dict[str, str] = {
    "course": "id, slug, code, title, description, subject, status, position, created_by, "
    "created_at, updated_at",
    "chapter": "id, course_id, slug, title, description, status, position, created_by, "
    "created_at, updated_at",
    "concept": "id, chapter_id, slug, title, summary, difficulty, estimated_minutes, visual_key, "
    "status, position, created_by, created_at, updated_at",
    "problem": "id, concept_id, slug, title, difficulty, expected_complexity, status, created_by, "
    "created_at, updated_at",
    "research": "id, concept_id, title, content_type, code_language, citations, status, "
    "created_by, reviewed_by, reviewed_at, review_note, created_at, updated_at",
}

# Editable fields per kind. Anything else a client sends is ignored rather than
# trusted — notably `status`, which only /transition may change.
EDITABLE: dict[str, set[str]] = {
    "course": {"slug", "code", "title", "description", "subject", "position"},
    "chapter": {"course_id", "slug", "title", "description", "position"},
    "concept": {
        "chapter_id",
        "slug",
        "title",
        "summary",
        "content",
        "difficulty",
        "estimated_minutes",
        "visual_key",
        "position",
    },
    "problem": {
        "concept_id",
        "slug",
        "title",
        "prompt",
        "difficulty",
        "starter_code",
        "test_cases",
        "expected_complexity",
        "hints",
    },
    "research": {
        "concept_id",
        "title",
        "content_type",
        "content",
        "code_language",
        "citations",
    },
}


class WriteRequest(BaseModel):
    kind: str
    values: dict[str, Any]


class TransitionRequest(BaseModel):
    kind: str
    id: str
    to: Status
    note: str | None = Field(default=None, max_length=2000)


class RoleRequestBody(BaseModel):
    requestedRole: Literal["faculty", "research_expert"]
    justification: str = Field(min_length=20, max_length=2000)
    institution: str | None = Field(default=None, max_length=200)


class ReviewRequest(BaseModel):
    requestId: str
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=2000)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _table_for(kind: str) -> str:
    table = TABLES.get(kind)
    if not table:
        raise PublicError(
            f"'{kind}' is not something this workspace manages.", status=400, code="unknown_kind"
        )
    return table


async def _authorise(kind: str, user: CurrentUser) -> set[str]:
    """Research experts own research content; faculty own the curriculum."""
    if kind == "research":
        return await require_role(user, "research_expert", "faculty")
    return await require_role(user, "faculty")


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------


@router.get("/content/{kind}")
async def list_content(
    kind: str, user: CurrentUserDep, status: str | None = None, mine: bool = False
) -> dict[str, Any]:
    await _authorise(kind, user)
    table = _table_for(kind)

    filters: dict[str, Any] = {}
    if status:
        filters["status"] = status
    if mine:
        filters["created_by"] = user.id

    rows = await admin_db().select(
        table, COLUMNS[kind], filters=filters or None, order="updated_at.desc", limit=200
    )
    return {"kind": kind, "items": rows}


@router.post("/content")
async def create_content(payload: WriteRequest, user: CurrentUserDep) -> dict[str, Any]:
    await _authorise(payload.kind, user)
    table = _table_for(payload.kind)

    values = {
        key: value for key, value in payload.values.items() if key in EDITABLE[payload.kind]
    }
    if not values:
        raise PublicError("Nothing to save.", status=400, code="empty_write")

    # New content always starts as a draft, whatever the client sent.
    values["status"] = "draft"
    values["created_by"] = user.id

    created = await admin_db().insert_one(table, values)
    return {"kind": payload.kind, "item": created}


@router.patch("/content/{kind}/{item_id}")
async def update_content(
    kind: str, item_id: str, payload: WriteRequest, user: CurrentUserDep
) -> dict[str, Any]:
    held = await _authorise(kind, user)
    table = _table_for(kind)
    db = admin_db()

    existing = await db.maybe_single(table, "id, status, created_by", filters={"id": item_id})
    if not existing:
        raise PublicError("That item was not found.", status=404, code="not_found")

    # Published material is edited by taking it back to draft first, so nobody
    # silently rewrites what students are currently reading.
    if existing["status"] == "published" and "admin" not in held:
        raise PublicError(
            "This is published. Move it back to draft before editing, so students are not "
            "reading a version nobody reviewed.",
            status=409,
            code="published_locked",
        )

    values = {key: value for key, value in payload.values.items() if key in EDITABLE[kind]}
    if not values:
        raise PublicError("Nothing to save.", status=400, code="empty_write")
    values["updated_at"] = now_iso()

    updated = await db.update(
        table, values, filters={"id": item_id}, returning="representation"
    )
    return {"kind": kind, "item": updated[0] if updated else None}


@router.post("/content/transition")
async def transition_content(payload: TransitionRequest, user: CurrentUserDep) -> dict[str, Any]:
    held = await _authorise(payload.kind, user)
    table = _table_for(payload.kind)
    db = admin_db()

    item = await db.maybe_single(table, "id, title, status, created_by", filters={"id": payload.id})
    if not item:
        raise PublicError("That item was not found.", status=404, code="not_found")

    current = item["status"]
    if payload.to == current:
        return {"kind": payload.kind, "id": payload.id, "status": current, "changed": False}

    if payload.to not in TRANSITIONS.get(current, set()):
        allowed = ", ".join(sorted(TRANSITIONS.get(current, set()))) or "nothing"
        raise PublicError(
            f"Content that is {current} can only move to {allowed}.",
            status=409,
            code="invalid_transition",
        )

    is_review = payload.to in REVIEW_TRANSITIONS
    if is_review:
        # Approving and publishing are review decisions. Faculty and admins make
        # them; research experts submit for review but do not sign off.
        if "faculty" not in held and "admin" not in held:
            raise PublicError(
                "Approving and publishing are done by faculty. Submit it for review instead.",
                status=403,
                code="forbidden",
            )
        if item["created_by"] == user.id:
            raise PublicError(
                "You cannot approve or publish your own work. Another reviewer has to sign it off.",
                status=403,
                code="self_review",
            )

    values: dict[str, Any] = {"status": payload.to, "updated_at": now_iso()}
    if payload.kind == "research" and (is_review or payload.to == "draft"):
        values |= {
            "reviewed_by": user.id,
            "reviewed_at": now_iso(),
            "review_note": payload.note,
        }

    await db.update(table, values, filters={"id": payload.id})

    return {
        "kind": payload.kind,
        "id": payload.id,
        "title": item["title"],
        "status": payload.to,
        "changed": True,
    }


@router.get("/content-overview")
async def content_overview(user: CurrentUserDep) -> dict[str, Any]:
    """Counts by status, from the database. Nothing here is estimated."""
    held = await require_role(user, "faculty", "research_expert")
    db = admin_db()

    kinds = ["course", "chapter", "concept", "problem", "research"]
    counts: dict[str, dict[str, int]] = {}
    for kind in kinds:
        table = TABLES[kind]
        counts[kind] = {
            status: await db.count(table, filters={"status": status})
            for status in ("draft", "submitted", "approved", "published", "archived")
        }

    review_queue = await db.select(
        "research_content",
        "id, title, content_type, status, created_by, created_at",
        filters={"status": "submitted"},
        order="created_at.asc",
        limit=50,
    )

    pending_roles = (
        await db.count("role_requests", filters={"status": "pending"})
        if "admin" in held
        else None
    )

    return {
        "counts": counts,
        "reviewQueue": review_queue,
        "pendingRoleRequests": pending_roles,
        "roles": sorted(held),
    }


# ---------------------------------------------------------------------------
# Role requests — the only route to an elevated role
# ---------------------------------------------------------------------------


@router.get("/role-requests/mine")
async def my_role_requests(user: CurrentUserDep) -> dict[str, Any]:
    rows = await user.db().select(
        "role_requests",
        "id, requested_role, justification, institution, status, review_note, created_at, "
        "reviewed_at",
        filters={"user_id": user.id},
        order="created_at.desc",
        limit=20,
    )
    return {"requests": rows, "roles": sorted(await roles_of(user.id))}


@router.post("/role-requests")
async def submit_role_request(payload: RoleRequestBody, user: CurrentUserDep) -> dict[str, Any]:
    db = admin_db()

    held = await roles_of(user.id)
    if payload.requestedRole in held:
        raise PublicError(
            f"You already have the {payload.requestedRole.replace('_', ' ')} role.",
            status=409,
            code="already_held",
        )

    pending = await db.maybe_single(
        "role_requests", "id", filters={"user_id": user.id, "status": "pending"}
    )
    if pending:
        raise PublicError(
            "You already have a request waiting for review.", status=409, code="already_pending"
        )

    created = await db.insert_one(
        "role_requests",
        {
            "user_id": user.id,
            "requested_role": payload.requestedRole,
            "justification": payload.justification.strip(),
            "institution": (payload.institution or "").strip() or None,
        },
    )
    return {
        "request": {
            "id": created["id"],
            "requestedRole": created["requested_role"],
            "status": created["status"],
            "createdAt": created["created_at"],
        }
    }


@router.get("/role-requests")
async def list_role_requests(user: AdminDep, status: str = "pending") -> dict[str, Any]:
    db = admin_db()
    rows = await db.select(
        "role_requests",
        "id, user_id, requested_role, justification, institution, status, review_note, "
        "created_at, reviewed_at",
        filters={"status": status},
        order="created_at.asc",
        limit=100,
    )

    profiles = (
        await db.select(
            "profiles",
            "user_id, display_name",
            filters={"user_id": ("in", [row["user_id"] for row in rows])},
        )
        if rows
        else []
    )
    names = {profile["user_id"]: profile["display_name"] for profile in profiles}

    return {
        "requests": [{**row, "displayName": names.get(row["user_id"])} for row in rows],
    }


@router.post("/role-requests/review")
async def review_role_request(payload: ReviewRequest, user: AdminDep) -> dict[str, Any]:
    db = admin_db()

    request = await db.maybe_single(
        "role_requests",
        "id, user_id, requested_role, status",
        filters={"id": payload.requestId},
    )
    if not request:
        raise PublicError("That request was not found.", status=404, code="not_found")
    if request["status"] != "pending":
        raise PublicError(
            f"That request was already {request['status']}.", status=409, code="already_reviewed"
        )
    if request["user_id"] == user.id:
        raise PublicError(
            "You cannot review your own role request.", status=403, code="self_review"
        )

    if payload.decision == "approved":
        # The grant itself — the one place a non-student role is ever written.
        await db.upsert(
            "user_roles",
            {"user_id": request["user_id"], "role": request["requested_role"]},
            on_conflict="user_id,role",
            returning="minimal",
        )

    await db.update(
        "role_requests",
        {
            "status": payload.decision,
            "reviewed_by": user.id,
            "reviewed_at": now_iso(),
            "review_note": payload.note,
            "updated_at": now_iso(),
        },
        filters={"id": request["id"]},
    )

    return {
        "id": request["id"],
        "userId": request["user_id"],
        "role": request["requested_role"],
        "decision": payload.decision,
    }


@router.get("/admin/users")
async def list_users(user: AdminDep) -> dict[str, Any]:
    """Who holds what. Read from `user_roles`, which is the authoritative record."""
    db = admin_db()
    roles = await db.select("user_roles", "user_id, role, created_at", order="created_at.desc")
    profiles = await db.select("profiles", "user_id, display_name, created_at")

    by_user: dict[str, dict[str, Any]] = {}
    for profile in profiles:
        by_user[profile["user_id"]] = {
            "userId": profile["user_id"],
            "displayName": profile["display_name"],
            "joinedAt": profile["created_at"],
            "roles": [],
        }
    for row in roles:
        entry = by_user.setdefault(
            row["user_id"],
            {"userId": row["user_id"], "displayName": None, "joinedAt": None, "roles": []},
        )
        entry["roles"].append(row["role"])

    return {"users": sorted(by_user.values(), key=lambda item: item["displayName"] or "")}
