"""Euro area excess liquidity from the ECB Data Portal."""

from __future__ import annotations

import io
import urllib.request
from datetime import datetime
from threading import Lock

import pandas as pd

from .config import (
    ECB_EXLIQ_FIRST_DAY, ECB_LIQ_COLUMNS, ECB_LIQ_START, ECB_LIQ_URL, ECB_PUBLISH_WINDOW, HEATMAP_FIRST_YEAR, LONDON,
)
from .market import clean

_cache: dict[str, pd.DataFrame] = {}
_lock = Lock()


def cache_slot(now: datetime | None = None) -> str:
    """Changes every minute in the ~10:33 London publication window, otherwise every 15 minutes."""
    now = now or datetime.now(LONDON)
    (start_h, start_m), (end_h, end_m) = ECB_PUBLISH_WINDOW
    in_window = now.weekday() < 5 and (start_h, start_m) <= (now.hour, now.minute) < (end_h, end_m)
    minute = now.minute if in_window else now.minute - now.minute % 15
    return now.replace(minute=minute, second=0, microsecond=0).isoformat()


def liquidity_frame() -> pd.DataFrame:
    """Daily ECB liquidity components in EUR mn (weekends included as the ECB carries them)."""
    slot = cache_slot()
    with _lock:
        if slot not in _cache:
            frame = _download()
            _cache.clear()
            _cache[slot] = frame
        return _cache[slot]


def _download() -> pd.DataFrame:
    with urllib.request.urlopen(ECB_LIQ_URL.format(start=ECB_LIQ_START), timeout=60) as response:
        raw = pd.read_csv(io.BytesIO(response.read()), usecols=["BS_ITEM", "TIME_PERIOD", "OBS_VALUE"])
    wide = raw.pivot(index="TIME_PERIOD", columns="BS_ITEM", values="OBS_VALUE")
    wide.index = pd.DatetimeIndex(pd.to_datetime(wide.index), name="date")
    wide = wide.sort_index().reindex(columns=list(ECB_LIQ_COLUMNS))
    # Before EXLIQ was published, rebuild it from its components.
    first_mrr = wide["MRR"].dropna().iloc[0] if wide["MRR"].notna().any() else 0
    rebuilt = wide["L020100"] + wide["L020200"] - wide["A050500"].fillna(0) - wide["MRR"].fillna(first_mrr)
    wide["EXLIQ"] = wide["EXLIQ"].fillna(rebuilt)
    return wide.rename(columns=ECB_LIQ_COLUMNS)


def liquidity_payload() -> dict:
    """Heatmap and daily table in EUR bn, weekdays only."""
    frame = liquidity_frame()
    weekdays = frame[frame.index.dayofweek < 5] / 1000
    excess = weekdays["excess_liquidity"].dropna()

    month_end = excess.groupby(excess.index.to_period("M")).last()
    change = month_end.diff().dropna()
    change = change[change.index.year >= HEATMAP_FIRST_YEAR]
    current = pd.Timestamp(datetime.now(LONDON).date()).to_period("M")
    years = sorted({p.year for p in change.index})
    values = [[None] * 12 for _ in years]
    partial = [[False] * 12 for _ in years]
    for period, value in change.items():
        row = years.index(period.year)
        values[row][period.month - 1] = clean(value, 1)
        partial[row][period.month - 1] = period == current

    table = weekdays.loc[weekdays.index >= pd.Timestamp(ECB_EXLIQ_FIRST_DAY)].copy()
    table["daily_change"] = table["excess_liquidity"].diff()
    daily = [
        {"date": f"{index:%Y-%m-%d}", **{column: clean(row[column], 1) for column in table.columns}}
        for index, row in table.sort_index(ascending=False).iterrows()
    ]
    latest_change = clean(excess.iloc[-1] - excess.iloc[-2], 1) if len(excess) > 1 else None
    return {
        "unit": "EUR bn",
        "asOf": f"{excess.index[-1]:%Y-%m-%d}" if not excess.empty else None,
        "latest": {"value": clean(excess.iloc[-1], 1) if not excess.empty else None, "change": latest_change},
        "heatmap": {"years": years, "values": values, "partial": partial},
        "daily": daily,
        "rebuiltBefore": ECB_EXLIQ_FIRST_DAY,
        "publishWindowLondon": [f"{h:02d}:{m:02d}" for h, m in ECB_PUBLISH_WINDOW],
    }


def liquidity_csv() -> str:
    return (liquidity_frame() / 1000).to_csv(float_format="%.1f")
