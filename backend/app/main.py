"""
EduVerse API.

Everything the browser must not be trusted with lives behind this process:
the Gemini / Grok and Hugging Face keys, the Supabase service role, question answer
keys, grading, and role grants. The browser holds only the anon key and the
signed-in user's own access token.

Run it with:

    uvicorn app.main:app --reload --port 8000

from the `backend/` directory, with a `.env` alongside (see `.env.example`).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .db import close_http_client, open_http_client
from .errors import install_error_handlers
from .routers import code, content, diagnostic, focus, health, plan, quiz, rag, tutor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("eduverse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    open_http_client()

    # Say plainly, at boot, what is missing — so a misconfigured deployment is
    # obvious in the logs rather than only when a student hits a 503.
    if not settings.supabase_configured:
        logger.warning("Supabase is not configured: every data route will return 503.")
    if not settings.ai_configured:
        logger.warning("Neither GEMINI_API_KEY nor GROK_API_KEY is set: tutor, quizzes and diagnostic are unavailable.")
    elif not settings.gemini_configured:
        logger.info("GEMINI_API_KEY is not set; using Grok (%s) for AI features.", settings.grok_model)
    elif not settings.grok_configured:
        logger.info("GROK_API_KEY is not set; using Gemini (%s) for AI features.", settings.gemini_model)
    else:
        logger.info(
            "Both Gemini (%s) and Grok (%s) are configured; Gemini is the primary provider.",
            settings.gemini_model,
            settings.grok_model,
        )
    if not settings.embeddings_configured:
        logger.warning("HUGGINGFACE_API_KEY is not set: retrieval and ingest are unavailable.")
    if not settings.code_execution_enabled:
        logger.warning("Code execution is disabled: submissions cannot be graded.")

    try:
        yield
    finally:
        await close_http_client()


app = FastAPI(
    title="EduVerse API",
    version=__version__,
    description=(
        "Server-side layer for EduVerse. Holds the API keys, the answer keys, the grader "
        "and the role grants — none of which belong in a browser."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
    max_age=600,
)

install_error_handlers(app)

for module in (health, quiz, tutor, plan, code, diagnostic, rag, focus, content):
    app.include_router(module.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "eduverse-api", "version": __version__, "docs": "/docs"}
