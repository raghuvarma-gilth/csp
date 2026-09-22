"""
Google Gemini, called server-side only.

The API key never leaves this process. There is no fallback text anywhere in
this module: if Gemini is unconfigured, unreachable, rate-limited or refuses to
answer, the caller gets an exception with a message explaining which of those
happened. Inventing a plausible-sounding reply and presenting it as the tutor's
answer would be worse than showing an error, because the student cannot tell
the difference.
"""

from __future__ import annotations

import json
from typing import Any, Literal, TypedDict

from ..config import settings
from ..db import http_client
from ..errors import NotConfigured, PublicError

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"


class Part(TypedDict):
    text: str


class Message(TypedDict):
    role: Literal["user", "model"]
    parts: list[Part]


def user_message(text: str) -> Message:
    return {"role": "user", "parts": [{"text": text}]}


def model_message(text: str) -> Message:
    return {"role": "model", "parts": [{"text": text}]}


def require_configured() -> None:
    if not settings.gemini_configured:
        raise NotConfigured(
            "The AI tutor is not configured on this server. An administrator needs to set "
            "GEMINI_API_KEY in the backend environment.",
            code="gemini_not_configured",
        )


async def _call(body: dict[str, Any]) -> dict[str, Any]:
    require_configured()

    try:
        response = await http_client().post(
            f"{API_ROOT}/{settings.gemini_model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
            json=body,
        )
    except Exception as exc:  # network-level failure
        raise PublicError(
            "The AI service could not be reached. Please try again in a moment.",
            status=502,
            code="gemini_unreachable",
        ) from exc

    if response.status_code == 429:
        raise PublicError(
            "The AI service is rate-limited right now. Please wait a moment and try again.",
            status=429,
            code="gemini_rate_limited",
        )
    if response.status_code in (401, 403):
        raise PublicError(
            "The AI service rejected this server's API key. An administrator needs to check "
            "GEMINI_API_KEY.",
            status=502,
            code="gemini_rejected_key",
        )
    if response.status_code >= 400:
        raise PublicError(
            f"The AI service returned an error ({response.status_code}). Please try again.",
            status=502,
            code="gemini_error",
        )

    return response.json()


def _extract_text(payload: dict[str, Any]) -> str:
    blocked = (payload.get("promptFeedback") or {}).get("blockReason")
    if blocked:
        raise PublicError(
            "The AI declined to answer that request. Try rephrasing your question.",
            status=422,
            code="gemini_blocked",
        )

    candidates = payload.get("candidates") or []
    if not candidates:
        raise PublicError(
            "The AI returned an empty response. Please try again.", status=502, code="gemini_empty"
        )

    candidate = candidates[0]
    if candidate.get("finishReason") == "SAFETY":
        raise PublicError(
            "The AI stopped because its safety filters were triggered. Try rephrasing.",
            status=422,
            code="gemini_blocked",
        )

    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise PublicError(
            "The AI returned an empty response. Please try again.", status=502, code="gemini_empty"
        )
    return text


async def generate(
    contents: list[Message],
    *,
    system: str | None = None,
    temperature: float = 0.4,
    max_output_tokens: int = 1200,
) -> str:
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "topP": 0.95,
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    return _extract_text(await _call(body))


async def generate_json(
    contents: list[Message],
    schema: dict[str, Any],
    *,
    system: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 2048,
) -> Any:
    """
    Structured output. `responseSchema` makes the model return parseable JSON
    instead of prose wrapped in a code fence, which removes a whole class of
    'the AI said something almost right' bugs.
    """
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    text = _extract_text(await _call(body))
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise PublicError(
            "The AI returned a response this server could not read. Please try again.",
            status=502,
            code="gemini_bad_json",
        ) from exc
