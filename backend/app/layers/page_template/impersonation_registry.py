from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[3]
IMPERSONATION_JSON_PATH = BACKEND_ROOT / "data" / "impersonation_brands.json"


@dataclass(frozen=True)
class ImpersonationRegistry:
    brand_domains: dict[str, tuple[str, ...]]
    oauth_brands: frozenset[str]


_registry: ImpersonationRegistry | None = None


def load_impersonation_registry(path: Path | None = None) -> ImpersonationRegistry:
    target = path or IMPERSONATION_JSON_PATH

    with target.open(encoding="utf-8") as file:
        data = json.load(file)

    brands_raw = data.get("brands", {})
    brand_domains: dict[str, tuple[str, ...]] = {}

    if isinstance(brands_raw, dict):
        for brand_key, domains_raw in brands_raw.items():
            if not isinstance(brand_key, str) or brand_key.strip() == "":
                continue
            brand = brand_key.strip().lower()
            domains: list[str] = []
            if isinstance(domains_raw, list):
                for item in domains_raw:
                    if isinstance(item, str) and item.strip() != "":
                        domains.append(item.strip().lower())
            if domains:
                brand_domains[brand] = tuple(domains)

    oauth_raw = data.get("oauth_brands", [])
    oauth_brands: set[str] = set()
    if isinstance(oauth_raw, list):
        for item in oauth_raw:
            if isinstance(item, str) and item.strip() != "":
                oauth_brands.add(item.strip().lower())

    registry = ImpersonationRegistry(
        brand_domains=brand_domains,
        oauth_brands=frozenset(oauth_brands),
    )

    log.info("impersonation registry loaded: %s brands from %s",len(registry.brand_domains),target)
    return registry


def get_impersonation_registry() -> ImpersonationRegistry:
    global _registry

    if _registry is None:
        _registry = load_impersonation_registry()

    return _registry


def get_brand_ids_catalog(path: Path | None = None) -> tuple[list[str], str]:
    """Public brand IDs for client-side page scanning (no official domains)."""
    target = path or IMPERSONATION_JSON_PATH
    registry = get_impersonation_registry()
    brand_ids = sorted(registry.brand_domains.keys())

    try:
        mtime = target.stat().st_mtime
        version = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    except OSError:
        version = "unknown"

    return brand_ids, version
