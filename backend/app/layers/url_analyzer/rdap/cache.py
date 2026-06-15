from __future__ import annotations

import time

TTL_OLD_DOMAIN_SECONDS = 72 * 60 * 60
TTL_YOUNG_DOMAIN_SECONDS = 12 * 60 * 60
TTL_UNKNOWN_SECONDS = 30 * 60
YOUNG_DOMAIN_MAX_AGE_DAYS = 30

_store: dict[str, tuple[float, int | None]] = {}


def get_cached_age_days(domain: str) -> int | None | object:
    """Return age_days, None if unknown cached, or _MISSING if not cached."""
    entry = _store.get(domain.lower())
    if entry is None:
        return _MISSING

    expires_at, age_days = entry
    if time.time() >= expires_at:
        del _store[domain.lower()]
        return _MISSING

    return age_days


class _CacheMissing:
    pass


_MISSING = _CacheMissing()


def is_cache_missing(value: int | None | object) -> bool:
    return isinstance(value, _CacheMissing)


def set_cached_age_days(domain: str, age_days: int | None) -> None:
    normalized = domain.strip().lower()
    if normalized == "":
        return

    if age_days is None:
        ttl = TTL_UNKNOWN_SECONDS
    elif age_days > YOUNG_DOMAIN_MAX_AGE_DAYS:
        ttl = TTL_OLD_DOMAIN_SECONDS
    else:
        ttl = TTL_YOUNG_DOMAIN_SECONDS

    _store[normalized] = (time.time() + ttl, age_days)
