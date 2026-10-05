"""Chat-model factory for Google Gemini and OpenAI (LangChain provider packages)."""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request

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


# Model ids that are not chat/text models (speech, images, embeddings, realtime...).
_NON_CHAT = re.compile(r"tts|image|embed|live|audio|realtime|transcribe|search|instruct|robotics|computer-use|moderation|dall-e|whisper|codex|aqa")


def _fetch_json(url: str, headers: dict[str, str], timeout: float = 15) -> dict:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 401, 403):
            raise LLMConfigError("That API key was rejected by the provider. Check it and try again.") from exc
        raise LLMConfigError(f"Couldn't load models from the provider (HTTP {exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise LLMConfigError("Couldn't reach the provider to load models.") from exc


def _gemini_sort_key(name: str) -> tuple:
    m = re.match(r"gemini-(\d+(?:\.\d+)?)", name)
    version = float(m.group(1)) if m else 0.0
    return (-version, "preview" in name or "exp" in name, "lite" in name, "pro" in name, name)


def list_models(provider: str, api_key: str) -> list[str]:
    """Ask the provider which chat models this key can use, newest first."""
    if not api_key:
        raise LLMConfigError("Add an API key to load the model list.")
    if provider == "gemini":
        names: list[str] = []
        token = ""
        for _ in range(5):
            url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
            if token:
                url += f"&pageToken={token}"
            data = _fetch_json(url, {"x-goog-api-key": api_key})
            for m in data.get("models", []):
                name = m.get("name", "").removeprefix("models/")
                if (
                    name.startswith("gemini")
                    and "generateContent" in m.get("supportedGenerationMethods", [])
                    and not _NON_CHAT.search(name)
                ):
                    names.append(name)
            token = data.get("nextPageToken", "")
            if not token:
                break
        return sorted(set(names), key=_gemini_sort_key)
    if provider == "openai":
        data = _fetch_json("https://api.openai.com/v1/models", {"Authorization": f"Bearer {api_key}"})
        models = [
            m for m in data.get("data", [])
            if re.match(r"(gpt-|o\d|chatgpt-)", m.get("id", "")) and not _NON_CHAT.search(m["id"])
        ]
        models.sort(key=lambda m: m.get("created", 0), reverse=True)
        return [m["id"] for m in models]
    raise LLMConfigError(f"Unknown LLM provider: {provider!r}")
