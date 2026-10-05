"""Shared fixtures: a tiny in-memory SQLite database with two related tables."""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

from src.database import create_memory_engine, get_schema


@pytest.fixture()
def engine() -> Engine:
    """In-memory SQLite with `customers` and `orders` (FK orders.customer_id -> customers.id)."""
    eng = create_memory_engine()
    with eng.begin() as conn:
        conn.execute(text("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT)"))
        conn.execute(
            text(
                "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), "
                "amount REAL, order_date TEXT)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO customers VALUES (1, 'Ana', 'Germany'), (2, 'Ben', 'USA'), (3, 'Chloe', 'France'), "
                "(4, 'Dev', 'USA')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO orders VALUES (1, 1, 120.5, '2024-01-15'), (2, 2, 80.0, '2024-02-03'), "
                "(3, 2, 45.25, '2024-02-20'), (4, 3, 200.0, '2024-03-11'), (5, 4, 15.0, '2024-03-30')"
            )
        )
    return eng


@pytest.fixture()
def schema(engine: Engine):
    """Schema of the fixture database."""
    return get_schema(engine, sample_rows=3)
