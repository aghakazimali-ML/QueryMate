"""Tests for the sqlglot-based SQL safety layer."""

from __future__ import annotations

import pytest

from src.sql_guard import UnsafeSQLError, extract_sql, validate_sql


def test_allows_simple_select() -> None:
    result = validate_sql("SELECT name FROM customers")
    assert result.sql.upper().startswith("SELECT")


def test_allows_cte() -> None:
    result = validate_sql("WITH big AS (SELECT * FROM orders WHERE amount > 50) SELECT COUNT(*) FROM big")
    assert result.sql.upper().startswith("WITH")


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM customers",
        "DROP TABLE customers",
        "UPDATE customers SET name = 'x'",
        "INSERT INTO customers VALUES (9, 'x', 'y')",
        "ALTER TABLE customers ADD COLUMN x TEXT",
        "CREATE TABLE t (id INT)",
        "TRUNCATE TABLE customers",
        "ATTACH DATABASE 'other.db' AS other",
        "PRAGMA table_info(customers)",
    ],
)
def test_blocks_write_and_admin_statements(sql: str) -> None:
    with pytest.raises(UnsafeSQLError) as err:
        validate_sql(sql)
    assert err.value.retryable is False


def test_blocks_multiple_statements() -> None:
    with pytest.raises(UnsafeSQLError, match="single"):
        validate_sql("SELECT * FROM customers; SELECT * FROM orders")


def test_blocks_select_followed_by_drop() -> None:
    with pytest.raises(UnsafeSQLError):
        validate_sql("SELECT * FROM customers; DROP TABLE customers")


def test_adds_limit_when_missing() -> None:
    result = validate_sql("SELECT * FROM customers", max_rows=500)
    assert result.limit_added is True
    assert "LIMIT 500" in result.sql


def test_keeps_existing_limit() -> None:
    result = validate_sql("SELECT * FROM customers LIMIT 5", max_rows=500)
    assert result.limit_added is False
    assert "LIMIT 5" in result.sql
    assert "LIMIT 500" not in result.sql


def test_keyword_inside_string_literal_is_allowed() -> None:
    result = validate_sql("SELECT * FROM customers WHERE name = 'drop table'")
    assert "drop table" in result.sql


def test_extract_sql_strips_code_fences() -> None:
    raw = "Here you go:\n```sql\nSELECT 1;\n```\nHope that helps!"
    assert extract_sql(raw) == "SELECT 1"


def test_extract_sql_strips_prefix() -> None:
    assert extract_sql("SQL: SELECT * FROM t") == "SELECT * FROM t"


def test_unparseable_sql_is_retryable() -> None:
    with pytest.raises(UnsafeSQLError) as err:
        validate_sql("SELECT FROM WHERE (")
    assert err.value.retryable is True
