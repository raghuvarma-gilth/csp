"""
AIVA — the tutor. One conversation surface, six teaching modes.

The grounding rule is the important part. Retrieved course material is the only
source the model may treat as authoritative about *this* course. When retrieval
finds nothing, the reply is flagged ungrounded and the UI says so, instead of
the model confidently inventing a syllabus detail that sounds right. And when
retrieval is unavailable — no Hugging Face key, or the service is down — that is
reported as its own state, because "we could not search your material" and
"your material contains nothing about this" are different facts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep
from ..config import settings
from ..db import admin_db
from ..errors import PublicError
from ..services import embeddings, gemini

router = APIRouter(tags=["tutor"])

Mode = Literal["explain", "socratic", "hint", "practice", "revision", "exam"]

MODES: dict[str, str] = {
    "explain": (
        "Explain the idea clearly, building from what the student already knows. Use one concrete "
        "worked example and name the key intuition. Keep it under 250 words."
    ),
    "socratic": (
        "Do NOT give the answer. Ask exactly one focused question that moves the student one step "
        "forward, and briefly say why that step matters. If their last message contained a "
        "misconception, target it."
    ),
    "hint": (
        "Give the smallest hint that unblocks them. Never write the full solution or the final "
        "code. One or two sentences."
    ),
    "practice": (
        "Pose one practice problem at the student's current level, then stop and wait. Do not "
        "reveal the answer in the same message."
    ),
    "revision": (
        "Produce a compact revision summary: the core idea, the two things most often got wrong, "
        "and one self-check question."
    ),
    "exam": (
        "Answer as an examiner would: precise, structured, with the marking points made explicit. "
        "State complexity and edge cases where relevant."
    ),
}

REPLY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "used_sources": {"type": "boolean"},
        "detected_misconception": {
            "type": "object",
            "nullable": True,
            "properties": {"statement": {"type": "string"}, "correction": {"type": "string"}},
            "required": ["statement", "correction"],
        },
    },
    "required": ["reply", "used_sources"],
}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: str = "explain"
    conceptId: str | None = None
    conversationId: str | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/aiva-chat")
async def aiva_chat(payload: ChatRequest, user: CurrentUserDep) -> dict[str, Any]:
    gemini.require_configured()
    db = admin_db()

    message = payload.message.strip()
    if not message:
        raise PublicError("Type a question first.", status=400, code="empty_message")

    mode = payload.mode if payload.mode in MODES else "explain"

    # --- Concept context (only published material is visible to a learner) ---
    concept: dict[str, Any] | None = None
    if payload.conceptId:
        row = await db.maybe_single(
            "concepts",
            "id, title, summary, status, chapters(title)",
            filters={"id": payload.conceptId},
        )
        if row and row.get("status") == "published":
            concept = {
                "id": row["id"],
                "title": row["title"],
                "summary": row.get("summary"),
                "chapter": (row.get("chapters") or {}).get("title", ""),
            }

    # --- Retrieval -----------------------------------------------------------
    sources: list[dict[str, Any]] = []
    retrieval_unavailable = False

    if settings.embeddings_configured:
        try:
            vector = await embeddings.embed_one(message)
            matches = await db.rpc(
                "match_content_chunks",
                {
                    "query_embedding": embeddings.to_pgvector(vector),
                    "match_count": 6,
                    "min_similarity": 0.35,
                    "filter_concept": payload.conceptId,
                },
            )
            sources = [
                {
                    "document_id": match["document_id"],
                    "document_title": match["document_title"],
                    "concept_title": match.get("concept_title"),
                    "heading": match.get("heading"),
                    "snippet": (match.get("content") or "")[:600],
                    "similarity": float(match["similarity"]),
                }
                for match in (matches or [])
            ]
        except Exception:
            # Retrieval being down must not silently become "no course material".
            retrieval_unavailable = True
    else:
        retrieval_unavailable = True

    # --- Conversation --------------------------------------------------------
    conversation_id = payload.conversationId
    if conversation_id:
        owned = await db.maybe_single(
            "ai_conversations", "id", filters={"id": conversation_id, "user_id": user.id}
        )
        if not owned:
            conversation_id = None

    if not conversation_id:
        created = await db.insert_one(
            "ai_conversations",
            {
                "user_id": user.id,
                "concept_id": concept["id"] if concept else None,
                "mode": mode,
                "title": message[:60],
            },
        )
        conversation_id = created["id"]

    history = await db.select(
        "ai_messages",
        "role, content",
        filters={"conversation_id": conversation_id},
        order="created_at.asc",
        limit=20,
    )

    # --- Prompt --------------------------------------------------------------
    if sources:
        context_block = "\n\n".join(
            f"[{index + 1}] {source['document_title']}"
            + (f" — {source['heading']}" if source["heading"] else "")
            + f"\n{source['snippet']}"
            for index, source in enumerate(sources)
        )
    else:
        context_block = "(no matching course material was retrieved)"

    system = "\n".join(
        [
            "You are AIVA, the tutor inside EduVerse. You teach computer science, especially "
            "data structures and algorithms.",
            "",
            f"TEACHING MODE: {mode}. {MODES[mode]}",
            "",
            (
                f'The student is currently studying "{concept["title"]}" in the chapter '
                f'"{concept["chapter"]}". {concept.get("summary") or ""}'
                if concept
                else "The student has not opened a specific concept."
            ),
            "",
            "COURSE MATERIAL RETRIEVED FOR THIS QUESTION:",
            context_block,
            "",
            "RULES — these are not negotiable:",
            "1. Anything specific to THIS course — its syllabus, deadlines, grading, which chapters "
            "exist, what a particular lecture said — may only come from the retrieved material "
            "above. If it is not there, say you could not verify it against their course material "
            "and suggest they ask their instructor. Never guess it.",
            "2. General computer-science knowledge (how a stack works, what O(n) means) you may "
            "explain freely from your own knowledge. That is not course-specific.",
            "3. Set used_sources to true only if you actually relied on the retrieved material.",
            "4. Write in markdown. Use fenced code blocks with a language tag for code.",
            "5. If the student's message reveals a specific incorrect belief, put it in "
            "detected_misconception as the belief in their own terms plus the correction. "
            "Otherwise set it to null. Do not invent one to fill the field.",
            "6. Never claim to have seen their grades, attendance, or personal records.",
        ]
    )

    turns = [
        gemini.model_message(item["content"])
        if item["role"] == "assistant"
        else gemini.user_message(item["content"])
        for item in history
    ]
    turns.append(gemini.user_message(message))

    result = await gemini.generate_json(
        turns,
        REPLY_SCHEMA,
        system=system,
        temperature=0.2 if mode == "exam" else 0.5,
    )

    grounded = bool(result.get("used_sources")) and bool(sources)
    citations = (
        [
            {
                "document_id": source["document_id"],
                "title": source["document_title"],
                "heading": source["heading"],
                "concept": source["concept_title"],
                "similarity": round(source["similarity"], 3),
            }
            for source in sources
        ]
        if grounded
        else []
    )

    await db.insert(
        "ai_messages",
        [
            {
                "conversation_id": conversation_id,
                "user_id": user.id,
                "role": "user",
                "content": message,
                "grounded": False,
            },
            {
                "conversation_id": conversation_id,
                "user_id": user.id,
                "role": "assistant",
                "content": result["reply"],
                "grounded": grounded,
                "sources": citations,
            },
        ],
        returning="minimal",
    )
    await db.update(
        "ai_conversations", {"updated_at": now_iso()}, filters={"id": conversation_id}
    )

    # A misconception is only recorded against a real, published concept —
    # otherwise there is nothing for the student to practise against later.
    misconception = result.get("detected_misconception")
    if misconception and misconception.get("statement") and concept:
        existing = await db.maybe_single(
            "student_misconceptions",
            "id, detected_count",
            filters={
                "user_id": user.id,
                "concept_id": concept["id"],
                "statement": misconception["statement"],
            },
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
                    "user_id": user.id,
                    "concept_id": concept["id"],
                    "statement": misconception["statement"],
                    "correction": misconception["correction"],
                    "source": "tutor",
                },
                returning="minimal",
            )
    else:
        misconception = None

    return {
        "conversationId": conversation_id,
        "reply": result["reply"],
        "grounded": grounded,
        "retrievalUnavailable": retrieval_unavailable,
        "sources": [
            {key: value for key, value in citation.items() if key != "document_id"}
            for citation in citations
        ],
        "misconception": misconception,
    }


@router.get("/conversations")
async def list_conversations(user: CurrentUserDep) -> dict[str, Any]:
    """The student's own conversations. Read through RLS, as the student."""
    rows = await user.db().select(
        "ai_conversations",
        "id, title, mode, concept_id, created_at, updated_at",
        filters={"user_id": user.id},
        order="updated_at.desc",
        limit=30,
    )
    return {"conversations": rows}


@router.get("/conversations/{conversation_id}")
async def read_conversation(conversation_id: str, user: CurrentUserDep) -> dict[str, Any]:
    db = user.db()
    conversation = await db.maybe_single(
        "ai_conversations",
        "id, title, mode, concept_id",
        filters={"id": conversation_id, "user_id": user.id},
    )
    if not conversation:
        raise PublicError("That conversation was not found.", status=404, code="not_found")

    messages = await db.select(
        "ai_messages",
        "id, role, content, grounded, sources, created_at",
        filters={"conversation_id": conversation_id},
        order="created_at.asc",
        limit=200,
    )
    return {"conversation": conversation, "messages": messages}
