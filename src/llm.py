"""Chat-model factory for Google Gemini and OpenAI (LangChain provider packages)."""

from __future__ import annotations

import logging

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)


class LLMConfigError(ValueError):
    """Raised when the LLM cannot be created (missing key, unknown provider)."""


def create_llm(provider: str, model: str, api_key: str, temperature: float = 0.0) -> BaseChatModel:
    """Build a LangChain chat model for the given provider.

    Args:
        provider: "gemini" or "openai".
        model: Provider model name, e.g. "gemini-2.5-flash" or "gpt-4o-mini".
        api_key: The API key (never hard-coded; comes from the request header or the server .env).
        temperature: Sampling temperature; 0 gives the most deterministic SQL.
    """
    if not api_key:
        raise LLMConfigError(
            f"No API key found for {provider!r}. Paste one in the settings panel or set it in the server .env."
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        logger.info("Creating Gemini model %s", model)
        return ChatGoogleGenerativeAI(model=model, google_api_key=api_key, temperature=temperature, max_retries=1)

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        logger.info("Creating OpenAI model %s", model)
        return ChatOpenAI(model=model, api_key=api_key, temperature=temperature, max_retries=1, timeout=60)

    raise LLMConfigError(f"Unknown LLM provider: {provider!r}")


def is_auth_error(exc: BaseException) -> bool:
    """Heuristically detect an invalid / missing API key error from either provider."""
    text = f"{type(exc).__name__} {exc}".lower()
    markers = (
        "api key not valid",
        "api_key_invalid",
        "invalid api key",
        "incorrect api key",
        "authenticationerror",
        "permission denied",
        "unauthenticated",
        "401",
    )
    return any(m in text for m in markers)
