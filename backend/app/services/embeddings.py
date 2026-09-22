"""
Hugging Face embeddings for the retrieval layer.

384-dimensional vectors from sentence-transformers/all-MiniLM-L6-v2, matching
the `vector(384)` column and the HNSW index in the RAG migration. If you change
EMBEDDING_MODEL you must change the column type and re-embed everything — a
vector from a different model is not comparable to the ones already stored, and
cosine similarity against it is meaningless rather than merely wrong.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

from ..config import settings
from ..db import http_client
from ..errors import NotConfigured, PublicError

API_ROOT = "https://api-inference.huggingface.co/pipeline/feature-extraction"

MAX_CHUNK_CHARS = 1_200
CHUNK_OVERLAP_CHARS = 150


def require_configured() -> None:
    if not settings.embeddings_configured:
        raise NotConfigured(
            "Document search is not configured on this server. An administrator needs to set "
            "HUGGINGFACE_API_KEY in the backend environment.",
            code="embeddings_not_configured",
        )


def _mean_pool(value: Any) -> list[float]:
    """
    The endpoint returns either a vector or a token-by-token matrix depending on
    the model card. Average the matrix so both shapes produce one sentence
    vector of the expected width.
    """
    if not isinstance(value, list) or not value:
        raise PublicError(
            "The embedding service returned an unexpected response.",
            status=502,
            code="embeddings_error",
        )
    if isinstance(value[0], (int, float)):
        return [float(item) for item in value]
    if isinstance(value[0], list) and value[0] and isinstance(value[0][0], (int, float)):
        width = len(value[0])
        totals = [0.0] * width
        for row in value:
            for index in range(width):
                totals[index] += float(row[index])
        return [total / len(value) for total in totals]
    # One more level of nesting happens when a batch of size 1 is sent.
    return _mean_pool(value[0])


async def embed(texts: list[str]) -> list[list[float]]:
    require_configured()
    if not texts:
        return []

    try:
        response = await http_client().post(
            f"{API_ROOT}/{settings.embedding_model}",
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type": "application/json",
            },
            json={"inputs": texts, "options": {"wait_for_model": True}},
            timeout=120.0,
        )
    except Exception as exc:
        raise PublicError(
            "The embedding service could not be reached. Please try again in a moment.",
            status=502,
            code="embeddings_unreachable",
        ) from exc

    if response.status_code == 503:
        raise PublicError(
            "The embedding model is still loading on Hugging Face. Try again in about a minute.",
            status=503,
            code="embeddings_loading",
        )
    if response.status_code in (401, 403):
        raise PublicError(
            "The embedding service rejected this server's API key. An administrator needs to "
            "check HUGGINGFACE_API_KEY.",
            status=502,
            code="embeddings_rejected_key",
        )
    if response.status_code >= 400:
        raise PublicError(
            f"The embedding service returned an error ({response.status_code}).",
            status=502,
            code="embeddings_error",
        )

    payload = response.json()
    vectors = [_mean_pool(item) for item in payload] if len(texts) > 1 else [_mean_pool(payload)]

    for vector in vectors:
        if len(vector) != settings.embedding_dimensions:
            raise PublicError(
                f"The embedding model returned {len(vector)} dimensions but the database column "
                f"expects {settings.embedding_dimensions}. Check EMBEDDING_MODEL.",
                status=500,
                code="embeddings_dimension_mismatch",
            )
    return vectors


async def embed_one(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]


async def embed_batched(texts: list[str], *, batch_size: int = 16) -> list[list[float]]:
    out: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        out.extend(await embed(texts[start : start + batch_size]))
        if start + batch_size < len(texts):
            await asyncio.sleep(0.1)  # be a polite API citizen
    return out


def to_pgvector(vector: list[float]) -> str:
    """PostgREST wants a pgvector literal, not a JSON array."""
    return "[" + ",".join(f"{value:.6f}" for value in vector) + "]"


_PARAGRAPH = re.compile(r"\n\s*\n")
_HEADING = re.compile(r"^(#{1,4})\s+(.*)$")


def chunk_text(text: str) -> list[dict[str, Any]]:
    """
    Split on paragraph boundaries, carrying the nearest markdown heading with
    each chunk so a retrieved excerpt can tell the student where it came from.
    Chunks overlap slightly so a sentence split across a boundary is still
    findable from either side.
    """
    chunks: list[dict[str, Any]] = []
    heading: str | None = None
    buffer = ""

    def flush() -> None:
        nonlocal buffer
        body = buffer.strip()
        if body:
            chunks.append({"heading": heading, "content": body})
        buffer = ""

    for block in _PARAGRAPH.split(text.replace("\r\n", "\n")):
        block = block.strip()
        if not block:
            continue

        match = _HEADING.match(block.splitlines()[0])
        if match:
            flush()
            heading = match.group(2).strip()

        if len(buffer) + len(block) + 2 > MAX_CHUNK_CHARS:
            flush()
            # Carry the tail of the previous chunk forward as context.
            if chunks and CHUNK_OVERLAP_CHARS:
                buffer = chunks[-1]["content"][-CHUNK_OVERLAP_CHARS:] + "\n\n"

        buffer += block + "\n\n"

        while len(buffer) > MAX_CHUNK_CHARS:
            chunks.append({"heading": heading, "content": buffer[:MAX_CHUNK_CHARS].strip()})
            buffer = buffer[MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS :]

    flush()
    return [chunk for chunk in chunks if len(chunk["content"]) > 40]
