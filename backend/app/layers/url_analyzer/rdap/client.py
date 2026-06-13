from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.layers.url_analyzer.rdap.cache import (
    get_cached_age_days,
    is_cache_missing,
    set_cached_age_days,
)

log = logging.getLogger(__name__)

RDAP_ORG_DOMAIN_URL = "https://rdap.org/domain/"
IANA_RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json"
FETCH_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

TLD_RDAP_OVERRIDES: dict[str, str] = {
    "ro": "https://rdap.rotld.ro/domain/",
}

_REGISTRATION_ACTIONS = frozenset(
    {
        "registration",
        "register",
        "domain registration",
    }
)

_bootstrap_services: dict[str, tuple[str, ...]] | None = None


def _parse_rdap_datetime(value: str) -> datetime | None:
    text = (value or "").strip()
    if text == "":
        return None

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _registration_date_from_payload(payload: dict) -> datetime | None:
    events = payload.get("events")
    if not isinstance(events, list):
        return None

    best: datetime | None = None
    for item in events:
        if not isinstance(item, dict):
            continue
        action = str(item.get("eventAction", "")).strip().lower()
        if action not in _REGISTRATION_ACTIONS:
            continue
        event_date = _parse_rdap_datetime(str(item.get("eventDate", "")))
        if event_date is None:
            continue
        if best is None or event_date < best:
            best = event_date

    return best


def age_days_from_registration(registration: datetime) -> int:
    now = datetime.now(tz=timezone.utc)
    if now < registration:
        return 0
    return (now - registration).days


def age_days_from_rdap_payload(payload: dict) -> int | None:
    registration = _registration_date_from_payload(payload)
    if registration is None:
        return None
    return age_days_from_registration(registration)


def _tld_for_domain(domain: str) -> str:
    parts = domain.rsplit(".", 1)
    if len(parts) != 2:
        return ""
    return parts[1].lower()


async def _load_bootstrap_services(client: httpx.AsyncClient) -> dict[str, tuple[str, ...]]:
    global _bootstrap_services
    if _bootstrap_services is not None:
        return _bootstrap_services

    services: dict[str, list[str]] = {}
    try:
        response = await client.get(
            IANA_RDAP_BOOTSTRAP_URL,
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
        )
        if response.status_code == 200:
            payload = response.json()
            entries = payload.get("services", []) if isinstance(payload, dict) else []
            if isinstance(entries, list):
                for entry in entries:
                    if not isinstance(entry, list) or len(entry) != 2:
                        continue
                    tlds_raw, urls_raw = entry
                    if not isinstance(tlds_raw, list) or not isinstance(urls_raw, list):
                        continue
                    for tld_item in tlds_raw:
                        if not isinstance(tld_item, str):
                            continue
                        tld = tld_item.strip().lower()
                        if tld == "":
                            continue
                        bucket = services.setdefault(tld, [])
                        for url_item in urls_raw:
                            if isinstance(url_item, str) and url_item.strip() != "":
                                bucket.append(url_item.strip())
    except Exception as exc:
        log.info("rdap: iana bootstrap load failed: %s", exc)

    _bootstrap_services = {
        tld: tuple(urls) for tld, urls in services.items()
    }
    return _bootstrap_services


def _rdap_domain_urls(domain: str, bootstrap: dict[str, tuple[str, ...]]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        if url not in seen:
            seen.add(url)
            urls.append(url)

    add(f"{RDAP_ORG_DOMAIN_URL}{domain}")

    tld = _tld_for_domain(domain)
    override = TLD_RDAP_OVERRIDES.get(tld)
    if override is not None:
        add(f"{override}{domain}")

    for base in bootstrap.get(tld, ()):
        parsed = urlparse(base)
        if parsed.scheme not in {"http", "https"} or parsed.netloc == "":
            continue
        root = base if base.endswith("/") else f"{base}/"
        add(f"{root}domain/{domain}")

    return urls


async def _fetch_rdap_payload(
    client: httpx.AsyncClient,
    url: str,
) -> dict | None:
    try:
        response = await client.get(url, timeout=FETCH_TIMEOUT, follow_redirects=True)
    except Exception as exc:
        log.info("rdap: request failed for %s: %s", url, exc)
        return None

    if response.status_code != 200:
        return None

    try:
        payload = response.json()
    except ValueError:
        return None

    if isinstance(payload, dict):
        return payload
    return None


async def fetch_domain_age_days(
    client: httpx.AsyncClient,
    registered_domain: str,
) -> int | None:
    domain = registered_domain.strip().lower()
    if domain == "":
        return None

    cached = get_cached_age_days(domain)
    if not is_cache_missing(cached):
        return cached  # type: ignore[return-value]

    bootstrap = await _load_bootstrap_services(client)
    candidate_urls = _rdap_domain_urls(domain, bootstrap)

    for url in candidate_urls:
        payload = await _fetch_rdap_payload(client, url)
        if payload is None:
            continue
        age_days = age_days_from_rdap_payload(payload)
        if age_days is not None:
            set_cached_age_days(domain, age_days)
            return age_days

    set_cached_age_days(domain, None)
    return None


def reset_rdap_bootstrap_cache() -> None:
    global _bootstrap_services
    _bootstrap_services = None
