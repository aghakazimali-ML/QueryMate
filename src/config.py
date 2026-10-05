"""Application settings loaded from environment variables / `.env`."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Serverless hosts (Vercel) only allow writes under /tmp.
DATA_DIR = Path("/tmp/querymate") if os.environ.get("VERCEL") else PROJECT_ROOT / "data"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
CHINOOK_PATH = DATA_DIR / "Chinook_Sqlite.sqlite"

Provider = Literal["gemini", "openai"]

# Fallback models for the settings panel (first one is the default). With an API key,
# the app asks the provider for its live model list instead (see src/llm.py:list_models).
PROVIDER_MODELS: dict[str, list[str]] = {
    "gemini": [
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro",
    ],
    "openai": ["gpt-4o-mini", "gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o", "gpt-4.1"],
}


class Settings(BaseSettings):
    """Typed configuration. Every field can be overridden by an env var of the same name."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    llm_provider: Provider = "gemini"
    google_api_key: str = ""
    openai_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    openai_model: str = "gpt-4o-mini"
    llm_temperature: float = Field(default=0.0, ge=0.0, le=1.0)

    max_rows: int = Field(default=500, ge=1, le=10_000)
    query_timeout_seconds: float = Field(default=15.0, gt=0)
    max_fix_retries: int = Field(default=2, ge=0, le=5)
    table_selection_threshold: int = Field(default=8, ge=1)
    sample_rows: int = Field(default=3, ge=0, le=10)
    summary_rows: int = Field(default=20, ge=1, le=100)
    history_turns: int = Field(default=3, ge=0, le=10)

    # Comma-separated origins allowed to call the API (the Vercel URL in production).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_upload_mb: int = Field(default=50, ge=1, le=500)
    session_ttl_minutes: int = Field(default=120, ge=5)

    chinook_url: str = (
        "https://raw.githubusercontent.com/lerocha/chinook-database/v1.4.5/"
        "ChinookDatabase/DataSources/Chinook_Sqlite.sqlite"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Parsed CORS origins."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def api_key_for(self, provider: str) -> str:
        """Return the configured API key for a provider ('' if not set)."""
        return self.google_api_key if provider == "gemini" else self.openai_api_key

    def default_model_for(self, provider: str) -> str:
        """Return the configured default model for a provider."""
        return self.gemini_model if provider == "gemini" else self.openai_model


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
