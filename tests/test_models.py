"""Live model listing: filtering, ordering and the /api/models route."""

import pytest

from src import llm
from src.llm import LLMConfigError, list_models


def test_gemini_models_filtered_and_newest_first(monkeypatch):
    payload = {
        "models": [
            {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-3-pro-preview", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
            {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"]},
        ]
    }
    monkeypatch.setattr(llm, "_fetch_json", lambda url, headers, timeout=15: payload)
    assert list_models("gemini", "k") == ["gemini-3-pro-preview", "gemini-2.5-flash", "gemini-2.0-flash"]


def test_openai_models_sorted_by_created(monkeypatch):
    payload = {"data": [
        {"id": "gpt-4o-mini", "created": 1},
        {"id": "gpt-5", "created": 3},
        {"id": "whisper-1", "created": 5},
        {"id": "gpt-4o-realtime-preview", "created": 4},
    ]}
    monkeypatch.setattr(llm, "_fetch_json", lambda url, headers, timeout=15: payload)
    assert list_models("openai", "k") == ["gpt-5", "gpt-4o-mini"]


def test_missing_key_is_config_error():
    with pytest.raises(LLMConfigError):
        list_models("gemini", "")


def test_models_route(monkeypatch):
    from fastapi.testclient import TestClient

    import api.main as main

    client = TestClient(main.app)

    monkeypatch.setattr(main, "list_models", lambda provider, key: [f"{provider}:{key}"])
    res = client.get("/api/models", params={"provider": "gemini"}, headers={"X-API-Key": "abc"})
    assert res.status_code == 200
    assert res.json()["models"] == ["gemini:abc"]
    assert client.get("/api/models", params={"provider": "nope"}).status_code == 400
