"""
Retrieval: getting course material in, and finding it again.

Ingest is faculty-only. This is the corpus AIVA is allowed to treat as
authoritative about the course, so a student writing to it would be a student
writing the tutor's source of truth.

Every stage of the lifecycle is recorded honestly on
`content_documents.ingest_status`. A document that failed halfway through
embedding says `failed` with the reason, rather than sitting in the UI looking
ready and then returning nothing when a student asks about it.

`match_content_chunks()` already restricts results to documents whose ingest
finished and concepts that are published, so an unfinished draft cannot leak
through search even though its chunk rows exist.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..auth import CurrentUserDep, FacultyDep
from ..config import settings
from ..db import admin_db
from ..errors import PublicError
from ..services import embeddings

router = APIRouter(tags=["rag"])

MAX_CHARS = 400_000
BATCH = 16


class IngestRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    text: str
    conceptId: str | None = None
    chapterId: str | None = None
    sourceType: str = "pasted"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    conceptId: str | None = None
    limit: int = Field(default=8, ge=1, le=20)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/rag-ingest")
async def rag_ingest(payload: IngestRequest, user: FacultyDep) -> dict[str, Any]:
    embeddings.require_configured()
    db = admin_db()

    title = payload.title.strip()
    text = payload.text

    if len(text.strip()) < 50:
        raise PublicError(
            "There is not enough text to index — paste at least a paragraph.",
            status=400,
            code="text_too_short",
        )
    if len(text) > MAX_CHARS:
        raise PublicError(
            f"That document is {len(text):,} characters. Split it into parts under "
            f"{MAX_CHARS:,}.",
            status=400,
            code="text_too_long",
        )

    source_type = payload.sourceType if payload.sourceType == "upload" else "pasted"

    created = await db.insert_one(
        "content_documents",
        {
            "title": title,
            "concept_id": payload.conceptId,
            "chapter_id": payload.chapterId,
            "source_type": source_type,
            "ingest_status": "processing",
            "embedding_model": settings.embedding_model,
            "byte_size": len(text.encode("utf-8")),
            "mime_type": "text/plain",
            "raw_text": text,
            "created_by": user.id,
        },
    )
    document_id = created["id"]

    try:
        chunks = embeddings.chunk_text(text)
        if not chunks:
            raise PublicError(
                "No indexable text was found in that document.", status=400, code="no_chunks"
            )

        written = 0
        for start in range(0, len(chunks), BATCH):
            window = chunks[start : start + BATCH]
            vectors = await embeddings.embed([chunk["content"] for chunk in window])

            await db.insert(
                "content_chunks",
                [
                    {
                        "document_id": document_id,
                        "concept_id": payload.conceptId,
                        "chunk_index": written + offset,
                        "content": chunk["content"],
                        "heading": chunk["heading"],
                        # A rough word-based estimate, labelled as such — not a tokenizer.
                        "token_count": round(len(re.split(r"\s+", chunk["content"].strip())) * 1.3),
                        "embedding": embeddings.to_pgvector(vectors[offset]),
                    }
                    for offset, chunk in enumerate(window)
                ],
                returning="minimal",
            )
            written += len(window)

        await db.update(
            "content_documents",
            {
                "ingest_status": "ready",
                "chunk_count": written,
                "ingest_error": None,
                "updated_at": now_iso(),
            },
            filters={"id": document_id},
        )
        return {"documentId": document_id, "chunkCount": written, "status": "ready"}

    except Exception as error:
        # Leave a truthful trail: a half-embedded document must not read as ready.
        reason = getattr(error, "message", None) or str(error) or "Unknown ingest failure"
        try:
            await db.update(
                "content_documents",
                {"ingest_status": "failed", "ingest_error": reason[:500]},
                filters={"id": document_id},
            )
        except Exception:  # noqa: BLE001 - the original failure is the one that matters
            pass
        raise


@router.post("/rag-search")
async def rag_search(payload: SearchRequest, user: CurrentUserDep) -> dict[str, Any]:
    embeddings.require_configured()

    query = payload.query.strip()
    if not query:
        raise PublicError("Type something to search for.", status=400, code="empty_query")

    vector = await embeddings.embed_one(query)
    rows = await admin_db().rpc(
        "match_content_chunks",
        {
            "query_embedding": embeddings.to_pgvector(vector),
            "match_count": payload.limit,
            "min_similarity": 0.3,
            "filter_concept": payload.conceptId,
        },
    )

    return {
        "query": query,
        "results": [
            {
                "chunkId": row["chunk_id"],
                "documentId": row["document_id"],
                "conceptId": row.get("concept_id"),
                "conceptTitle": row.get("concept_title"),
                "documentTitle": row.get("document_title"),
                "heading": row.get("heading"),
                "excerpt": (row.get("content") or "")[:700],
                "similarity": round(float(row["similarity"]), 3),
            }
            for row in (rows or [])
        ],
    }


@router.get("/rag/documents")
async def list_documents(user: FacultyDep) -> dict[str, Any]:
    """
    The ingest log, including failures. Faculty need to see what did *not* index
    — a corpus you cannot audit is a corpus you cannot trust the tutor to cite.
    """
    rows = await admin_db().select(
        "content_documents",
        "id, title, source_type, ingest_status, ingest_error, chunk_count, embedding_model, "
        "byte_size, concept_id, chapter_id, created_at, updated_at",
        order="created_at.desc",
        limit=100,
    )
    return {"documents": rows}


@router.delete("/rag/documents/{document_id}")
async def delete_document(document_id: str, user: FacultyDep) -> dict[str, Any]:
    db = admin_db()
    document = await db.maybe_single("content_documents", "id, title", filters={"id": document_id})
    if not document:
        raise PublicError("That document was not found.", status=404, code="not_found")

    await db.delete("content_chunks", filters={"document_id": document_id})
    await db.delete("content_documents", filters={"id": document_id})
    return {"deleted": document_id, "title": document["title"]}
