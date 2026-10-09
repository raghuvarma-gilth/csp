"""
AI provider dispatcher.

This module presents the same interface as services/gemini.py and
services/grok.py — `generate`, `generate_json`, `user_message`,
`model_message`, `require_configured` — but delegates to whichever provider
is actually configured:

  1. If Gemini has a key, use Gemini.
  2. Otherwise, if Grok has a key, use Grok.
  3. If neither is configured, raise NotConfigured.

Routers import from here instead of directly from gemini or grok, so the
choice of model provider is made in exactly one place. Adding a third provider
later means adding one more elif here and nothing else in the routers.
"""

from __future__ import annotations

from typing import Any

from ..config import settings
from ..errors import NotConfigured
from . import gemini, grok

# Re-export the message constructors — they are identical across providers.
Message = gemini.Message
user_message = gemini.user_message
model_message = gemini.model_message


def _provider() -> type[gemini] | type[grok]:  # type: ignore[valid-type]
    """Pick the first configured provider."""
    if settings.gemini_configured:
        return gemini  # type: ignore[return-value]
    if settings.grok_configured:
        return grok  # type: ignore[return-value]
    return gemini  # type: ignore[return-value]  # will raise NotConfigured


def require_configured() -> None:
    """Raise if no AI chat provider is configured at all."""
    if not settings.ai_configured:
        raise NotConfigured(
            "The AI tutor is not configured on this server. An administrator needs "
            "to set GEMINI_API_KEY or GROK_API_KEY in the backend environment.",
            code="ai_not_configured",
        )


async def generate(
    contents: list[Message],
    *,
    system: str | None = None,
    temperature: float = 0.4,
    max_output_tokens: int = 1200,
) -> str:
    require_configured()
    provider = _provider()
    return await provider.generate(
        contents,
        system=system,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


async def generate_json(
    contents: list[Message],
    schema: dict[str, Any],
    *,
    system: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 2048,
) -> Any:
    require_configured()
    provider = _provider()
    return await provider.generate_json(
        contents,
        schema,
        system=system,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


def provider_name() -> str:
    """The name of the provider that would be used right now (for health/logging)."""
    if settings.gemini_configured:
        return "gemini"
    if settings.grok_configured:
        return "grok"
    return "none"
