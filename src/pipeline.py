"""Text-to-SQL pipeline built from LCEL runnables.

    question -> [table selection] -> generate SQL -> guard -> execute
             -> (error -> fix SQL -> guard -> execute, max N times) -> summarize

Every step is a small, separately testable runnable; `QueryPipeline.run` wires
them together and never raises: errors come back on the `PipelineResult`.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Literal

import pandas as pd
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
from sqlalchemy import Engine

from src.database import QueryTimeoutError, TableInfo, run_query, schema_to_text, sql_dialect
from src.llm import is_auth_error
from src.prompts import (
    EXPLAIN_SQL_PROMPT,
    SQL_FIX_PROMPT,
    SQL_GENERATION_PROMPT,
    SUMMARY_PROMPT,
    TABLE_SELECTION_PROMPT,
    format_examples,
)
from src.sql_guard import UnsafeSQLError, extract_sql, validate_sql

logger = logging.getLogger(__name__)

ErrorKind = Literal["blocked", "auth", "llm", "sql", "timeout"]

EMPTY_RESULT_MESSAGE = "No rows matched — try widening the date range or loosening the filters."


@dataclass
class Turn:
    """A previous question and the SQL that answered it (used for follow-ups)."""

    question: str
    sql: str


@dataclass
class PipelineResult:
    """Everything the UI needs to render one answer."""

    question: str
    sql: str = ""
    data: pd.DataFrame = field(default_factory=pd.DataFrame)
    summary: str = ""
    error: str = ""
    error_kind: ErrorKind | None = None
    auto_fixed: bool = False
    attempts: list[dict[str, str]] = field(default_factory=list)
    tables_used: list[str] = field(default_factory=list)
    limit_added: bool = False
    elapsed_ms: float = 0.0

    @property
    def ok(self) -> bool:
        """True when the query ran successfully (it may still have zero rows)."""
        return self.error_kind is None

    @property
    def row_count(self) -> int:
        """Number of rows returned."""
        return len(self.data)


def format_history(history: list[Turn] | None, max_turns: int = 3) -> str:
    """Render the last `max_turns` Q&A pairs as context for follow-up questions."""
    if not history or max_turns <= 0:
        return ""
    parts = [f"Previous question: {t.question}\nPrevious SQL:\n{t.sql}" for t in history[-max_turns:]]
    return "Conversation so far:\n" + "\n\n".join(parts) + "\n\n"


def parse_table_list(text: str, known: list[str]) -> list[str]:
    """Map the LLM's comma-separated table list onto real table names (case-insensitive)."""
    lookup = {name.lower(): name for name in known}
    tokens = re.split(r"[,\n]+", extract_sql(text) if "```" in text else text)
    picked: list[str] = []
    for tok in tokens:
        name = tok.strip().strip("`\"'[]*-• ").lower()
        if name in lookup and lookup[name] not in picked:
            picked.append(lookup[name])
    return picked


def rows_for_prompt(df: pd.DataFrame, n: int = 20) -> str:
    """Render the first `n` rows of a DataFrame as compact text for the LLM."""
    if df.empty:
        return "(no rows)"
    return df.head(n).to_string(index=False, max_colwidth=40)


class QueryPipeline:
    """Question -> SQL -> rows -> summary, using a LangChain chat model and a SQLAlchemy engine."""

    def __init__(
        self,
        llm: BaseChatModel,
        engine: Engine,
        schema: list[TableInfo],
        *,
        max_rows: int = 500,
        timeout: float = 15.0,
        max_fix_retries: int = 2,
        table_selection_threshold: int = 8,
        summary_rows: int = 20,
        history_turns: int = 3,
    ) -> None:
        self.llm = llm
        self.engine = engine
        self.schema = schema
        self.dialect = sql_dialect(engine)
        self.max_rows = max_rows
        self.timeout = timeout
        self.max_fix_retries = max_fix_retries
        self.table_selection_threshold = table_selection_threshold
        self.summary_rows = summary_rows
        self.history_turns = history_turns

        to_text = StrOutputParser()
        known = [t.name for t in schema]
        self.table_selector: Runnable = (
            TABLE_SELECTION_PROMPT | llm | to_text | RunnableLambda(lambda s: parse_table_list(s, known))
        )
        self.sql_generator: Runnable = SQL_GENERATION_PROMPT | llm | to_text | RunnableLambda(extract_sql)
        self.sql_fixer: Runnable = SQL_FIX_PROMPT | llm | to_text | RunnableLambda(extract_sql)
        self.summarizer: Runnable = SUMMARY_PROMPT | llm | to_text
        self.explainer: Runnable = EXPLAIN_SQL_PROMPT | llm | to_text

    # ------------------------------------------------------------------ steps

    def select_tables(self, question: str, history: str = "") -> list[str]:
        """Pick relevant tables when the schema is large; otherwise use every table."""
        all_tables = [t.name for t in self.schema]
        if len(all_tables) <= self.table_selection_threshold:
            return all_tables
        picked = self.table_selector.invoke(
            {"table_list": "\n".join(f"- {n}" for n in all_tables), "question": question, "history": history}
        )
        logger.info("Table selection picked: %s", picked)
        return picked or all_tables

    def generate_sql(self, question: str, tables: list[str], history: str = "") -> str:
        """Ask the LLM for a SQL query answering `question`."""
        return self.sql_generator.invoke(
            {
                "dialect": self.dialect,
                "max_rows": self.max_rows,
                "schema": schema_to_text(self.schema, only=tables),
                "examples": format_examples(),
                "history": history,
                "question": question,
            }
        )

    def fix_sql(self, question: str, sql: str, error: str, tables: list[str]) -> str:
        """Send a failing query plus its error back to the LLM for correction."""
        return self.sql_fixer.invoke(
            {
                "dialect": self.dialect,
                "schema": schema_to_text(self.schema, only=tables),
                "question": question,
                "sql": sql,
                "error": error[:1500],
            }
        )

    def summarize(self, question: str, df: pd.DataFrame) -> str:
        """Produce a 2-3 sentence plain-English answer from the result rows."""
        if df.empty:
            return EMPTY_RESULT_MESSAGE
        return self.summarizer.invoke(
            {"question": question, "row_count": len(df), "rows": rows_for_prompt(df, self.summary_rows)}
        ).strip()

    def explain(self, question: str, sql: str) -> str:
        """Explain a SQL query line by line in simple English."""
        return self.explainer.invoke({"question": question, "sql": sql}).strip()

    # ------------------------------------------------------------------ orchestration

    def run(self, question: str, history: list[Turn] | None = None) -> PipelineResult:
        """Run the full pipeline. Never raises; failures are reported on the result."""
        start = time.perf_counter()
        result = PipelineResult(question=question)
        hist = format_history(history, self.history_turns)
        try:
            result.tables_used = self.select_tables(question, hist)
            candidate = self.generate_sql(question, result.tables_used, hist)
            self._execute_with_fixes(result, candidate)
            if result.ok:
                try:
                    result.summary = self.summarize(question, result.data)
                except Exception as exc:  # summary is a nice-to-have
                    logger.warning("Summary failed: %s", exc)
                    result.summary = f"Found {result.row_count} row(s)."
        except Exception as exc:
            logger.exception("Pipeline failed")
            if is_auth_error(exc):
                result.error_kind = "auth"
                result.error = "The API key was rejected. Check the key in the settings panel (or the server .env) and try again."
            else:
                result.error_kind = "llm"
                result.error = f"The language model request failed: {exc}"
        result.elapsed_ms = (time.perf_counter() - start) * 1000
        return result

    def _execute_with_fixes(self, result: PipelineResult, candidate: str) -> None:
        """Guard + execute `candidate`, asking the LLM to fix it up to `max_fix_retries` times."""
        for attempt in range(self.max_fix_retries + 1):
            try:
                guarded = validate_sql(candidate, dialect=self.dialect, max_rows=self.max_rows)
                result.sql, result.limit_added = guarded.sql, guarded.limit_added
                result.data = run_query(self.engine, guarded.sql, timeout=self.timeout)
                result.auto_fixed = attempt > 0
                result.error, result.error_kind = "", None
                return
            except UnsafeSQLError as exc:
                result.sql = candidate
                result.error, result.error_kind = str(exc), "blocked" if not exc.retryable else "sql"
                result.attempts.append({"sql": candidate, "error": str(exc)})
                if not exc.retryable:
                    return  # never "fix" a query that was blocked for safety
            except QueryTimeoutError as exc:
                result.error, result.error_kind = str(exc), "timeout"
                result.attempts.append({"sql": result.sql, "error": str(exc)})
                return
            except Exception as exc:  # database error: let the LLM try to fix it
                message = str(getattr(exc, "orig", None) or exc)
                logger.info("Attempt %d failed: %s", attempt + 1, message)
                result.error, result.error_kind = f"The query failed: {message}", "sql"
                result.attempts.append({"sql": result.sql, "error": message})

            if attempt < self.max_fix_retries:
                candidate = self.fix_sql(result.question, result.attempts[-1]["sql"], result.attempts[-1]["error"], result.tables_used)
