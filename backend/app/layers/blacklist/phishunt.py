from __future__ import annotations

import asyncio
import logging
import time

import httpx

from app.core.url_normalize import normalize_for_lookup
from app.layers.blacklist.feeds import PHISHUNT_FEED_TXT

log = logging.getLogger(__name__)

FEED_URL = PHISHUNT_FEED_TXT
REFRESH_EVERY_SEC = 900


class PhishHuntStore:
    def __init__(self) -> None:
        self._listed_paths: set[str] = set()
        self._listed_hosts: set[str] = set()
        self._last_load_time: float = 0.0
        self._lock: asyncio.Lock | None = None

    def ensure_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def refresh_if_stale(self, client: httpx.AsyncClient) -> None:
        now = time.time()
        if self._last_load_time > 0 and now - self._last_load_time < REFRESH_EVERY_SEC:
            return

        async with self.ensure_lock():
            now = time.time()
            if self._last_load_time > 0 and now - self._last_load_time < REFRESH_EVERY_SEC:
                return
            await self.reload_from_feed(client)

    async def reload_from_feed(self, client: httpx.AsyncClient) -> None:
        try:
            response = await client.get(FEED_URL, timeout=60.0, follow_redirects=True)
            response.raise_for_status()
            text = response.text
        except Exception as exc:
            log.warning("phishunt download failed: %s", exc)
            return

        new_paths: set[str] = set()
        new_hosts: set[str] = set()

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if line == "" or line.startswith("#"):
                continue
            try:
                path_key, host = normalize_for_lookup(line)
            except ValueError:
                continue
            new_paths.add(path_key)
            new_hosts.add(host)

        self._listed_paths = new_paths
        self._listed_hosts = new_hosts
        self._last_load_time = time.time()
        log.info("phishunt ok: %s urls", len(new_paths))

    def match(self, lookup_key: str, host: str) -> bool:
        if lookup_key in self._listed_paths:
            return True
        if host in self._listed_hosts:
            return True
        return False


phishunt_store = PhishHuntStore()
