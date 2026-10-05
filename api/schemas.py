"""Request / response models for the QueryMate API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class LLMOptions(BaseModel):
    """Model choice sent with every LLM-backed request (the API key travels in the X-API-Key header)."""

    provider: Literal["gemini", "openai"] | None = None
    model: str | None = Field(default=None, max_length=100)
    temperature: float = Field(default=0.0, ge=0.0, le=1.0)


class TurnIn(BaseModel):
    """A previous question and its SQL, used for follow-up questions."""

    question: str = Field(max_length=1000)
    sql: str = Field(max_length=20_000)


class QueryRequest(LLMOptions):
    """Ask a question about a data source."""

    question: str = Field(min_length=1, max_length=1000)
    source_id: str = "chinook"
    history: list[TurnIn] = Field(default_factory=list, max_length=10)


class ExplainRequest(LLMOptions):
    """Explain a SQL query in plain English."""

    question: str = Field(default="", max_length=1000)
    sql: str = Field(min_length=1, max_length=20_000)


class ConnectRequest(BaseModel):
    """Connect to a PostgreSQL / MySQL / SQLite database by SQLAlchemy URL."""

    url: str = Field(min_length=1, max_length=2000)


class ChartOut(BaseModel):
    """Chart chosen by the rule-based picker, with the rows to plot."""

    kind: Literal["metric", "line", "bar", "scatter", "table"]
    x: str | None = None
    y: list[str] = Field(default_factory=list)
    labels: dict[str, str] = Field(default_factory=dict)
    value: Any = None
    label: str = ""
    data: list[dict[str, Any]] = Field(default_factory=list)


class QueryResponse(BaseModel):
    """One answer: SQL, rows, chart and summary (or a friendly error)."""

    question: str
    sql: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    summary: str
    error: str
    error_kind: Literal["blocked", "auth", "llm", "sql", "timeout"] | None
    auto_fixed: bool
    attempts: list[dict[str, str]]
    tables_used: list[str]
    limit_added: bool
    elapsed_ms: float
    chart: ChartOut


class ExplainResponse(BaseModel):
    """Markdown explanation of a query."""

    explanation: str


class ColumnOut(BaseModel):
    name: str
    type: str
    primary_key: bool


class TableOut(BaseModel):
    """A table in the schema explorer."""

    name: str
    columns: list[ColumnOut]
    foreign_keys: list[str]
    sample: list[dict[str, Any]]


class SourceOut(BaseModel):
    """A data source and its schema."""

    source_id: str
    kind: Literal["chinook", "upload", "connection"]
    label: str
    tables: list[TableOut]


class HistoryEntryOut(BaseModel):
    timestamp: str
    question: str
    sql: str
    status: str
    rows: int
    time_ms: float
    auto_fixed: bool
    error: str


class ConfigOut(BaseModel):
    """Frontend bootstrap data."""

    default_provider: str
    models: dict[str, list[str]]
    default_models: dict[str, str]
    server_keys: dict[str, bool]
    examples: list[str]
    max_upload_mb: int
