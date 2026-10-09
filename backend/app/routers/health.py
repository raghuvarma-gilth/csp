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
from ..services import ai, sandbox

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, Any]:
    runnable = sandbox.runnable_languages()

    features = {
        "database": settings.supabase_configured,
        "tutor": settings.ai_configured,
        "quizzes": settings.ai_configured,
        "diagnostic": settings.ai_configured,
        "codeMentor": settings.ai_configured,
        "codeExecution": bool(runnable),
        "retrieval": settings.embeddings_configured,
    }

    missing: list[str] = []
    if not settings.supabase_configured:
        missing.append("SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY")
    if not settings.ai_configured:
        missing.append("GEMINI_API_KEY or GROK_API_KEY (at least one)")
    if not settings.embeddings_configured:
        missing.append("HUGGINGFACE_API_KEY")

    active_provider = ai.provider_name()
    chat_model = None
    if active_provider == "gemini":
        chat_model = settings.gemini_model
    elif active_provider == "grok":
        chat_model = settings.grok_model

    return {
        "status": "ok" if all(features.values()) else "degraded",
        "version": __version__,
        "features": features,
        "runnableLanguages": runnable,
        "models": {
            "chat": chat_model,
            "chatProvider": active_provider,
            "embeddings": settings.embedding_model if settings.embeddings_configured else None,
        },
        "missingConfiguration": missing,
    }
