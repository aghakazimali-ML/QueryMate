"""Tests for uploads, schema extraction, read-only access and execution."""

from __future__ import annotations

import io
import sqlite3

import pandas as pd
import pytest
from sqlalchemy import inspect, text

from src.database import (
    FileLoadError,
    clean_columns,
    create_sqlite_readonly_engine,
    get_schema,
    load_files_to_sqlite,
    run_query,
    schema_to_text,
)


def test_csv_upload_creates_table_with_clean_columns() -> None:
    csv = b"Order ID,Customer Name,Total Amount ($),orderDate\n1,Ana,10.5,2024-01-01\n2,Ben,20,2024-01-02\n"
    engine, tables = load_files_to_sqlite([("Sales Report 2024.csv", csv)])
    assert tables == ["sales_report_2024"]
    cols = [c["name"] for c in inspect(engine).get_columns("sales_report_2024")]
    assert cols == ["order_id", "customer_name", "total_amount", "order_date"]
    df = run_query(engine, "SELECT SUM(total_amount) AS s FROM sales_report_2024")
    assert df.iat[0, 0] == pytest.approx(30.5)


def test_excel_upload_creates_table_per_sheet() -> None:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        pd.DataFrame({"A": [1]}).to_excel(writer, sheet_name="North", index=False)
        pd.DataFrame({"A": [2]}).to_excel(writer, sheet_name="South", index=False)
    _, tables = load_files_to_sqlite([("regions.xlsx", buf.getvalue())])
    assert sorted(tables) == ["regions_north", "regions_south"]


def test_bad_upload_raises_friendly_error() -> None:
    with pytest.raises(FileLoadError):
        load_files_to_sqlite([("notes.txt", b"hello")])
    with pytest.raises(FileLoadError):
        load_files_to_sqlite([("broken.xlsx", b"not really excel")])


def test_clean_columns_dedupes() -> None:
    assert clean_columns(["Amount", "amount", "", "2nd value"]) == ["amount", "amount_2", "col_3", "col_4_2nd_value"]


def test_schema_text_contains_all_tables_and_columns(engine) -> None:
    schema = get_schema(engine, sample_rows=3)
    rendered = schema_to_text(schema)
    for name in ("customers", "orders"):
        assert f"Table {name}(" in rendered
    for col in ("id", "name", "country", "customer_id", "amount", "order_date"):
        assert col in rendered
    assert "orders.customer_id -> customers.id" in rendered
    assert "Sample rows" in rendered
    assert all(len(t.sample) <= 3 for t in schema)


def test_schema_text_can_filter_tables(engine) -> None:
    rendered = schema_to_text(get_schema(engine), only=["orders"])
    assert "Table orders(" in rendered and "Table customers(" not in rendered


def test_readonly_engine_rejects_writes(tmp_path) -> None:
    path = tmp_path / "demo.sqlite"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE t (id INTEGER)")
        conn.execute("INSERT INTO t VALUES (1)")
    engine = create_sqlite_readonly_engine(path)
    assert run_query(engine, "SELECT COUNT(*) AS n FROM t").iat[0, 0] == 1
    with pytest.raises(Exception, match="readonly"):
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO t VALUES (2)"))
