"""
An honest report of what this server can actually do right now.

The frontend uses this to decide what to offer. A feature whose key is missing
is shown as unavailable with a configuration message — it is never hidden and
never faked. No secrets are returned: each field says only whether a key is
present, never what it is.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from .. import __version__
from ..config import settings
from ..services import sandbox

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, Any]:
    runnable = sandbox.runnable_languages()

    features = {
        "database": settings.supabase_configured,
        "tutor": settings.gemini_configured,
        "quizzes": settings.gemini_configured,
        "diagnostic": settings.gemini_configured,
        "codeMentor": settings.gemini_configured,
        "codeExecution": bool(runnable),
        "retrieval": settings.embeddings_configured,
    }

    missing: list[str] = []
    if not settings.supabase_configured:
        missing.append("SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY")
    if not settings.gemini_configured:
        missing.append("GEMINI_API_KEY")
    if not settings.embeddings_configured:
        missing.append("HUGGINGFACE_API_KEY")

    return {
        "status": "ok" if all(features.values()) else "degraded",
        "version": __version__,
        "features": features,
        "runnableLanguages": runnable,
        "models": {
            "chat": settings.gemini_model if settings.gemini_configured else None,
            "embeddings": settings.embedding_model if settings.embeddings_configured else None,
        },
        "missingConfiguration": missing,
    }
