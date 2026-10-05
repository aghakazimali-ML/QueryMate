"""End-to-end pipeline tests with a fake LLM (no network, no API key)."""

from __future__ import annotations

from langchain_core.language_models.fake_chat_models import FakeListChatModel
from sqlalchemy import inspect

from src.history import QueryHistory
from src.pipeline import EMPTY_RESULT_MESSAGE, QueryPipeline, Turn, format_history, parse_table_list


def make_pipeline(engine, schema, responses: list[str], **kwargs) -> QueryPipeline:
    return QueryPipeline(FakeListChatModel(responses=responses), engine, schema, **kwargs)


def test_valid_sql_returns_rows(engine, schema) -> None:
    sql = "```sql\nSELECT country, SUM(o.amount) AS revenue FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY country ORDER BY revenue DESC\n```"
    pipe = make_pipeline(engine, schema, [sql, "France leads with 200.00 in revenue."])
    result = pipe.run("Revenue by country?")
    assert result.ok, result.error
    assert result.row_count == 3
    assert list(result.data.columns) == ["country", "revenue"]
    assert result.data.iloc[0]["country"] == "France"
    assert result.summary.startswith("France")
    assert result.auto_fixed is False
    assert result.limit_added is True


def test_self_correction_fixes_bad_sql(engine, schema) -> None:
    bad = "SELECT nme FROM customers"
    fixed = "SELECT name FROM customers ORDER BY name"
    pipe = make_pipeline(engine, schema, [bad, fixed, "There are 4 customers."])
    result = pipe.run("List customer names")
    assert result.ok, result.error
    assert result.auto_fixed is True
    assert result.row_count == 4
    assert len(result.attempts) == 1
    assert "nme" in result.attempts[0]["error"]


def test_self_correction_gives_up_after_max_retries(engine, schema) -> None:
    pipe = make_pipeline(engine, schema, ["SELECT x FROM nope"] * 3, max_fix_retries=2)
    result = pipe.run("Something impossible")
    assert not result.ok
    assert result.error_kind == "sql"
    assert len(result.attempts) == 3


def test_drop_table_is_blocked(engine, schema) -> None:
    pipe = make_pipeline(engine, schema, ["DROP TABLE customers", "should never be used"])
    result = pipe.run("Delete all customers")
    assert not result.ok
    assert result.error_kind == "blocked"
    assert "DROP" in result.error
    assert len(result.attempts) == 1  # blocked queries are never sent for "fixing"
    assert "customers" in inspect(engine).get_table_names()


def test_empty_result_has_friendly_message(engine, schema) -> None:
    pipe = make_pipeline(engine, schema, ["SELECT * FROM orders WHERE amount > 1000000"])
    result = pipe.run("Huge orders?")
    assert result.ok
    assert result.row_count == 0
    assert result.summary == EMPTY_RESULT_MESSAGE


def test_table_selection_used_for_large_schemas(engine, schema) -> None:
    pipe = make_pipeline(
        engine, schema, ["orders", "SELECT COUNT(*) AS n FROM orders", "There are 5 orders."], table_selection_threshold=1
    )
    result = pipe.run("How many orders?")
    assert result.tables_used == ["orders"]
    assert result.data.iat[0, 0] == 5


def test_follow_up_history_is_formatted() -> None:
    turns = [Turn(f"q{i}", f"SELECT {i}") for i in range(5)]
    text = format_history(turns, max_turns=3)
    assert "q1" not in text and "q2" in text and "q4" in text


def test_parse_table_list_matches_known_names() -> None:
    assert parse_table_list("Invoice, invoiceline, Bogus", ["Invoice", "InvoiceLine", "Track"]) == ["Invoice", "InvoiceLine"]


def test_history_records_results(engine, schema) -> None:
    pipe = make_pipeline(engine, schema, ["SELECT COUNT(*) AS n FROM customers", "4 customers."])
    history = QueryHistory()
    history.add(pipe.run("How many customers?"))
    df = history.to_dataframe()
    assert df.iloc[0]["status"] == "✅" and df.iloc[0]["rows"] == 1
    assert b"How many customers?" in history.to_csv()
