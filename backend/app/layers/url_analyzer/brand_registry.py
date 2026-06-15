from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[3]
BRANDS_JSON_PATH = BACKEND_ROOT / "data" / "brands_tranco.json"


@dataclass
class BrandRegistry:
    legitimate_domains: set[str]
    brands: list[str]
    brands_exact: set[str]
    source: str
    fetched_at: str


_registry: BrandRegistry | None = None


def load_brand_registry(path: Path | None = None) -> BrandRegistry:
    target = path or BRANDS_JSON_PATH

    with target.open(encoding="utf-8") as file:
        data = json.load(file)

    legitimate_raw = data.get("legitimate_domains", [])
    brands_raw = data.get("brands", [])

    legitimate_domains: set[str] = set()
    for item in legitimate_raw:
        if isinstance(item, str) and item.strip() != "":
            legitimate_domains.add(item.strip().lower())

    brands: list[str] = []
    brands_exact: set[str] = set()
    for item in brands_raw:
        if isinstance(item, str) and item.strip() != "":
            brand = item.strip().lower()
            if brand not in brands_exact:
                brands_exact.add(brand)
                brands.append(brand)

    source = data.get("source", "")
    if not isinstance(source, str):
        source = str(source)

    fetched_at = data.get("fetched_at", "")
    if not isinstance(fetched_at, str):
        fetched_at = str(fetched_at)

    registry = BrandRegistry(
        legitimate_domains=legitimate_domains,
        brands=brands,
        brands_exact=brands_exact,
        source=source,
        fetched_at=fetched_at,
    )

    log.info(
        "brand registry loaded: %s domains, %s brands from %s",
        len(registry.legitimate_domains),
        len(registry.brands),
        target,
    )

    return registry


def get_brand_registry() -> BrandRegistry:
    global _registry

    if _registry is None:
        _registry = load_brand_registry()

    return _registry
