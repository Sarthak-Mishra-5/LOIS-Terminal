"""A small thread-safe TTL cache for blocking data calls."""

from __future__ import annotations

import functools
import time
from threading import Lock
from typing import Any, Callable


def ttl_cache(seconds: float) -> Callable:
    """Cache a function's result per argument tuple for `seconds`.

    Concurrent callers with the same arguments wait for one fetch instead of each hitting LSEG.
    Failures are not cached.
    """

    def decorator(func: Callable) -> Callable:
        entries: dict[tuple, tuple[float, Any]] = {}
        key_locks: dict[tuple, Lock] = {}
        guard = Lock()

        @functools.wraps(func)
        def wrapper(*args: Any) -> Any:
            key = args
            with guard:
                lock = key_locks.setdefault(key, Lock())
            with lock:
                cached = entries.get(key)
                if cached is not None and cached[0] > time.monotonic():
                    return cached[1]
                value = func(*args)
                entries[key] = (time.monotonic() + seconds, value)
                return value

        wrapper.cache_clear = entries.clear  # type: ignore[attr-defined]
        return wrapper

    return decorator
