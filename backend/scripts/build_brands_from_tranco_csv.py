"""
Build backend/data/brands_tranco.json from backend/data/top-1m.csv.
Run manually when you want to refresh the brand list:
  python scripts/build_brands_from_tranco_csv.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import tldextract

BACKEND_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = BACKEND_ROOT / "data" / "top-1m.csv"
OUTPUT_PATH = BACKEND_ROOT / "data" / "brands_tranco.json"

TARGET_UNIQUE_DOMAINS = 400
MIN_BRAND_LENGTH = 4

EXTRA_RO_DOMAINS: list[tuple[str, str]] = [
    ("bcr.ro", "bcr"),
    ("brd.ro", "brd"),
    ("ing.ro", "ing"),
    ("raiffeisen.ro", "raiffeisen"),
    ("bt.ro", "bt"),
    ("revolut.com", "revolut"),
    ("emag.ro", "emag"),
    ("olx.ro", "olx"),
    ("orange.ro", "orange"),
    ("digi.ro", "digi"),
    ("anaf.ro", "anaf"),
    ("superbet.ro", "superbet"),
]


def _domain_from_csv_line(line: str) -> str | None:
    text = line.strip()
    if text == "":
        return None

    if "," in text:
        parts = text.split(",", 1)
        if len(parts) != 2:
            return None
        domain = parts[1].strip().lower()
    else:
        domain = text.lower()

    if domain == "":
        return None

    return domain


def _registered_domain_and_brand(domain: str) -> tuple[str, str] | None:
    extracted = tldextract.extract(domain)
    if extracted.domain == "" or extracted.suffix == "":
        return None

    registered = f"{extracted.domain}.{extracted.suffix}".lower()
    brand = extracted.domain.lower()
    return registered, brand


def build_registry_from_csv(
    csv_path: Path,
    target_count: int = TARGET_UNIQUE_DOMAINS,
) -> dict:
    legitimate_domains: list[str] = []
    brands: list[str] = []
    seen_domains: set[str] = set()
    seen_brands: set[str] = set()
    lines_read = 0

    with csv_path.open(encoding="utf-8") as file:
        for line in file:
            lines_read = lines_read + 1
            if len(legitimate_domains) >= target_count:
                break

            domain = _domain_from_csv_line(line)
            if domain is None:
                continue

            parsed = _registered_domain_and_brand(domain)
            if parsed is None:
                continue

            registered, brand = parsed
            if len(brand) < MIN_BRAND_LENGTH:
                continue
            if registered in seen_domains:
                continue

            seen_domains.add(registered)
            legitimate_domains.append(registered)
            if brand not in seen_brands:
                seen_brands.add(brand)
                brands.append(brand)

    for registered, brand in EXTRA_RO_DOMAINS:
        registered = registered.lower()
        brand = brand.lower()
        if len(brand) < MIN_BRAND_LENGTH:
            continue
        if registered not in seen_domains:
            seen_domains.add(registered)
            legitimate_domains.append(registered)
            if brand not in seen_brands:
                seen_brands.add(brand)
                brands.append(brand)
        elif brand not in seen_brands:
            seen_brands.add(brand)
            brands.append(brand)

    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return {
        "source": f"Tranco top-1m.csv (first {target_count} unique PLD, manual run)",
        "fetched_at": fetched_at,
        "csv_path": str(csv_path.name),
        "lines_read_from_csv": lines_read,
        "legitimate_domains": legitimate_domains,
        "brands": brands,
    }


def save_registry(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)
        file.write("\n")


def main() -> None:
    if not CSV_PATH.is_file():
        print(f"Missing CSV: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    payload = build_registry_from_csv(CSV_PATH)
    save_registry(payload, OUTPUT_PATH)

    domain_count = len(payload["legitimate_domains"])
    brand_count = len(payload["brands"])
    lines_read = payload["lines_read_from_csv"]

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Domains: {domain_count}, brands: {brand_count}, csv lines read: {lines_read}")


if __name__ == "__main__":
    main()
