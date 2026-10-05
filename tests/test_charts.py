"""Tests for the rule-based chart picker."""

from __future__ import annotations

import pandas as pd
import pytest

from src.charts import chart_data, chart_payload, pick_chart, to_records


@pytest.mark.parametrize(
    ("df", "kind"),
    [
        (pd.DataFrame({"total": [42]}), "metric"),
        (pd.DataFrame({"month": ["2013-01", "2013-02", "2013-03"], "revenue": [10.0, 12.5, 9.0]}), "line"),
        (pd.DataFrame({"invoice_date": pd.to_datetime(["2024-01-01", "2024-01-02"]), "n": [1, 2]}), "line"),
        (pd.DataFrame({"year": [2010, 2011, 2012], "revenue": [400.0, 450.0, 470.0]}), "line"),
        (pd.DataFrame({"country": ["USA", "Canada", "France"], "revenue": [523.1, 303.9, 195.1]}), "bar"),
        (pd.DataFrame({"tracks": [10, 20, 30], "revenue": [1.0, 2.0, 3.0]}), "scatter"),
        (pd.DataFrame({"agent": ["Jane Peacock"], "revenue": [833.04]}), "metric"),
        (pd.DataFrame({"first": ["a", "b"], "last": ["c", "d"], "city": ["x", "y"]}), "table"),
        (pd.DataFrame(), "table"),
    ],
)
def test_pick_chart(df: pd.DataFrame, kind: str) -> None:
    assert pick_chart(df).kind == kind


def test_bar_chart_data_is_sorted_and_capped_at_15() -> None:
    df = pd.DataFrame({"genre": [f"g{i}" for i in range(30)], "sales": list(range(30))})
    data = chart_data(df, pick_chart(df))
    assert len(data) == 15
    assert data[0] == {"genre": "g29", "sales": 29}


def test_line_chart_data_is_sorted_by_date() -> None:
    df = pd.DataFrame({"month": ["2013-03", "2013-01", "2013-02"], "revenue": [3.0, 1.0, 2.0]})
    assert [r["month"] for r in chart_data(df, pick_chart(df))] == ["2013-01", "2013-02", "2013-03"]


def test_metric_and_table_have_no_chart_data() -> None:
    df = pd.DataFrame({"n": [1]})
    assert chart_data(df, pick_chart(df)) == []


def test_chart_payload_is_json_safe() -> None:
    df = pd.DataFrame({"country": ["USA", "Canada"], "revenue": [523.06, float("nan")]})
    payload = chart_payload(df)
    assert payload["kind"] == "bar"
    assert payload["labels"]["revenue"] == "Revenue"
    assert payload["data"][1]["revenue"] is None
    assert type(payload["data"][0]["revenue"]) is float


def test_to_records_converts_timestamps() -> None:
    df = pd.DataFrame({"d": pd.to_datetime(["2024-01-02"]), "n": [1]})
    assert to_records(df) == [{"d": "2024-01-02T00:00:00", "n": 1}]


def test_metric_label_includes_context() -> None:
    spec = pick_chart(pd.DataFrame({"agent": ["Jane Peacock"], "revenue": [833.04]}))
    assert spec.label == "Revenue — Jane Peacock"
    assert spec.value == 833.04
