from __future__ import annotations

import tldextract
from rapidfuzz import fuzz

from app.layers.url_analyzer.brand_registry import BrandRegistry
from app.layers.url_analyzer.finding import UrlFinding

MIN_BRAND_LENGTH = 4
MIN_SIMILARITY_SCORE = 82
MAX_LENGTH_DIFF = 2
POINTS_TYPOSQUATTING = 14

# Digit → letter before fuzzy match (g00gle → google, faceb00k → facebook)
LEET_MAP = str.maketrans("013458", "oieash")


def _normalize_leet(label: str) -> str:
    return label.translate(LEET_MAP)


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


def _find_best_brand_match(
    sld: str, registry: BrandRegistry
) -> tuple[str, int, bool] | None:
    sld_leet = _normalize_leet(sld)
    used_leet_normalization = sld_leet != sld

    best_brand = ""
    best_score = 0
    best_via_leet = False

    for brand in registry.brands:
        if abs(len(brand) - len(sld)) > MAX_LENGTH_DIFF:
            continue

        score_raw = fuzz.ratio(sld, brand)
        score_leet = (
            fuzz.ratio(sld_leet, brand) if used_leet_normalization else score_raw
        )
        score = score_raw if score_raw >= score_leet else score_leet
        via_leet = used_leet_normalization and score_leet > score_raw

        if score > best_score:
            best_score = score
            best_brand = brand
            best_via_leet = via_leet

    if best_brand == "" or best_score < MIN_SIMILARITY_SCORE:
        return None

    return best_brand, int(round(best_score)), best_via_leet


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

    brand, score, matched_via_leet = match
    if sld == brand:
        return findings

    score_text = str(score)
    leet_note = ""
    if matched_via_leet:
        leet_note = " after digit/leet normalization"

    findings.append(
        UrlFinding(
            rule="typosquatting",
            points=POINTS_TYPOSQUATTING,
            detail=(
                f'Host label "{sld}" is {score_text}% similar to brand "{brand}"'
                f"{leet_note} (possible typosquatting)."
            ),
        )
    )

    return findings
