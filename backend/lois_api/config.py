"""Instrument definitions shared by every endpoint.

All RICs, fields and units were checked against LSEG Workspace on this login (Oct 2026).
"""

from __future__ import annotations

from dataclasses import dataclass
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")

TENORS = ["3M", "6M", "12M"]
EURIBOR_RICS = {"3M": "EURIBOR3MD=", "6M": "EURIBOR6MD=", "12M": "EURIBOR1YD="}
OIS_RICS = {"3M": "EUREST3M=", "6M": "EUREST6M=", "12M": "EUREST1Y="}

# Daily history is fetched once per RIC from this date and sliced per request.
HISTORY_START = "2007-01-01"
# Column preference when a RIC has no explicit history field.
# EURIBOR fixings come back as FIXING_1; OIS and cross-currency swaps have BID/ASK/MID_PRICE.
PRICE_COLUMNS = ["FIXING_1", "CLOSE", "MID_PRICE", "TRDPRC_1", "BID", "PRIMACT_1"]


@dataclass(frozen=True)
class Instrument:
    key: str
    label: str
    ric: str
    group: str
    unit: str
    decimals: int
    # "last" uses CF_LAST then PRIMACT_1; "mid" uses (BID + ASK) / 2 because CF_LAST can be stale.
    live: str = "last"
    history_field: str | None = None
    # "line" for rates and swaps; "ohlc" for instruments with open/high/low/close history.
    kind: str = "line"
    # History fields for an "ohlc" bar's open, high and low; the close is `history_field`.
    ohlc_fields: tuple[str, str, str] = ("OPEN_PRC", "HIGH_1", "LOW_1")
    note: str | None = None


INSTRUMENTS: list[Instrument] = [
    *(
        Instrument(f"euribor_{t.lower()}", f"EURIBOR {t}", EURIBOR_RICS[t], "EURIBOR FIXINGS", "%", 3,
                   history_field="FIXING_1")
        for t in TENORS
    ),
    *(
        Instrument(f"ois_{t.lower()}", f"€STR OIS {t}", OIS_RICS[t], "€STR OIS", "%", 4, live="mid",
                   history_field="MID_PRICE")
        for t in TENORS
    ),
    # Spread history: BID is the daily close and BID_*_SPD the open/high/low around it.
    Instrument("oat_bund", "OAT−BUND 10Y", "DE10FR10=RR", "SPREADS & FX", "bp", 2, history_field="BID", kind="ohlc",
               ohlc_fields=("BID_O_SPD", "BID_H_SPD", "BID_L_SPD")),
    Instrument("btp_bund", "BTP−BUND 10Y", "DE10IT10=RR", "SPREADS & FX", "bp", 2, history_field="BID", kind="ohlc",
               ohlc_fields=("BID_O_SPD", "BID_H_SPD", "BID_L_SPD")),
    # Bid-side bars, like the live CF_LAST.
    Instrument("eurchf", "EUR/CHF", "EURCHF=", "SPREADS & FX", "", 4, history_field="BID", kind="ohlc",
               ohlc_fields=("OPEN_BID", "BID_HIGH_1", "BID_LOW_1")),
    # CF_LAST on this RIC is the bid; the history is MID_PRICE, so the live value must be the mid too.
    Instrument("xccy_3m", "EUR/USD XCCY 3M", "EUUSAB3L3M=FMD", "SPREADS & FX", "", 3, live="mid",
               history_field="MID_PRICE"),
    # PAR_MID1 is the day's last quote; MID_SPREAD and OPEN_PRC are its first.
    Instrument("fr_cds_5y", "FRANCE CDS 5Y", "FRGV5YUSAC=R", "SPREADS & FX", "bp", 2, history_field="PAR_MID1",
               kind="ohlc"),
    Instrument("sx7e", "EURO STOXX BANKS", ".SX7E", "EQUITIES", "pts", 2, history_field="TRDPRC_1", kind="ohlc"),
    Instrument("sx7p", "STOXX 600 BANKS", ".SX7P", "EQUITIES", "pts", 2, history_field="TRDPRC_1", kind="ohlc"),
    Instrument("sx8p", "STOXX 600 TECH", ".SX8P", "EQUITIES", "pts", 2, history_field="TRDPRC_1", kind="ohlc"),
    # Futures close on the settlement price, the same close LSEG's NETCHNG_1 measures the live change from.
    # The S&P 500 (.SPX) and NASDAQ Composite (.IXIC) cash indices are not entitled on this login.
    Instrument("es", "S&P 500 E-MINI", "ESc1", "EQUITIES", "pts", 2, history_field="SETTLE", kind="ohlc",
               note="Front-month future; .SPX not entitled"),
    Instrument("nq", "NASDAQ-100 E-MINI", "NQc1", "EQUITIES", "pts", 2, history_field="SETTLE", kind="ohlc",
               note="Front-month future; tracks Nasdaq-100, not the Composite"),
    Instrument("brent", "BRENT FRONT", "LCOc1", "ENERGY", "USD/bbl", 2, history_field="SETTLE", kind="ohlc"),
    Instrument("ttf", "TTF GAS FRONT", "TRNLTTFMc1", "ENERGY", "EUR/MWh", 2, history_field="SETTLE", kind="ohlc"),
]
BY_KEY = {inst.key: inst for inst in INSTRUMENTS}
BY_RIC = {inst.ric: inst for inst in INSTRUMENTS}
# CF_DATE is the quote's own trading date; it decides which daily bar a live value belongs to.
LIVE_FIELDS = ["CF_LAST", "PRIMACT_1", "NETCHNG_1", "BID", "ASK", "OPEN_PRC", "HIGH_1", "LOW_1", "ACVOL_UNS", "CF_DATE"]

# EURIBOR is fixed at 11:00 CET, i.e. 10:00 London.
FIX_HOUR_LONDON = 10

# Euro area excess liquidity from the ECB Data Portal (same figures as
# https://www.ecb.europa.eu/mopo/liq/html/index.en.html), daily, EUR mn.
# EXLIQ only exists from 27 Sep 2024; earlier days are rebuilt as current accounts + deposit facility
# - marginal lending - reserve requirements, holding reserve requirements at their first published value.
ECB_LIQ_URL = (
    "https://data-api.ecb.europa.eu/service/data/ILM/D.U2.C.EXLIQ+L020100+L020200+A050500+MRR+NLIQ+TOMO.U2.EUR"
    "?startPeriod={start}&format=csvdata"
)
ECB_LIQ_START = "2020-11-01"
ECB_EXLIQ_FIRST_DAY = "2024-09-27"
HEATMAP_FIRST_YEAR = 2021
ECB_LIQ_COLUMNS = {
    "EXLIQ": "excess_liquidity", "L020100": "current_accounts", "L020200": "deposit_facility",
    "A050500": "marginal_lending", "MRR": "reserve_requirements", "NLIQ": "net_autonomous_factors",
    "TOMO": "open_market_operations",
}
# The ECB publishes the previous business day's figures at about 10:33 London time.
ECB_PUBLISH_WINDOW = ((10, 25), (11, 30))

REGIMES = [
    {"start": "2007-08-01", "end": "2009-06-30", "label": "GFC"},
    {"start": "2010-04-01", "end": "2012-12-31", "label": "EURO DEBT CRISIS"},
    {"start": "2020-02-01", "end": "2020-12-31", "label": "COVID-19"},
    {"start": "2022-06-01", "end": "2023-12-31", "label": "ECB TIGHTENING"},
]

# Reuters news presets: LSEG news query syntax; NEWS_FILTER is added to each, and to free-text searches.
NEWS_FILTER = "Source:RTRS AND Language:LEN"
NEWS_TOPICS = [
    {"key": "eur_rates", "label": "EUR RATES", "query": "(Topic:MMKT OR Topic:CEN OR Topic:DBT OR Topic:GVD) AND Topic:EZC"},
    {"key": "ecb", "label": "ECB", "query": "Topic:ECB"},
    {"key": "france", "label": "FRANCE", "query": "Topic:FR AND (Topic:DBT OR Topic:GVD OR Topic:CEN)"},
    {"key": "fx", "label": "FX", "query": "Topic:FRX"},
    {"key": "energy", "label": "ENERGY", "query": "Topic:CRU OR Topic:NGS"},
    {"key": "top", "label": "TOP NEWS", "query": "Topic:TOPNWS"},
]
NEWS_COUNT = 100

# Cache lifetimes in seconds.
SNAPSHOT_TTL = 10
FIX_TTL = 60
HISTORY_TTL = 900
NEWS_TTL = 20
STORY_TTL = 3600
