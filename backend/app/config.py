"""
Configuration, read once from the environment.

Nothing here has a working default that would let the server pretend a missing
key is present. If GEMINI_API_KEY is absent the AI endpoints return a 503 that
says so; they do not fall back to canned text. That rule is the whole point of
this file being explicit about what is and is not configured.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Supabase -----------------------------------------------------------
    # SERVICE_ROLE_KEY bypasses RLS. It lives here and nowhere else: it is never
    # returned to a client, never logged, and never used to answer a request
    # whose caller has not been identified first.
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")

    # --- AI providers -------------------------------------------------------
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")
    huggingface_api_key: str = Field(default="", alias="HUGGINGFACE_API_KEY")
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", alias="EMBEDDING_MODEL"
    )
    embedding_dimensions: int = Field(default=384, alias="EMBEDDING_DIMENSIONS")

    # --- HTTP ---------------------------------------------------------------
    allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080",
        alias="ALLOWED_ORIGINS",
    )
    request_timeout_seconds: float = Field(default=60.0, alias="REQUEST_TIMEOUT_SECONDS")

    # --- Student code execution --------------------------------------------
    # Read the warning in services/sandbox.py before turning this on anywhere
    # that is not a disposable container.
    code_execution_enabled: bool = Field(default=True, alias="CODE_EXECUTION_ENABLED")
    code_execution_timeout_seconds: float = Field(
        default=6.0, alias="CODE_EXECUTION_TIMEOUT_SECONDS"
    )
    code_execution_memory_mb: int = Field(default=256, alias="CODE_EXECUTION_MEMORY_MB")
    node_binary: str = Field(default="node", alias="NODE_BINARY")
    python_binary: str = Field(default="", alias="PYTHON_BINARY")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key and self.supabase_anon_key)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def embeddings_configured(self) -> bool:
        return bool(self.huggingface_api_key)

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
