from __future__ import annotations
import time

TTL_OK_SECONDS = 30 * 60
TTL_UNREACHABLE_SECONDS = 5 * 60
DEFAULT_HTTPS_PORT = 443

_UNREACHABLE_ERRORS = frozenset(
    {
        "dns",
        "timeout",
        "connection_refused",
        "connection_error",
    }
)

_store: dict[str, tuple[float, dict]] = {}


def make_cache_key(host: str, port: int | None) -> str:
    host_lower = host.lower()
    if port is None or port == DEFAULT_HTTPS_PORT:
        return host_lower
    return host_lower + ":" + str(port)


def get_cached_response(cache_key: str) -> dict | None:
    entry = _store.get(cache_key)
    if entry is None:
        return None

    expires_at, response = entry
    now = time.time()

    if now >= expires_at:
        del _store[cache_key]
        return None

    return response


def set_cached_response(cache_key: str, response: dict, ttl_seconds: int) -> None:
    expires_at = time.time() + ttl_seconds
    _store[cache_key] = (expires_at, response)


def ttl_seconds_from_inspection(inspection: dict) -> int:
    if inspection.get("reachable") is not True:
        return TTL_UNREACHABLE_SECONDS

    error = inspection.get("error")
    if error in _UNREACHABLE_ERRORS:
        return TTL_UNREACHABLE_SECONDS

    return TTL_OK_SECONDS
