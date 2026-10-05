"""API tests with FastAPI's TestClient and a fake LLM (no network, no API key)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from api.main import app, get_llm_factory

HEADERS = {"X-Session-Id": "test-session-0001"}
CSV = b"Region,Sales Amount,Order Date\nNorth,100,2024-01-01\nSouth,250,2024-01-02\nNorth,50,2024-01-03\n"


@pytest.fixture()
def client_with_llm():
    """Yield a function that returns a TestClient whose LLM replies with `responses`."""

    def make(responses: list[str]) -> TestClient:
        model = FakeListChatModel(responses=responses)
        app.dependency_overrides[get_llm_factory] = lambda: (lambda opts, key: model)
        return TestClient(app)

    yield make
    app.dependency_overrides.clear()


def upload_csv(client: TestClient) -> str:
    resp = client.post("/api/sources/upload", headers=HEADERS, files=[("files", ("Sales Data.csv", CSV, "text/csv"))])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tables"][0]["name"] == "sales_data"
    assert [c["name"] for c in body["tables"][0]["columns"]] == ["region", "sales_amount", "order_date"]
    return body["source_id"]


def test_health_and_config() -> None:
    client = TestClient(app)
    assert client.get("/api/health").json() == {"status": "ok"}
    cfg = client.get("/api/config").json()
    assert set(cfg["models"]) == {"gemini", "openai"}
    assert len(cfg["examples"]) == 6


def test_upload_then_query_returns_rows_chart_and_summary(client_with_llm) -> None:
    client = client_with_llm(
        ["SELECT region, SUM(sales_amount) AS total FROM sales_data GROUP BY region ORDER BY total DESC", "South leads with 250."]
    )
    source_id = upload_csv(client)
    resp = client.post("/api/query", headers=HEADERS, json={"question": "Sales by region?", "source_id": source_id})
    body = resp.json()
    assert resp.status_code == 200 and body["error_kind"] is None
    assert body["rows"] == [{"region": "South", "total": 250}, {"region": "North", "total": 150}]
    assert body["chart"]["kind"] == "bar"
    assert body["summary"] == "South leads with 250."
    assert "LIMIT 500" in body["sql"]

    history = client.get("/api/history", headers=HEADERS).json()
    assert history[0]["question"] == "Sales by region?" and history[0]["status"] == "✅"
    assert b"Sales by region?" in client.get("/api/history.csv", headers=HEADERS).content


def test_blocked_query_is_reported(client_with_llm) -> None:
    client = client_with_llm(["DELETE FROM sales_data"])
    source_id = upload_csv(client)
    body = client.post("/api/query", headers=HEADERS, json={"question": "Delete everything", "source_id": source_id}).json()
    assert body["error_kind"] == "blocked"
    assert body["rows"] == []


def test_self_correction_through_api(client_with_llm) -> None:
    client = client_with_llm(["SELECT regon FROM sales_data", "SELECT DISTINCT region FROM sales_data", "Two regions."])
    source_id = upload_csv(client)
    body = client.post("/api/query", headers=HEADERS, json={"question": "Regions?", "source_id": source_id}).json()
    assert body["auto_fixed"] is True
    assert body["row_count"] == 2


def test_missing_api_key_gives_friendly_400(monkeypatch) -> None:
    from api import main

    monkeypatch.setattr(main.settings, "google_api_key", "")
    monkeypatch.setattr(main.settings, "openai_api_key", "")
    client = TestClient(app)
    source_id = upload_csv(client)
    resp = client.post("/api/query", headers=HEADERS, json={"question": "Hi", "source_id": source_id, "provider": "gemini"})
    assert resp.status_code == 400
    assert "API key" in resp.json()["detail"]


def test_bad_upload_and_unknown_source() -> None:
    client = TestClient(app)
    resp = client.post("/api/sources/upload", headers=HEADERS, files=[("files", ("notes.txt", b"hi", "text/plain"))])
    assert resp.status_code == 400
    assert client.get("/api/sources/upload-missing", headers=HEADERS).status_code == 404


def test_explain(client_with_llm) -> None:
    client = client_with_llm(["- **SELECT** picks the region"])
    resp = client.post("/api/explain", headers=HEADERS, json={"question": "q", "sql": "SELECT region FROM t"})
    assert resp.json()["explanation"].startswith("- **SELECT**")
