"""QueryMate REST API (FastAPI).

Run locally:  uvicorn api.main:app --reload
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated, Callable

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from langchain_core.language_models import BaseChatModel

from api.schemas import (
    ModelsOut,
    ConfigOut,
    ConnectRequest,
    ExplainRequest,
    ExplainResponse,
    HistoryEntryOut,
    LLMOptions,
    QueryRequest,
    QueryResponse,
    SourceOut,
)
from api.state import CHINOOK_ID, DataSource, Session, SessionStore
from scripts.download_chinook import ensure_chinook
from src.charts import chart_payload, to_records
from src.config import CHINOOK_PATH, FRONTEND_DIST, PROVIDER_MODELS, Settings, get_settings
from src.database import (
    FileLoadError,
    create_sqlite_readonly_engine,
    create_url_engine,
    get_schema,
    load_files_to_sqlite,
)
from src.llm import LLMConfigError, create_llm, is_auth_error, list_models
from src.pipeline import QueryPipeline, Turn

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("querymate.api")

EXAMPLE_QUESTIONS: list[str] = [
    "Which 5 countries generated the most revenue?",
    "Show the monthly revenue trend for 2013",
    "What are the top-selling genres by tracks sold?",
    "Who is the best sales support agent by revenue?",
    "Which 10 artists have the most tracks in the catalog?",
    "What is the average invoice total per customer country?",
]

settings = get_settings()
store = SessionStore(ttl_seconds=settings.session_ttl_minutes * 60)
_chinook: DataSource | None = None
_chinook_lock = threading.Lock()


# ----------------------------------------------------------------------------- dependencies


def get_chinook() -> DataSource:
    """The shared, read-only Chinook demo source (downloaded on first use)."""
    global _chinook
    with _chinook_lock:
        if _chinook is None:
            try:
                engine = create_sqlite_readonly_engine(ensure_chinook(CHINOOK_PATH))
            except Exception as exc:
                raise HTTPException(503, f"The Chinook demo database is unavailable: {exc}") from exc
            _chinook = DataSource(CHINOOK_ID, "chinook", "Chinook demo", engine, get_schema(engine, settings.sample_rows))
        return _chinook


def get_session(x_session_id: Annotated[str, Header(min_length=8, max_length=64)] = "anonymous-session") -> Session:
    """Per-browser session, identified by the X-Session-Id header the frontend generates."""
    return store.get(x_session_id)


def resolve_source(session: Session, source_id: str) -> DataSource:
    """Look up a data source by id for this session."""
    if source_id == CHINOOK_ID:
        return get_chinook()
    source = session.sources.get(source_id)
    if source is None:
        raise HTTPException(404, "That data source has expired. Please upload the file or reconnect again.")
    return source


@lru_cache(maxsize=16)
def _cached_llm(provider: str, model: str, api_key: str, temperature: float) -> BaseChatModel:
    return create_llm(provider, model, api_key, temperature)


LLMFactory = Callable[[LLMOptions, str | None], BaseChatModel]


def get_llm_factory() -> LLMFactory:
    """Return a function building the chat model (overridden with a fake model in tests)."""

    def factory(opts: LLMOptions, header_key: str | None) -> BaseChatModel:
        provider = opts.provider or settings.llm_provider
        model = opts.model or settings.default_model_for(provider)
        api_key = (header_key or "").strip() or settings.api_key_for(provider)
        return _cached_llm(provider, model, api_key, opts.temperature)

    return factory


def build_llm(opts: LLMOptions, header_key: str | None, factory: LLMFactory) -> BaseChatModel:
    """Create the LLM or raise a friendly 400."""
    try:
        return factory(opts, header_key)
    except LLMConfigError as exc:
        raise HTTPException(400, str(exc)) from exc


def make_pipeline(llm: BaseChatModel, source: DataSource, cfg: Settings) -> QueryPipeline:
    """Pipeline wired with the configured limits."""
    return QueryPipeline(
        llm, source.engine, source.schema,
        max_rows=cfg.max_rows,
        timeout=cfg.query_timeout_seconds,
        max_fix_retries=cfg.max_fix_retries,
        table_selection_threshold=cfg.table_selection_threshold,
        summary_rows=cfg.summary_rows,
        history_turns=cfg.history_turns,
    )


def source_out(source: DataSource) -> SourceOut:
    """Serialize a data source and its schema."""
    return SourceOut(
        source_id=source.source_id,
        kind=source.kind,  # type: ignore[arg-type]
        label=source.label,
        tables=[
            {
                "name": t.name,
                "columns": [{"name": c.name, "type": c.type, "primary_key": c.primary_key} for c in t.columns],
                "foreign_keys": t.foreign_keys,
                "sample": to_records(t.sample),
            }
            for t in source.schema
        ],
    )


# ----------------------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Warm up the Chinook demo database at startup (non-fatal if offline)."""
    try:
        get_chinook()
        logger.info("Chinook demo database ready")
    except HTTPException as exc:
        logger.warning("%s", exc.detail)
    yield


app = FastAPI(title="QueryMate API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionDep = Annotated[Session, Depends(get_session)]
FactoryDep = Annotated[LLMFactory, Depends(get_llm_factory)]
ApiKey = Annotated[str | None, Header(alias="X-API-Key")]


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.get("/api/config", response_model=ConfigOut)
def config() -> ConfigOut:
    """Providers, models, which keys the server already has, and example questions."""
    return ConfigOut(
        default_provider=settings.llm_provider,
        models=PROVIDER_MODELS,
        default_models={p: settings.default_model_for(p) for p in PROVIDER_MODELS},
        server_keys={p: bool(settings.api_key_for(p)) for p in PROVIDER_MODELS},
        examples=EXAMPLE_QUESTIONS,
        max_upload_mb=settings.max_upload_mb,
    )


@app.get("/api/models", response_model=ModelsOut)
def provider_models(provider: str, x_api_key: ApiKey = None) -> ModelsOut:
    """Live list of chat models the given (or server) key can use."""
    if provider not in PROVIDER_MODELS:
        raise HTTPException(400, f"Unknown provider: {provider}")
    try:
        return ModelsOut(provider=provider, models=list_models(provider, x_api_key or settings.api_key_for(provider)))
    except LLMConfigError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/sources/{source_id}", response_model=SourceOut)
def source_schema(source_id: str, session: SessionDep) -> SourceOut:
    """Schema explorer data: tables, columns, types, keys and sample rows."""
    return source_out(resolve_source(session, source_id))


@app.post("/api/sources/upload", response_model=SourceOut)
async def upload(session: SessionDep, files: list[UploadFile] = File(...)) -> SourceOut:
    """Load CSV / Excel files into a new in-memory SQLite source (one table per file or sheet)."""
    payload: list[tuple[str, bytes]] = []
    limit = settings.max_upload_mb * 1024 * 1024
    for f in files:
        data = await f.read()
        if len(data) > limit:
            raise HTTPException(413, f"'{f.filename}' is larger than {settings.max_upload_mb} MB.")
        payload.append((f.filename or "upload.csv", data))
    try:
        engine, tables = load_files_to_sqlite(payload)
    except FileLoadError as exc:
        raise HTTPException(400, str(exc)) from exc
    label = ", ".join(name for name, _ in payload)
    source = store.add_source(session, "upload", label, engine, get_schema(engine, settings.sample_rows))
    logger.info("Upload source %s with tables %s", source.source_id, tables)
    return source_out(source)


@app.post("/api/sources/connect", response_model=SourceOut)
def connect(body: ConnectRequest, session: SessionDep) -> SourceOut:
    """Connect to an external database (read-only session) by SQLAlchemy URL."""
    try:
        engine = create_url_engine(body.url)
        schema = get_schema(engine, settings.sample_rows)
    except Exception as exc:
        raise HTTPException(400, f"Could not connect: {exc}") from exc
    label = f"{engine.dialect.name} · {engine.url.database or ''}".strip(" ·")
    return source_out(store.add_source(session, "connection", label, engine, schema))


@app.post("/api/query", response_model=QueryResponse)
def query(body: QueryRequest, session: SessionDep, factory: FactoryDep, x_api_key: ApiKey = None) -> QueryResponse:
    """Question -> SQL -> rows -> chart + summary. Errors come back in `error` / `error_kind`."""
    source = resolve_source(session, body.source_id)
    llm = build_llm(body, x_api_key, factory)
    result = make_pipeline(llm, source, settings).run(
        body.question, history=[Turn(t.question, t.sql) for t in body.history]
    )
    session.history.add(result)
    return QueryResponse(
        question=result.question,
        sql=result.sql,
        columns=[str(c) for c in result.data.columns],
        rows=to_records(result.data),
        row_count=result.row_count,
        summary=result.summary,
        error=result.error,
        error_kind=result.error_kind,
        auto_fixed=result.auto_fixed,
        attempts=result.attempts,
        tables_used=result.tables_used,
        limit_added=result.limit_added,
        elapsed_ms=round(result.elapsed_ms, 1),
        chart=chart_payload(result.data) if result.ok else {"kind": "table"},
    )


@app.post("/api/explain", response_model=ExplainResponse)
def explain(body: ExplainRequest, factory: FactoryDep, x_api_key: ApiKey = None) -> ExplainResponse:
    """Explain a SQL query line by line in simple English."""
    llm = build_llm(body, x_api_key, factory)
    pipeline = QueryPipeline(llm, get_chinook().engine, [])
    try:
        return ExplainResponse(explanation=pipeline.explain(body.question, body.sql))
    except Exception as exc:
        if is_auth_error(exc):
            raise HTTPException(401, "The API key was rejected. Check it in Settings.") from exc
        raise HTTPException(502, f"The language model request failed: {exc}") from exc


@app.get("/api/history", response_model=list[HistoryEntryOut])
def history(session: SessionDep) -> list[HistoryEntryOut]:
    """This session's query history, newest first."""
    return session.history.to_dataframe().to_dict(orient="records")  # type: ignore[return-value]


@app.get("/api/history.csv")
def history_csv(session: SessionDep) -> Response:
    """Query history as a CSV download."""
    return Response(
        session.history.to_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="querymate_history.csv"'},
    )


@app.delete("/api/history", status_code=204)
def clear_history(session: SessionDep) -> Response:
    """Clear this session's query history."""
    session.history.clear()
    return Response(status_code=204)


# ----------------------------------------------------------------------------- frontend (single-container deploys)

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Serve the built React app; unknown paths fall back to index.html for client-side routing."""
        candidate = (FRONTEND_DIST / path).resolve()
        if path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
