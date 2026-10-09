"""
xAI Grok, called server-side only.

The API key never leaves this process. This module mirrors the contract of
services/gemini.py — same public functions, same types, same error behaviour.
Grok uses the OpenAI-compatible chat completions API.
"""

from __future__ import annotations

import json
from typing import Any, Literal, TypedDict

from ..config import settings
from ..db import http_client
from ..errors import NotConfigured, PublicError

API_ROOT = "https://api.x.ai/v1"


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
    if not settings.grok_configured:
        raise NotConfigured(
            "The AI tutor is not configured on this server. An administrator needs to set "
            "GROK_API_KEY in the backend environment.",
            code="grok_not_configured",
        )


def _to_openai_messages(
    contents: list[Message], *, system: str | None = None
) -> list[dict[str, str]]:
    """Convert Gemini-style contents to OpenAI messages format."""
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    for msg in contents:
        role = "assistant" if msg["role"] == "model" else "user"
        text = "".join(part.get("text", "") for part in msg["parts"])
        messages.append({"role": role, "content": text})
    return messages


async def _call(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    response_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    require_configured()

    body: dict[str, Any] = {
        "model": settings.grok_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        body["response_format"] = response_format

    try:
        response = await http_client().post(
            f"{API_ROOT}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.grok_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    except Exception as exc:  # network-level failure
        raise PublicError(
            "The AI service could not be reached. Please try again in a moment.",
            status=502,
            code="grok_unreachable",
        ) from exc

    if response.status_code == 429:
        raise PublicError(
            "The AI service is rate-limited right now. Please wait a moment and try again.",
            status=429,
            code="grok_rate_limited",
        )
    if response.status_code in (401, 403):
        raise PublicError(
            "The AI service rejected this server's API key. An administrator needs to check "
            "GROK_API_KEY.",
            status=502,
            code="grok_rejected_key",
        )
    if response.status_code >= 400:
        raise PublicError(
            f"The AI service returned an error ({response.status_code}). Please try again.",
            status=502,
            code="grok_error",
        )

    return response.json()


def _extract_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise PublicError(
            "The AI returned an empty response. Please try again.",
            status=502,
            code="grok_empty",
        )

    choice = choices[0]
    if choice.get("finish_reason") == "content_filter":
        raise PublicError(
            "The AI declined to answer that request. Try rephrasing your question.",
            status=422,
            code="grok_blocked",
        )

    text = (choice.get("message", {}).get("content") or "").strip()
    if not text:
        raise PublicError(
            "The AI returned an empty response. Please try again.",
            status=502,
            code="grok_empty",
        )
    return text


async def generate(
    contents: list[Message],
    *,
    system: str | None = None,
    temperature: float = 0.4,
    max_output_tokens: int = 1200,
) -> str:
    messages = _to_openai_messages(contents, system=system)
    return _extract_text(
        await _call(messages, temperature=temperature, max_tokens=max_output_tokens)
    )


async def generate_json(
    contents: list[Message],
    schema: dict[str, Any],
    *,
    system: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 2048,
) -> Any:
    """Structured output using json_schema response format."""
    messages = _to_openai_messages(contents, system=system)

    response_format: dict[str, Any] = {
        "type": "json_schema",
        "json_schema": {
            "name": "structured_output",
            "strict": True,
            "schema": schema,
        },
    }

    text = _extract_text(
        await _call(
            messages,
            temperature=temperature,
            max_tokens=max_output_tokens,
            response_format=response_format,
        )
    )

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise PublicError(
            "The AI returned a response this server could not read. Please try again.",
            status=502,
            code="grok_bad_json",
        ) from exc
