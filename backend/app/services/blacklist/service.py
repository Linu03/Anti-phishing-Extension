from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.services.blacklist.normalize import normalize_for_lookup
from app.services.blacklist.openphish import openphish_store


@dataclass
class BlacklistResult:
    listed: bool
    sources: list[str]
    url_normalized: str
    host: str

async def check_blacklist(client: httpx.AsyncClient, url: str) -> BlacklistResult:
    lookup_key, host = normalize_for_lookup(url)
    await openphish_store.refresh_if_stale(client)

    sources: list[str] = []
    if openphish_store.match(lookup_key, host):
        sources.append("openphish")

    return BlacklistResult(
        listed=len(sources) > 0,
        sources=sources,
        url_normalized=lookup_key,
        host=host,
    )
