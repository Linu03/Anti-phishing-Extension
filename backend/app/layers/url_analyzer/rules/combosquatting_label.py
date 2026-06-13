from __future__ import annotations

import re

import tldextract
from rapidfuzz import fuzz

from app.layers.page_template.impersonation_registry import (
    ImpersonationRegistry,
    get_impersonation_registry,
)
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.typosquatting import _normalize_leet

RULE_COMBOSQUATTING_LABEL = "combosquatting_label"

POINTS_BRAND_WITH_LURE = 22
POINTS_BRAND_ONLY = 12

MIN_TOKEN_LENGTH = 2
MIN_TOKEN_SIMILARITY = 85

LURE_KEYWORDS: frozenset[str] = frozenset(
    {
        # English
        "secure",
        "login",
        "verify",
        "account",
        "update",
        "payment",
        "delivery",
        # Romanian
        "livrare",
        "plata",
        "verificare",
        "cont",
        "parola",
        "autentificare",
        "factura",
        "colet",
        "rambursare",
        "restituire",
        "card",
        "portal",
    }
)

_TOKEN_SPLIT_PATTERN = re.compile(r"[-_]+|\d+")


def _registered_domain(host: str) -> str | None:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return None

    return f"{extracted.domain}.{extracted.suffix}"


def _second_level_domain(host: str) -> str | None:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "":
        return None

    return extracted.domain.lower()


def _tokenize_sld(sld: str) -> list[str]:
    parts = _TOKEN_SPLIT_PATTERN.split(sld.strip().lower())
    tokens: list[str] = []
    for part in parts:
        if part != "" and part not in tokens:
            tokens.append(part)
    return tokens


def _brand_ids(registry: ImpersonationRegistry) -> list[str]:
    return sorted(registry.brand_domains.keys(), key=len, reverse=True)


def _match_token_to_brand(token: str, brands: list[str]) -> tuple[str, int] | None:
    if len(token) < MIN_TOKEN_LENGTH:
        return None

    token_lower = token.lower()
    if token_lower in brands:
        return token_lower, 100

    token_leet = _normalize_leet(token_lower)
    used_leet = token_leet != token_lower

    best_brand = ""
    best_score = 0

    for brand in brands:
        if len(brand) < MIN_TOKEN_LENGTH and token_lower != brand:
            continue

        score_raw = fuzz.ratio(token_lower, brand)
        score_leet = fuzz.ratio(token_leet, brand) if used_leet else score_raw
        score = score_raw if score_raw >= score_leet else score_leet

        if score > best_score:
            best_score = score
            best_brand = brand

    if best_brand == "" or best_score < MIN_TOKEN_SIMILARITY:
        return None

    return best_brand, int(round(best_score))


def _is_official_brand_domain(host: str, brand: str, registry: ImpersonationRegistry) -> bool:
    registered = _registered_domain(host)
    if registered is None:
        return False

    official_domains = registry.brand_domains.get(brand)
    if official_domains is None:
        return False

    return registered in official_domains


def _best_brand_token_match(
    tokens: list[str],
    brands: list[str],
) -> tuple[str, str, int] | None:
    best: tuple[str, str, int] | None = None

    for token in tokens:
        match = _match_token_to_brand(token, brands)
        if match is None:
            continue

        brand, score = match
        if best is None or score > best[2] or (score == best[2] and len(brand) > len(best[1])):
            best = (token, brand, score)

    return best


def check_combosquatting_label(
    host: str,
    registry: ImpersonationRegistry | None = None,
) -> list[UrlFinding]:
    impersonation = registry or get_impersonation_registry()

    sld = _second_level_domain(host)
    if sld is None:
        return []

    tokens = _tokenize_sld(sld)
    if len(tokens) < 2:
        return []

    brands = _brand_ids(impersonation)
    match = _best_brand_token_match(tokens, brands)
    if match is None:
        return []

    brand_token, brand, similarity = match

    if _is_official_brand_domain(host, brand, impersonation):
        return []

    lure_hits = [token for token in tokens if token != brand_token and token in LURE_KEYWORDS]

    if lure_hits:
        points = POINTS_BRAND_WITH_LURE
        lure_text = lure_hits[0]
        detail = (
            f'Host label "{sld}" contains brand token "{brand_token}" '
            f"({similarity}% match to '{brand}') with lure keyword "
            f'"{lure_text}" (combosquatting).'
        )
    else:
        points = POINTS_BRAND_ONLY
        detail = (
            f'Host label "{sld}" contains brand token "{brand_token}" '
            f"({similarity}% match to '{brand}') on a non-official domain "
            f"(possible combosquatting)."
        )

    return [
        UrlFinding(
            rule=RULE_COMBOSQUATTING_LABEL,
            points=points,
            detail=detail,
        )
    ]
