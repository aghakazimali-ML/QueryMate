"""Database helpers: engines (read-only), file uploads -> SQLite, schema extraction, execution."""

from __future__ import annotations

import io
import logging
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO

import pandas as pd
from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.pool import StaticPool

logger = logging.getLogger(__name__)


class QueryTimeoutError(RuntimeError):
    """Raised when a query exceeds the configured time limit."""


class FileLoadError(ValueError):
    """Raised when an uploaded CSV/Excel file cannot be read."""


# --------------------------------------------------------------------------- engines


def create_sqlite_readonly_engine(path: str | Path) -> Engine:
    """Open an on-disk SQLite database in read-only mode (`file:...?mode=ro`)."""
    path = Path(path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"SQLite database not found: {path}")
    uri = f"file:{path.as_posix()}?mode=ro"

    def _connect() -> sqlite3.Connection:
        return sqlite3.connect(uri, uri=True, check_same_thread=False)

    return create_engine("sqlite://", creator=_connect, poolclass=StaticPool)


def create_memory_engine() -> Engine:
    """Create a shared in-memory SQLite engine (one connection, usable across threads)."""
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def create_url_engine(url: str) -> Engine:
    """Create an engine from a SQLAlchemy URL (PostgreSQL/MySQL/SQLite) for read-only usage.

    Sessions are switched to read-only where the backend supports it; the SQL guard
    remains the primary safety layer.
    """
    url = url.strip()
    if not url:
        raise ValueError("Connection string is empty.")
    engine = create_engine(url, pool_pre_ping=True)
    backend = engine.dialect.name

    @event.listens_for(engine, "connect")
    def _set_readonly(dbapi_conn, _record) -> None:  # pragma: no cover - needs a live server
        cur = dbapi_conn.cursor()
        try:
            if backend == "postgresql":
                cur.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
            elif backend == "mysql":
                cur.execute("SET SESSION TRANSACTION READ ONLY")
            elif backend == "sqlite":
                cur.execute("PRAGMA query_only = ON")
        finally:
            cur.close()

    return engine


def sql_dialect(engine: Engine) -> str:
    """Return the sqlglot dialect name matching the engine."""
    name = engine.dialect.name
    return {"postgresql": "postgres", "mysql": "mysql", "mariadb": "mysql"}.get(name, "sqlite")


# --------------------------------------------------------------------------- uploads


def clean_identifier(name: str, fallback: str = "col") -> str:
    """Convert any header / file name to a lowercase snake_case SQL identifier."""
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(name).strip())
    name = re.sub(r"[^0-9a-zA-Z]+", "_", name).strip("_").lower()
    if not name:
        name = fallback
    if name[0].isdigit():
        name = f"{fallback}_{name}"
    return name


def clean_columns(columns: list[str]) -> list[str]:
    """Clean column names and de-duplicate them (`amount`, `amount_2`, ...)."""
    seen: dict[str, int] = {}
    result: list[str] = []
    for i, col in enumerate(columns):
        base = clean_identifier(col, fallback=f"col_{i + 1}")
        if base in seen:
            seen[base] += 1
            base = f"{base}_{seen[base]}"
        else:
            seen[base] = 1
        result.append(base)
    return result


def _read_upload(name: str, data: bytes) -> dict[str, pd.DataFrame]:
    """Read one uploaded file into {table_name: DataFrame}. Excel sheets become separate tables."""
    stem = clean_identifier(Path(name).stem, fallback="table")
    suffix = Path(name).suffix.lower()
    try:
        if suffix == ".csv":
            try:
                df = pd.read_csv(io.BytesIO(data))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(data), encoding="latin-1")
            return {stem: df}
        if suffix in {".xlsx", ".xls"}:
            sheets = pd.read_excel(io.BytesIO(data), sheet_name=None)
            if len(sheets) == 1:
                return {stem: next(iter(sheets.values()))}
            return {f"{stem}_{clean_identifier(s, 'sheet')}": df for s, df in sheets.items()}
    except Exception as exc:  # pandas raises many different error types
        raise FileLoadError(f"Could not read '{name}': {exc}") from exc
    raise FileLoadError(f"Unsupported file type for '{name}'. Use .csv, .xlsx or .xls.")


def load_files_to_sqlite(files: list[tuple[str, bytes | BinaryIO]], engine: Engine | None = None) -> tuple[Engine, list[str]]:
    """Load CSV/Excel files into an in-memory SQLite DB, one table per file/sheet.

    Args:
        files: (file_name, raw bytes or file-like) pairs, e.g. from `st.file_uploader`.
        engine: Optional existing engine to load into (a new in-memory one by default).

    Returns:
        The engine and the list of created table names.
    """
    engine = engine or create_memory_engine()
    created: list[str] = []
    for name, payload in files:
        data = payload if isinstance(payload, bytes) else payload.read()
        for table, df in _read_upload(name, data).items():
            if df.empty and len(df.columns) == 0:
                raise FileLoadError(f"'{name}' has no columns.")
            df = df.copy()
            df.columns = clean_columns([str(c) for c in df.columns])
            table_name = table
            n = 2
            while table_name in created:
                table_name = f"{table}_{n}"
                n += 1
            df.to_sql(table_name, engine, index=False, if_exists="replace")
            created.append(table_name)
            logger.info("Loaded %s rows into table %s", len(df), table_name)
    return engine, created


# --------------------------------------------------------------------------- schema


@dataclass
class ColumnInfo:
    """One column of a table."""

    name: str
    type: str
    primary_key: bool = False


@dataclass
class TableInfo:
    """A table with columns, foreign keys and a few sample rows."""

    name: str
    columns: list[ColumnInfo] = field(default_factory=list)
    foreign_keys: list[str] = field(default_factory=list)
    sample: pd.DataFrame = field(default_factory=pd.DataFrame)


def get_schema(engine: Engine, sample_rows: int = 3) -> list[TableInfo]:
    """Introspect every table (and view) with columns, FKs and `sample_rows` example rows."""
    insp = inspect(engine)
    names = sorted(insp.get_table_names()) + sorted(insp.get_view_names())
    preparer = engine.dialect.identifier_preparer
    tables: list[TableInfo] = []
    for name in names:
        try:
            pk = set(insp.get_pk_constraint(name).get("constrained_columns") or [])
        except Exception:
            pk = set()
        cols = [ColumnInfo(c["name"], str(c["type"]) or "TEXT", c["name"] in pk) for c in insp.get_columns(name)]
        fks: list[str] = []
        try:
            for fk in insp.get_foreign_keys(name):
                for local, remote in zip(fk["constrained_columns"], fk["referred_columns"]):
                    fks.append(f"{name}.{local} -> {fk['referred_table']}.{remote}")
        except Exception:
            pass
        sample = pd.DataFrame()
        if sample_rows:
            try:
                with engine.connect() as conn:
                    sample = pd.read_sql(text(f"SELECT * FROM {preparer.quote(name)} LIMIT {int(sample_rows)}"), conn)
            except Exception as exc:
                logger.warning("Could not sample %s: %s", name, exc)
        tables.append(TableInfo(name, cols, fks, sample))
    return tables


def _fmt_value(value: object, max_len: int = 40) -> str:
    """Short string form of a sample value for the prompt."""
    s = "NULL" if value is None or (isinstance(value, float) and pd.isna(value)) else str(value)
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def schema_to_text(tables: list[TableInfo], only: list[str] | None = None) -> str:
    """Render a compact schema description for the LLM prompt.

    Example line: `Table Invoice(InvoiceId INTEGER PK, CustomerId INTEGER, Total NUMERIC(10, 2))`
    """
    wanted = {t.lower() for t in only} if only else None
    blocks: list[str] = []
    for t in tables:
        if wanted is not None and t.name.lower() not in wanted:
            continue
        cols = ", ".join(f"{c.name} {c.type}{' PK' if c.primary_key else ''}" for c in t.columns)
        lines = [f"Table {t.name}({cols})"]
        if t.foreign_keys:
            lines.append("  Foreign keys: " + "; ".join(t.foreign_keys))
        if not t.sample.empty:
            lines.append("  Sample rows:")
            for row in t.sample.itertuples(index=False):
                lines.append("    " + " | ".join(_fmt_value(v) for v in row))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def table_names(tables: list[TableInfo]) -> list[str]:
    """Return the table names from a schema list."""
    return [t.name for t in tables]


# --------------------------------------------------------------------------- execution


def _sqlite_progress_timeout(dbapi_conn: sqlite3.Connection, seconds: float) -> None:
    """Install a progress handler that aborts SQLite queries after `seconds`."""
    deadline = time.monotonic() + seconds
    dbapi_conn.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10_000)


def run_query(engine: Engine, sql: str, timeout: float = 15.0) -> pd.DataFrame:
    """Execute a (validated) SELECT and return a DataFrame, aborting after `timeout` seconds.

    SQLite uses a progress-handler interrupt; PostgreSQL/MySQL use a server-side
    statement timeout; anything else falls back to a watchdog thread.
    """
    backend = engine.dialect.name
    with engine.connect() as conn:
        raw = conn.connection.dbapi_connection
        if backend == "sqlite" and isinstance(raw, sqlite3.Connection):
            _sqlite_progress_timeout(raw, timeout)
            try:
                return pd.read_sql(text(sql), conn)
            except Exception as exc:
                if "interrupted" in str(exc).lower():
                    raise QueryTimeoutError(f"Query took longer than {timeout:.0f}s and was stopped.") from exc
                raise
            finally:
                raw.set_progress_handler(None, 0)
        if backend == "postgresql":  # pragma: no cover - needs a live server
            conn.execute(text(f"SET statement_timeout = {int(timeout * 1000)}"))
        elif backend == "mysql":  # pragma: no cover - needs a live server
            conn.execute(text(f"SET SESSION MAX_EXECUTION_TIME = {int(timeout * 1000)}"))
        else:  # pragma: no cover
            timer = threading.Timer(timeout, lambda: getattr(raw, "cancel", lambda: None)())
            timer.start()
            try:
                return pd.read_sql(text(sql), conn)
            finally:
                timer.cancel()
        return pd.read_sql(text(sql), conn)
