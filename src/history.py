"""Query history: one record per question, exportable as CSV."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime

import pandas as pd

from src.pipeline import PipelineResult


@dataclass
class HistoryEntry:
    """One row of the Query history tab."""

    timestamp: str
    question: str
    sql: str
    status: str
    rows: int
    time_ms: float
    auto_fixed: bool = False
    error: str = ""

    @classmethod
    def from_result(cls, result: PipelineResult) -> "HistoryEntry":
        """Build a history row from a pipeline result."""
        return cls(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            question=result.question,
            sql=result.sql,
            status="✅" if result.ok else "❌",
            rows=result.row_count if result.ok else 0,
            time_ms=round(result.elapsed_ms, 1),
            auto_fixed=result.auto_fixed,
            error=result.error,
        )


@dataclass
class QueryHistory:
    """An append-only list of HistoryEntry records."""

    entries: list[HistoryEntry] = field(default_factory=list)

    def add(self, result: PipelineResult) -> HistoryEntry:
        """Record a pipeline result and return the new entry."""
        entry = HistoryEntry.from_result(result)
        self.entries.append(entry)
        return entry

    def clear(self) -> None:
        """Remove all entries."""
        self.entries.clear()

    def __len__(self) -> int:
        return len(self.entries)

    def to_dataframe(self) -> pd.DataFrame:
        """Return the history as a DataFrame (newest first)."""
        columns = list(HistoryEntry.__dataclass_fields__)
        if not self.entries:
            return pd.DataFrame(columns=columns)
        return pd.DataFrame([asdict(e) for e in reversed(self.entries)], columns=columns)

    def to_csv(self) -> bytes:
        """Return the history as UTF-8 CSV bytes for `st.download_button`."""
        return self.to_dataframe().to_csv(index=False).encode("utf-8")
