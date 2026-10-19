"""LSEG Workspace desktop session shared by the whole API process.

Uses the library's default desktop configuration, the same as app.py, so no app key is needed.
All calls go through one lock: the lseg-data session is not documented as thread-safe.
"""

from __future__ import annotations

import time
from threading import RLock
from typing import Any

import pandas as pd

RETRY_SECONDS = 30


class LsegUnavailable(RuntimeError):
    pass


class LsegClient:
    def __init__(self) -> None:
        self._lock = RLock()
        self._ld: Any = None
        self._last_attempt = 0.0
        self.last_error: str | None = None
        self.last_success: float | None = None

    def _session(self) -> Any:
        if self._ld is not None:
            return self._ld
        if time.monotonic() - self._last_attempt < RETRY_SECONDS and self.last_error:
            raise LsegUnavailable(self.last_error)
        self._last_attempt = time.monotonic()
        try:
            import lseg.data as ld

            ld.open_session()
        except Exception as exc:
            self.last_error = f"Could not open LSEG session: {exc}"
            raise LsegUnavailable(self.last_error) from exc
        self._ld = ld
        return ld

    def _call(self, method: str, **kwargs: Any) -> Any:
        with self._lock:
            ld = self._session()
            try:
                target = ld
                for part in method.split("."):
                    target = getattr(target, part)
                result = target(**kwargs)
            except Exception as exc:
                self.last_error = str(exc)
                raise
            self.last_error = None
            self.last_success = time.time()
            return result

    def get_data(self, universe: list[str], fields: list[str]) -> pd.DataFrame:
        return self._call("get_data", universe=universe, fields=fields)

    def get_history(self, **kwargs: Any) -> pd.DataFrame:
        # Always pass `end`: without it LSEG returns only the last 20 rows.
        return self._call("get_history", **kwargs)

    def get_headlines(self, query: str, count: int) -> pd.DataFrame:
        return self._call("news.get_headlines", query=query, count=count)

    def get_story(self, story_id: str) -> str:
        with self._lock:
            ld = self._session()
        return self._call("news.get_story", story_id=story_id, format=ld.news.Format.HTML)

    @property
    def connected(self) -> bool:
        return self._ld is not None and self.last_error is None


client = LsegClient()
