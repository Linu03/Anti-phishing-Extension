from __future__ import annotations

import tldextract
from rapidfuzz import fuzz

from app.layers.url_analyzer.brand_registry import BrandRegistry
from app.layers.url_analyzer.finding import UrlFinding

MIN_BRAND_LENGTH = 4
MIN_SIMILARITY_SCORE = 82
MAX_LENGTH_DIFF = 2
POINTS_TYPOSQUATTING = 12


def _registered_domain(host: str) -> str | None:
    extracted = tldextract.extract(host)
    if extracted.domain == "" or extracted.suffix == "":
        return None

    return f"{extracted.domain}.{extracted.suffix}".lower()


def _second_level_domain(host: str) -> str | None:
    extracted = tldextract.extract(host)
    if extracted.domain == "":
        return None

    return extracted.domain.lower()


def _is_legitimate_host(host: str, registry: BrandRegistry) -> bool:
    registered = _registered_domain(host)
    if registered is None:
        return False

    return registered in registry.legitimate_domains


def _find_best_brand_match(sld: str, registry: BrandRegistry) -> tuple[str, int] | None:
    best_brand = ""
    best_score = 0

    for brand in registry.brands:
        if abs(len(brand) - len(sld)) > MAX_LENGTH_DIFF:
            continue

        score = fuzz.ratio(sld, brand)
        if score > best_score:
            best_score = score
            best_brand = brand

    if best_brand == "" or best_score < MIN_SIMILARITY_SCORE:
        return None

    return best_brand, best_score


def check_typosquatting(host: str, registry: BrandRegistry) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    if _is_legitimate_host(host, registry):
        return findings

    sld = _second_level_domain(host)
    if sld is None or len(sld) < MIN_BRAND_LENGTH:
        return findings

    if sld in registry.brands_exact:
        return findings

    match = _find_best_brand_match(sld, registry)
    if match is None:
        return findings

    brand, score = match
    if sld == brand:
        return findings

    score_text = str(int(round(score)))
    findings.append(
        UrlFinding(
            rule="typosquatting",
            points=POINTS_TYPOSQUATTING,
            detail=(
                f'Host label "{sld}" is {score_text}% similar to brand "{brand}" '
                f"(possible typosquatting)."
            ),
        )
    )

    return findings
