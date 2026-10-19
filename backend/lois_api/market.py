"""LSEG market data: snapshot, daily history, LOIS and LOIS at the EURIBOR fix."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta

import pandas as pd

from .cache import ttl_cache
from .config import (
    BY_KEY, EURIBOR_RICS, FIX_HOUR_LONDON, FIX_TTL, HISTORY_START, HISTORY_TTL, INSTRUMENTS, LIVE_FIELDS, LONDON,
    OIS_RICS, PRICE_COLUMNS, SNAPSHOT_TTL, TENORS, Instrument,
)
from .lseg_client import client


def clean(value: object, digits: int = 6) -> float | None:
    """JSON-safe float: None for missing or non-finite values."""
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return round(number, digits) if math.isfinite(number) else None


def to_points(series: pd.Series, digits: int = 6) -> list[dict]:
    return [
        {"time": f"{index:%Y-%m-%d}", "value": clean(value, digits)}
        for index, value in series.dropna().items()
        if clean(value, digits) is not None
    ]


# ── Daily history ─────────────────────────────────────────────────────────────

@ttl_cache(HISTORY_TTL)
def raw_history(ric: str) -> pd.DataFrame:
    """Full daily history for a RIC since HISTORY_START, all fields LSEG returns, indexed by date."""
    df = client.get_history(universe=ric, start=HISTORY_START, end=date.today().isoformat(), interval="daily")
    if df is None or df.empty:
        return pd.DataFrame()
    df = df.copy()
    df.index = pd.DatetimeIndex(pd.to_datetime(df.index)).tz_localize(None).normalize()
    df = df[~df.index.duplicated(keep="last")].sort_index()
    return df.apply(pd.to_numeric, errors="coerce")


def line_history(inst: Instrument) -> pd.Series:
    df = raw_history(inst.ric)
    if df.empty:
        return pd.Series(dtype=float)
    column = inst.history_field if inst.history_field in df.columns else None
    column = column or next((c for c in PRICE_COLUMNS if c in df.columns), None)
    if column is None:
        numeric = df.select_dtypes("number")
        if numeric.empty:
            return pd.Series(dtype=float)
        column = numeric.columns[0]
    return df[column].dropna()


def since(series_or_frame, days: int):
    """Slice to the last `days` calendar days; 0 means everything."""
    if days <= 0 or series_or_frame.empty:
        return series_or_frame
    return series_or_frame.loc[series_or_frame.index >= pd.Timestamp(date.today() - timedelta(days=days))]


# ── Live points on the history charts ────────────────────────────────────────

def live_tick(inst: Instrument) -> tuple[pd.Timestamp, float, dict] | None:
    """(trading day, live value, raw quote) for a weekday quote, or None. Never raises: history still renders."""
    try:
        quote = live_quotes().get(inst.ric)
    except Exception:
        return None
    if not quote:
        return None
    value, day = live_value(inst, quote), quote.get("CF_DATE")
    if value is None or day is None or pd.isna(day) or day.dayofweek >= 5:
        return None
    return day, value, quote


def with_live(series: pd.Series, inst: Instrument) -> pd.Series:
    """Daily closes with the live value as the latest day's point (replacing that day if it is already there)."""
    tick = live_tick(inst)
    if tick is None or (not series.empty and tick[0] < series.index[-1]):
        return series
    series = series.copy()
    series.loc[tick[0]] = tick[1]
    return series.sort_index()


def series_payload(key: str, days: int) -> dict:
    inst = BY_KEY[key]
    return {**instrument_meta(inst), "points": to_points(since(with_live(line_history(inst), inst), days))}


def ohlc_payload(key: str, days: int) -> dict:
    inst = BY_KEY[key]
    df = since(raw_history(inst.ric), days)
    bars = []
    if not df.empty:
        close = df.get(inst.history_field or "TRDPRC_1")
        if close is None:
            close = line_history(inst).reindex(df.index)
        elif "TRDPRC_1" in df.columns:
            # A few days have no settlement; use that day's last trade rather than dropping the bar.
            close = close.fillna(df["TRDPRC_1"])
        open_field, high_field, low_field = inst.ohlc_fields
        frame = pd.DataFrame({
            "open": df.get(open_field), "high": df.get(high_field), "low": df.get(low_field), "close": close,
            "volume": df.get("ACVOL_UNS"),
        }, index=df.index).dropna(subset=["close"])
        frame = with_live_bar(frame, inst)
        # Some indices omit open/high/low on some days; fall back to a flat bar at the close.
        for col in ("open", "high", "low"):
            frame[col] = frame[col].fillna(frame["close"])
        frame["high"] = frame[["open", "high", "low", "close"]].max(axis=1)
        frame["low"] = frame[["open", "high", "low", "close"]].min(axis=1)
        for index, row in frame.iterrows():
            bar = {"time": f"{index:%Y-%m-%d}", **{c: clean(row[c]) for c in ("open", "high", "low", "close")}}
            if clean(row["volume"]) is not None:
                bar["volume"] = clean(row["volume"], 0)
            bars.append(bar)
    return {**instrument_meta(inst), "bars": bars}


def with_live_bar(frame: pd.DataFrame, inst: Instrument) -> pd.DataFrame:
    """Build or update the latest day's bar from the live quote: close = live, high/low widened to include it."""
    tick = live_tick(inst)
    if tick is None or (not frame.empty and tick[0] < frame.index[-1]):
        return frame
    day, close, quote = tick
    base = frame.loc[day] if day in frame.index else pd.Series(dtype=float)

    def first(*values: object) -> float | None:
        return next((float(v) for v in values if v is not None and pd.notna(v)), None)

    open_ = first(quote.get("OPEN_PRC"), base.get("open"), close)
    prices = [p for p in (quote.get("HIGH_1"), quote.get("LOW_1"), base.get("high"), base.get("low"), open_, close)
              if p is not None and pd.notna(p)]
    frame = frame.copy()
    frame.loc[day, ["open", "high", "low", "close", "volume"]] = [
        open_, max(prices), min(prices), close, first(quote.get("ACVOL_UNS"), base.get("volume")),
    ]
    return frame.sort_index()


def instrument_meta(inst: Instrument) -> dict:
    return {
        "key": inst.key, "label": inst.label, "ric": inst.ric, "group": inst.group, "unit": inst.unit,
        "decimals": inst.decimals, "kind": inst.kind, "note": inst.note,
    }


# ── LOIS ──────────────────────────────────────────────────────────────────────

def term_lois(tenor: str) -> pd.Series:
    """EURIBOR fixing minus same-tenor €STR OIS mid, daily, in bp."""
    euribor = line_history(BY_KEY[f"euribor_{tenor.lower()}"])
    ois = line_history(BY_KEY[f"ois_{tenor.lower()}"])
    both = pd.concat([euribor.rename("e"), ois.rename("o")], axis=1, join="inner").dropna()
    return (both["e"] - both["o"]) * 100


def with_live_lois(lois: pd.Series, tenor: str) -> pd.Series:
    """Add today's spot LOIS: the latest EURIBOR fixing minus the live OIS mid, dated by the OIS quote."""
    euribor, ois = BY_KEY[f"euribor_{tenor.lower()}"], BY_KEY[f"ois_{tenor.lower()}"]
    ois_tick = live_tick(ois)
    fixing = with_live(line_history(euribor), euribor)
    if ois_tick is None or fixing.empty or (not lois.empty and ois_tick[0] < lois.index[-1]):
        return lois
    lois = lois.copy()
    lois.loc[ois_tick[0]] = (fixing.loc[fixing.index <= ois_tick[0]].iloc[-1] - ois_tick[1]) * 100
    return lois.sort_index()


def lois_history_payload(days: int) -> dict:
    series, stats = {}, []
    for tenor in TENORS:
        lois = since(with_live_lois(term_lois(tenor), tenor), days)
        series[tenor] = to_points(lois, 2)
        if not lois.empty:
            stats.append({
                "tenor": tenor, "latest": clean(lois.iloc[-1], 2), "asOf": f"{lois.index[-1]:%Y-%m-%d}",
                "average": clean(lois.mean(), 2), "min": clean(lois.min(), 2), "max": clean(lois.max(), 2),
                "change1d": clean(lois.iloc[-1] - lois.iloc[-2], 2) if len(lois) > 1 else None,
            })
    return {"unit": "bp", "series": series, "stats": stats}


def rates_history_payload(days: int) -> dict:
    return {
        curve: {
            t: to_points(since(with_live(line_history(BY_KEY[f"{curve}_{t.lower()}"]), BY_KEY[f"{curve}_{t.lower()}"]), days))
            for t in TENORS
        }
        for curve in ("euribor", "ois")
    }


# ── Live snapshot ─────────────────────────────────────────────────────────────

@ttl_cache(SNAPSHOT_TTL)
def live_quotes() -> dict[str, dict]:
    """One batched get_data call for every instrument: {ric: {value, change}}."""
    df = client.get_data([inst.ric for inst in INSTRUMENTS], LIVE_FIELDS)
    quotes: dict[str, dict] = {}
    for _, row in df.iterrows():
        values = {f: pd.to_numeric(row.get(f), errors="coerce") for f in LIVE_FIELDS if f != "CF_DATE"}
        day = pd.to_datetime(row.get("CF_DATE"), errors="coerce")
        values["CF_DATE"] = None if pd.isna(day) else pd.Timestamp(day).tz_localize(None).normalize()
        quotes[str(row["Instrument"])] = values
    return quotes


def live_value(inst: Instrument, quote: dict) -> float | None:
    if inst.live == "mid" and pd.notna(quote.get("BID")) and pd.notna(quote.get("ASK")):
        return clean((quote["BID"] + quote["ASK"]) / 2)
    last = quote.get("CF_LAST")
    return clean(last if pd.notna(last) else quote.get("PRIMACT_1"))


def live_point(inst: Instrument) -> dict:
    """Where the live value sits on the daily charts: its trading date, plus today's bar for OHLC instruments."""
    tick = live_tick(inst)
    if tick is None:
        return {"liveDate": None}
    day, value, quote = tick
    point: dict = {"liveDate": f"{day:%Y-%m-%d}"}
    if inst.kind == "ohlc":
        point["bar"] = {
            "open": clean(quote.get("OPEN_PRC")), "high": clean(quote.get("HIGH_1")), "low": clean(quote.get("LOW_1")),
            "close": value, "volume": clean(quote.get("ACVOL_UNS"), 0),
        }
    return point


def snapshot_payload() -> dict:
    quotes = live_quotes()
    groups: dict[str, list] = {}
    values: dict[str, float | None] = {}
    for inst in INSTRUMENTS:
        quote = quotes.get(inst.ric, {})
        value = live_value(inst, quote)
        values[inst.key] = value
        change = clean(quote.get("NETCHNG_1"))
        if change is None and value is not None and inst.live == "mid":
            # OIS has no NETCHNG_1; measure against the previous daily close instead.
            history = line_history(inst)
            prior = history.loc[history.index < pd.Timestamp(date.today())]
            change = clean(value - prior.iloc[-1]) if not prior.empty else None
        groups.setdefault(inst.group, []).append(
            {**instrument_meta(inst), "value": value, "change": change, **live_point(inst)}
        )

    # Spot LOIS: latest EURIBOR fixing minus live OIS mid; change against the previous day's close LOIS.
    lois_tiles = []
    for tenor in TENORS:
        fixing, ois = values.get(f"euribor_{tenor.lower()}"), values.get(f"ois_{tenor.lower()}")
        spot = clean((fixing - ois) * 100, 2) if fixing is not None and ois is not None else None
        history = term_lois(tenor)
        prior = history.loc[history.index < pd.Timestamp(date.today())]
        lois_tiles.append({
            "key": f"lois_{tenor.lower()}", "label": f"LOIS {tenor}", "group": "SPOT LOIS", "unit": "bp",
            "decimals": 1, "kind": "derived", "ric": None, "note": "EURIBOR fixing − €STR OIS mid",
            "value": spot, "change": clean(spot - prior.iloc[-1], 2) if spot is not None and not prior.empty else None,
            # Dated by the OIS quote, like the LOIS chart's live point.
            "liveDate": live_point(BY_KEY[f"ois_{tenor.lower()}"])["liveDate"] if spot is not None else None,
        })
    ordered = {"SPOT LOIS": lois_tiles, **groups}
    return {
        "asOf": datetime.now(tz=LONDON).isoformat(timespec="seconds"),
        "groups": [{"title": title, "tiles": tiles} for title, tiles in ordered.items()],
    }


# ── LOIS at the EURIBOR fix ───────────────────────────────────────────────────

@ttl_cache(FIX_TTL)
def fixings() -> pd.DataFrame:
    df = client.get_data(list(EURIBOR_RICS.values()), ["CF_LAST", "CF_DATE"]).set_index("Instrument")
    df["CF_LAST"] = pd.to_numeric(df["CF_LAST"], errors="coerce")
    df["CF_DATE"] = pd.to_datetime(df["CF_DATE"], errors="coerce")
    return df


@ttl_cache(FIX_TTL)
def intraday_ois(start_utc: str, end_utc: str) -> pd.DataFrame:
    """1-minute OIS MID_PRICE bars, one column per RIC, UTC index."""
    rics = list(OIS_RICS.values())
    df = client.get_history(universe=rics, fields=["MID_PRICE"], interval="1min", start=start_utc, end=end_utc)
    if df is None or df.empty:
        return pd.DataFrame(columns=rics)
    df = df.apply(pd.to_numeric, errors="coerce")
    df.index = pd.DatetimeIndex(pd.to_datetime(df.index))
    df.index = df.index.tz_localize("UTC") if df.index.tz is None else df.index.tz_convert("UTC")
    return df.sort_index()


def value_at(bars: pd.DataFrame, ric: str, at: pd.Timestamp) -> tuple[float, pd.Timestamp] | None:
    """Last bar at or before `at`; if none, the first bar after it."""
    if ric not in bars.columns:
        return None
    series = bars[ric].dropna()
    if series.empty:
        return None
    before = series.loc[series.index <= at]
    if not before.empty:
        return float(before.iloc[-1]), before.index[-1]
    return float(series.iloc[0]), series.index[0]


def lois_fix_payload() -> dict:
    fix = fixings()
    fix_date = fix["CF_DATE"].dropna().max()
    if pd.isna(fix_date):
        return {"fixDate": None, "rows": []}
    now_london = datetime.now(LONDON)
    fix_utc = pd.Timestamp(datetime.combine(fix_date.date(), time(FIX_HOUR_LONDON, 0), LONDON)).tz_convert("UTC")
    # Minute-floored end keeps the intraday cache key stable for a minute.
    now_utc = pd.Timestamp(now_london).tz_convert("UTC").floor("min")
    bars = intraday_ois(
        (fix_utc - pd.Timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"), now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    rows = []
    for tenor in TENORS:
        fixing = clean(fix["CF_LAST"].get(EURIBOR_RICS[tenor]))
        at_fix = value_at(bars, OIS_RICS[tenor], fix_utc)
        latest = value_at(bars, OIS_RICS[tenor], now_utc)
        ois_fix = at_fix[0] if at_fix else None
        ois_now = latest[0] if latest else None
        rows.append({
            "tenor": tenor,
            "fixing": fixing,
            "oisAtFix": clean(ois_fix),
            "loisAtFix": clean((fixing - ois_fix) * 100, 2) if fixing is not None and ois_fix is not None else None,
            "oisNow": clean(ois_now),
            "oisChangeBp": clean((ois_now - ois_fix) * 100, 2) if ois_now is not None and ois_fix is not None else None,
            "loisNow": clean((fixing - ois_now) * 100, 2) if fixing is not None and ois_now is not None else None,
            "oisAsOf": latest[1].tz_convert(LONDON).isoformat(timespec="minutes") if latest else None,
        })
    return {
        "fixDate": f"{fix_date:%Y-%m-%d}",
        "fixTimeLondon": f"{FIX_HOUR_LONDON:02d}:00",
        "stale": fix_date.date() != now_london.date(),
        "rows": rows,
    }
