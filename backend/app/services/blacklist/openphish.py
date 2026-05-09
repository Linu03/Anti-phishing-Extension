from __future__ import annotations

import asyncio
import logging
import time

import httpx

from app.services.blacklist.normalize import normalize_for_lookup

log = logging.getLogger(__name__)

FEED_URL = "https://openphish.com/feed.txt"
REFRESH_INTERVAL_SEC = 900  # every 15 minutes


class OpenPhishStore:
    def __init__(self) -> None:
        self._listed_paths: set[str] = set()
        self._listed_hosts: set[str] = set()
        self._last_refresh_epoch: float = 0.0
        self._lock: asyncio.Lock | None = None

    def ensure_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def refresh_if_stale(self, client: httpx.AsyncClient) -> None:
        now = time.time()
        if self._last_refresh_epoch and now - self._last_refresh_epoch < REFRESH_INTERVAL_SEC:
            return
        async with self.ensure_lock():
            now = time.time()
            if self._last_refresh_epoch and now - self._last_refresh_epoch < REFRESH_INTERVAL_SEC:
                return
            await self.reload_from_feed(client)

    async def reload_from_feed(self, client: httpx.AsyncClient) -> None:
        try:
            response = await client.get(FEED_URL, timeout=60.0, follow_redirects=True)
            response.raise_for_status()
            text = response.text
        except Exception as exc:
            log.warning("OpenPhish feed download failed: %s", exc)
            return

        paths: set[str] = set()
        hosts: set[str] = set()
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                path_key, host = normalize_for_lookup(line)
            except ValueError:
                continue
            paths.add(path_key)
            hosts.add(host)

        self._listed_paths = paths
        self._listed_hosts = hosts
        self._last_refresh_epoch = time.time()
        log.info(
            "OpenPhish: feed refreshed — %d paths, %d hosts",
            len(paths),
            len(hosts),
        )

    def match(self, lookup_key: str, host: str) -> bool:
        return lookup_key in self._listed_paths or host in self._listed_hosts


openphish_store = OpenPhishStore()
