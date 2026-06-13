from __future__ import annotations

from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.page_template.logo_phash import (
    PHASH_DISTANCE_HIGH,
    PHASH_MAX_DISTANCE,
    _min_hash_distance,
    load_brand_logo_registry,
)


def main() -> None:
    registry = load_brand_logo_registry()
    impersonation = get_impersonation_registry()

    if not registry:
        print("No logos found. Drop *.png files in app/data/brand_logos/")
        return

    print(
        f"Loaded {len(registry)} logos. "
        f"Match floor: {PHASH_MAX_DISTANCE}/64 (~50%), "
        f"high tier: {PHASH_DISTANCE_HIGH}/64 (~90%)\n"
    )

    for entry in registry:
        in_imp = entry.brand in impersonation.brand_domains
        marker = "OK " if in_imp else "ORPHAN"
        primary = entry.phashes[0] if entry.phashes else "?"
        print(
            f"[{marker}] {entry.brand:<14} phash={primary}  "
            f"variants={len(entry.phashes)}  file={entry.path.name}"
        )

    print("\n--- pairwise nearest-neighbour (collision check) ---")
    for i, a in enumerate(registry):
        nearest = None
        nearest_d = 64
        for j, b in enumerate(registry):
            if i == j:
                continue
            d = _min_hash_distance(a.phashes, b.phashes)
            if d < nearest_d:
                nearest_d = d
                nearest = b
        if nearest is None:
            continue
        warn = ""
        if nearest_d <= PHASH_DISTANCE_HIGH:
            warn = " <-- HIGH-TIER COLLISION"
        elif nearest_d <= PHASH_MAX_DISTANCE:
            warn = " <-- FLOOR-TIER COLLISION"
        print(f"  {a.brand:<14} ({a.path.name}) -> {nearest.brand:<14} d={nearest_d}{warn}")


if __name__ == "__main__":
    main()
