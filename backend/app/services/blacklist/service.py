from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx

from app.services.blacklist.normalize import normalize_for_lookup
from app.services.blacklist.openphish import openphish_store
from app.services.blacklist.phishunt import phishunt_store


@dataclass
class BlacklistResult:
    listed: bool
    sources: list[str]
    url_normalized: str
    host: str


async def check_blacklist(client: httpx.AsyncClient, url: str) -> BlacklistResult:
    normalized_key, host = normalize_for_lookup(url)

    await asyncio.gather(
        openphish_store.refresh_if_stale(client),
        phishunt_store.refresh_if_stale(client),
    )

    sources: list[str] = []
    if openphish_store.match(normalized_key, host):
        sources.append("openphish")
    if phishunt_store.match(normalized_key, host):
        sources.append("phishunt")

    listed = len(sources) > 0

    return BlacklistResult(
        listed=listed,
        sources=sources,
        url_normalized=normalized_key,
        host=host,
    )
