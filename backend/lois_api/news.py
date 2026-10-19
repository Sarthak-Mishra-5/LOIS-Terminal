"""Reuters headlines and stories from LSEG Workspace news."""

from __future__ import annotations

import re

import pandas as pd

from .cache import ttl_cache
from .config import NEWS_COUNT, NEWS_FILTER, NEWS_TOPICS, NEWS_TTL, STORY_TTL
from .lseg_client import client

TOPICS = {topic["key"]: topic for topic in NEWS_TOPICS}


def topic_list() -> list[dict]:
    return [{"key": t["key"], "label": t["label"]} for t in NEWS_TOPICS]


@ttl_cache(NEWS_TTL)
def headlines(query: str) -> list[dict]:
    """Newest first; one row per story (a story's alert and later updates share its id, so keep the newest)."""
    try:
        df = client.get_headlines(f"({query}) AND {NEWS_FILTER}", NEWS_COUNT)
    except Exception as exc:
        # LSEG reports a search with no matches as an error.
        if "cannot return any result" in str(exc):
            return []
        raise
    if df is None or df.empty:
        return []
    items, seen = [], set()
    for created, row in df.iterrows():
        story_id = str(row["storyId"])
        if story_id in seen:
            continue
        seen.add(story_id)
        # LSEG returns naive UTC timestamps.
        time = pd.Timestamp(created).tz_localize("UTC") if pd.Timestamp(created).tzinfo is None else pd.Timestamp(created)
        items.append({
            "id": story_id,
            "time": time.isoformat(timespec="seconds"),
            "headline": str(row["headline"]).strip(),
            "source": str(row.get("sourceCode", "")).removeprefix("NS:"),
        })
    return items


OPERATORS = {"AND", "OR", "NOT"}


def search_query(text: str) -> str:
    """Turn search-box text into LSEG news syntax, where free-text words must be quoted.

    `Lagarde inflation` -> `"Lagarde" AND "inflation"`. "Quoted phrases", AND/OR/NOT, brackets and
    field codes such as Topic:ECB pass through.
    """
    out: list[str] = []
    for token in re.findall(r'"[^"]*"|\(|\)|[^\s()]+', text):
        upper = token.upper()
        if upper in OPERATORS:
            out.append(upper)
            continue
        if token not in ("(", ")") and not token.startswith('"') and ":" not in token:
            token = f'"{token.replace(chr(34), "")}"'
        # Adjacent terms with no operator between them are ANDed.
        if out and out[-1] not in OPERATORS and out[-1] != "(" and token != ")":
            out.append("AND")
        out.append(token)
    return " ".join(out)


def headlines_payload(topic: str | None, search: str | None) -> dict:
    if search and search.strip():
        query = search_query(search)
    else:
        query = TOPICS[topic or NEWS_TOPICS[0]["key"]]["query"]
    return {"query": f"({query}) AND {NEWS_FILTER}", "items": headlines(query)}


@ttl_cache(STORY_TTL)
def story(story_id: str) -> dict:
    return {"id": story_id, "html": str(client.get_story(story_id) or "")}
