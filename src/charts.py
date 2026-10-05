"""Rule-based chart picker (no LLM): choose a chart for a result DataFrame and shape its data for the UI."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

import pandas as pd

ChartKind = Literal["metric", "line", "bar", "scatter", "table"]

_DATE_VALUE_RE = re.compile(r"^\d{4}(-\d{1,2}(-\d{1,2})?)?([ T]\d{1,2}:\d{2}(:\d{2})?)?$")
BAR_TOP_N = 15


@dataclass
class ChartSpec:
    """Which chart to draw and with which columns."""

    kind: ChartKind
    x: str | None = None
    y: list[str] = field(default_factory=list)
    value: object = None
    label: str = ""


def _is_date_column(s: pd.Series) -> bool:
    """True for datetime columns, or text columns that look like dates / periods (e.g. '2013-04')."""
    if pd.api.types.is_datetime64_any_dtype(s):
        return True
    if pd.api.types.is_numeric_dtype(s):
        # Integer years like 2009..2013 in a column named "year".
        values = s.dropna()
        return str(s.name).lower() in {"year", "yr"} and len(values) > 0 and bool(values.between(1900, 2100).all())
    if pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s):
        sample = s.dropna().astype(str).head(20)
        return len(sample) > 0 and sample.str.match(_DATE_VALUE_RE).all()
    return False


def classify_columns(df: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    """Split columns into (date, numeric, category) lists."""
    dates, nums, cats = [], [], []
    for col in df.columns:
        s = df[col]
        if _is_date_column(s):
            dates.append(col)
        elif pd.api.types.is_bool_dtype(s):
            cats.append(col)
        elif pd.api.types.is_numeric_dtype(s):
            nums.append(col)
        else:
            cats.append(col)
    return dates, nums, cats


def pick_chart(df: pd.DataFrame) -> ChartSpec:
    """Choose a chart type from the shape of `df`.

    Rules:
        * single value (or one row with one number) -> metric
        * 1 date + number(s)        -> line
        * 1 category + 1 number     -> bar (sorted desc, top 15)
        * 2 numbers                 -> scatter
        * anything else             -> table only
    """
    if df is None or df.empty or len(df.columns) == 0:
        return ChartSpec("table")
    if df.shape == (1, 1):
        return ChartSpec("metric", y=[df.columns[0]], value=df.iat[0, 0], label=_pretty(df.columns[0]))

    dates, nums, cats = classify_columns(df)
    if len(df) == 1 and len(nums) == 1 and len(df.columns) <= 3:
        # e.g. "best sales agent" -> one row: agent name + revenue.
        context = " · ".join(str(df.iat[0, df.columns.get_loc(c)]) for c in df.columns if c != nums[0])
        label = _pretty(nums[0]) + (f" — {context}" if context else "")
        return ChartSpec("metric", y=[nums[0]], value=df.iat[0, df.columns.get_loc(nums[0])], label=label)
    if len(dates) == 1 and nums and not cats and len(df) > 1:
        return ChartSpec("line", x=dates[0], y=nums)
    if len(cats) == 1 and len(nums) == 1 and not dates and len(df) > 1:
        return ChartSpec("bar", x=cats[0], y=nums)
    if len(nums) == 2 and not cats and not dates and len(df) > 1:
        return ChartSpec("scatter", x=nums[0], y=[nums[1]])
    return ChartSpec("table")


def _pretty(label: str) -> str:
    """'total_revenue' -> 'Total revenue'."""
    return str(label).replace("_", " ").strip().capitalize()


def chart_data(df: pd.DataFrame, spec: ChartSpec) -> list[dict]:
    """Return the rows the frontend should plot for `spec` (sorted / capped as the chart needs)."""
    if spec.kind in ("metric", "table") or spec.x is None:
        return []
    cols = [spec.x, *spec.y]
    if spec.kind == "line":
        data = df[cols].sort_values(spec.x)
        if pd.api.types.is_datetime64_any_dtype(data[spec.x]):
            data[spec.x] = data[spec.x].dt.strftime("%Y-%m-%d")
    elif spec.kind == "bar":
        data = df[cols].sort_values(spec.y[0], ascending=False).head(BAR_TOP_N)
    else:  # scatter
        data = df[cols]
    return to_records(data)


def to_records(df: pd.DataFrame) -> list[dict]:
    """JSON-safe list of row dicts (NaN -> None, timestamps -> ISO strings, numpy -> Python)."""
    clean = df.copy()
    for col in clean.columns:
        if pd.api.types.is_datetime64_any_dtype(clean[col]):
            clean[col] = clean[col].dt.strftime("%Y-%m-%dT%H:%M:%S")
    clean = clean.astype(object).where(pd.notna(clean), None)
    return [{str(k): _py(v) for k, v in row.items()} for row in clean.to_dict(orient="records")]


def _py(value: object) -> object:
    """Convert numpy scalars / bytes to plain JSON-friendly Python values."""
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        try:
            return value.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(value, bytes):
        return f"<{len(value)} bytes>"
    return value


def chart_payload(df: pd.DataFrame) -> dict:
    """Everything the frontend needs to draw the chart: kind, axes, labels and data."""
    spec = pick_chart(df)
    return {
        "kind": spec.kind,
        "x": spec.x,
        "y": spec.y,
        "labels": {str(c): _pretty(c) for c in df.columns},
        "value": _py(spec.value),
        "label": spec.label,
        "data": chart_data(df, spec),
    }
