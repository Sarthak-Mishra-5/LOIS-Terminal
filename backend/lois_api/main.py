"""HTTP API for the LOIS terminal. Serves the built React app from frontend/dist when it exists."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import ecb, market, news
from .config import BY_KEY, INSTRUMENTS, REGIMES
from .lseg_client import client

app = FastAPI(title="LOIS Terminal API")
app.add_middleware(GZipMiddleware, minimum_size=1000)
# The Vite dev server runs on another port during development.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

_ecb_status: dict = {"ok": None, "error": None}


def guarded(source: str, build: Callable[[], dict]) -> dict:
    """Run a payload builder; turn data-source failures into a 503 the UI can show."""
    try:
        payload = build()
    except Exception as exc:
        if source == "ecb":
            _ecb_status.update(ok=False, error=str(exc))
        raise HTTPException(status_code=503, detail=f"{source.upper()}: {exc}") from exc
    if source == "ecb":
        _ecb_status.update(ok=True, error=None)
    return payload


@app.get("/api/status")
def status() -> dict:
    return {
        "serverTimeUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lseg": {
            "connected": client.connected,
            "error": client.last_error,
            "lastSuccessAgoSec": round(time.time() - client.last_success) if client.last_success else None,
        },
        "ecb": _ecb_status,
    }


@app.get("/api/instruments")
def instruments() -> dict:
    return {"instruments": [market.instrument_meta(inst) for inst in INSTRUMENTS], "regimes": REGIMES}


@app.get("/api/snapshot")
def snapshot() -> dict:
    return guarded("lseg", market.snapshot_payload)


@app.get("/api/lois/fix")
def lois_fix() -> dict:
    return guarded("lseg", market.lois_fix_payload)


@app.get("/api/lois/history")
def lois_history(days: int = Query(365, ge=0)) -> dict:
    return guarded("lseg", lambda: market.lois_history_payload(days))


@app.get("/api/rates/history")
def rates_history(days: int = Query(365, ge=0)) -> dict:
    return guarded("lseg", lambda: market.rates_history_payload(days))


@app.get("/api/series/{key}")
def series(key: str, days: int = Query(365, ge=0)) -> dict:
    if key not in BY_KEY:
        raise HTTPException(status_code=404, detail=f"Unknown instrument {key}")
    return guarded("lseg", lambda: market.series_payload(key, days))


@app.get("/api/ohlc/{key}")
def ohlc(key: str, days: int = Query(365, ge=0)) -> dict:
    if key not in BY_KEY or BY_KEY[key].kind != "ohlc":
        raise HTTPException(status_code=404, detail=f"No OHLC history for {key}")
    return guarded("lseg", lambda: market.ohlc_payload(key, days))


@app.get("/api/news/topics")
def news_topics() -> dict:
    return {"topics": news.topic_list()}


@app.get("/api/news")
def news_headlines(topic: str | None = None, q: str | None = Query(None, max_length=300)) -> dict:
    if topic is not None and topic not in news.TOPICS:
        raise HTTPException(status_code=404, detail=f"Unknown news topic {topic}")
    return guarded("lseg", lambda: news.headlines_payload(topic, q))


@app.get("/api/news/story")
def news_story(id: str = Query(..., max_length=200)) -> dict:
    return guarded("lseg", lambda: news.story(id))


@app.get("/api/liquidity")
def liquidity() -> dict:
    return guarded("ecb", ecb.liquidity_payload)


@app.get("/api/liquidity.csv", response_class=PlainTextResponse)
def liquidity_csv() -> PlainTextResponse:
    csv = guarded("ecb", lambda: {"csv": ecb.liquidity_csv()})["csv"]
    return PlainTextResponse(
        csv, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ecb_excess_liquidity_daily_eur_bn.csv"'},
    )


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
