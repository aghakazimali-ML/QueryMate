"""In-memory session state: per-browser data sources (uploads, connections) and query history."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy import Engine

from src.database import TableInfo
from src.history import QueryHistory

logger = logging.getLogger(__name__)

CHINOOK_ID = "chinook"


@dataclass
class DataSource:
    """An engine plus its cached schema."""

    source_id: str
    kind: str
    label: str
    engine: Engine
    schema: list[TableInfo]


@dataclass
class Session:
    """Everything one browser session owns."""

    sources: dict[str, DataSource] = field(default_factory=dict)
    history: QueryHistory = field(default_factory=QueryHistory)
    last_seen: float = field(default_factory=time.monotonic)


class SessionStore:
    """Thread-safe map of session id -> Session, with idle expiry."""

    def __init__(self, ttl_seconds: float) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def get(self, session_id: str) -> Session:
        """Return (creating if needed) the session and expire idle ones."""
        now = time.monotonic()
        with self._lock:
            for sid in [s for s, sess in self._sessions.items() if now - sess.last_seen > self._ttl]:
                for src in self._sessions[sid].sources.values():
                    src.engine.dispose()
                del self._sessions[sid]
                logger.info("Expired session %s", sid[:8])
            session = self._sessions.setdefault(session_id, Session())
            session.last_seen = now
            return session

    @staticmethod
    def add_source(session: Session, kind: str, label: str, engine: Engine, schema: list[TableInfo]) -> DataSource:
        """Register a new data source on the session (keeps at most 5 per session)."""
        source = DataSource(f"{kind}-{uuid.uuid4().hex[:10]}", kind, label, engine, schema)
        session.sources[source.source_id] = source
        while len(session.sources) > 5:
            oldest = next(iter(session.sources))
            session.sources.pop(oldest).engine.dispose()
        return source
