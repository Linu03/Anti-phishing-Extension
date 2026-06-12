from __future__ import annotations

import logging
import re

import httpx
import tldextract

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.page_template.logo_phash import (
    PHASH_SIMILARITY_FLOOR,
    PHASH_SIMILARITY_HIGH,
    PHASH_SIMILARITY_MEDIUM,
    BrandMatch,
    match_brand_from_prominent_image,
)
from app.layers.page_template.rules.brand import host_matches_brand
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.core.free_hosting import FREE_HOSTING_ALL
from app.layers.page_template.rules.trust_context import (
    TrustLevel,
    resolve_page_trust_context,
)
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

log = logging.getLogger(__name__)

RULE_VISUAL_BRAND_MISMATCH = "visual_brand_mismatch"

POINTS_VISUAL_BRAND_HIGH = 45
POINTS_VISUAL_BRAND_MEDIUM = 28
POINTS_VISUAL_BRAND_LOW = 15
POINTS_VISUAL_BRAND_WHITELIST = 15

_URL_ANALYZER_DUBIOUS_SCORE = 15
_URL_DUBIOUS_RULES = frozenset(
    {
        "typosquatting",
        "nested_url",
        "hosting_brand_matrix",
        "homoglyph_subdomain",
        "suspicious_tld",
    }
)


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""
    return f"{extracted.domain}.{extracted.suffix}"


def brand_absent_from_url(page_url: str, page_host: str, brand: str) -> bool:
    token = brand.strip().lower()
    if token == "":
        return False

    pattern = re.compile(rf"\b{re.escape(token)}\b", re.IGNORECASE)
    if pattern.search(page_host or ""):
        return False
    if pattern.search(page_url or ""):
        return False
    return True


def page_looks_dubious(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> bool:
    host = (snapshot.page_host or "").strip().lower()
    registered = _registered_domain(host)
    if registered != "" and registered in FREE_HOSTING_ALL:
        return True

    url_score = context.url_analyzer_score
    if url_score is not None and url_score >= _URL_ANALYZER_DUBIOUS_SCORE:
        return True

    for rule in context.url_analyzer_rules:
        if rule in _URL_DUBIOUS_RULES:
            return True

    if context.blocklist_listed:
        return True

    return False


def score_visual_brand_match(
    similarity: float,
    dubious_url: bool,
    brand_hidden_in_url: bool,
) -> tuple[int, str] | None:
    if similarity < PHASH_SIMILARITY_FLOOR:
        return None

    if similarity > PHASH_SIMILARITY_HIGH:
        return POINTS_VISUAL_BRAND_HIGH, "A"

    if brand_hidden_in_url and dubious_url:
        return POINTS_VISUAL_BRAND_HIGH, "A"

    if similarity >= PHASH_SIMILARITY_MEDIUM:
        return POINTS_VISUAL_BRAND_MEDIUM, "B"

    if dubious_url:
        return POINTS_VISUAL_BRAND_LOW, "C"

    return None


def evaluate_visual_brand(
    match: BrandMatch,
    page_host: str,
    page_url: str,
    whitelist_trusted: bool,
    dubious_url: bool,
) -> list[PageFinding]:
    brand = (match.brand or "").strip().lower()
    if brand == "":
        return []

    registry = get_impersonation_registry()
    official_domains = registry.brand_domains.get(brand)
    if official_domains is None:
        return []

    host = (page_host or "").strip().lower()
    if host == "":
        return []

    if host_matches_brand(host, brand, official_domains):
        return []

    brand_hidden = brand_absent_from_url(page_url, host, brand)
    scored = score_visual_brand_match(match.similarity, dubious_url, brand_hidden)
    if scored is None:
        return []

    points, tier = scored
    similarity_pct = int(round(match.similarity * 100))

    if whitelist_trusted:
        points = min(points, POINTS_VISUAL_BRAND_WHITELIST)
        tier = "B"
        detail = (
            f"Logo ~{similarity_pct}% similar to '{brand}' on host '{host}' "
            f"(trusted site; downgraded to review)."
        )
    elif brand_hidden and dubious_url and match.similarity <= PHASH_SIMILARITY_HIGH:
        detail = (
            f"Visual logo ~{similarity_pct}% similar to '{brand}' on host '{host}', "
            f"but the URL does not reference '{brand}' and the page context is suspicious."
        )
    elif match.similarity <= PHASH_SIMILARITY_HIGH:
        detail = (
            f"Visual logo ~{similarity_pct}% similar to '{brand}' on host '{host}' "
            f"(moderate-confidence match; not an official '{brand}' domain)."
        )
    else:
        detail = (
            f"Visual logo recognized as '{brand}' but page is hosted on "
            f"'{host}', not an official '{brand}' domain."
        )

    return [
        PageFinding(
            rule=RULE_VISUAL_BRAND_MISMATCH,
            points=points,
            detail=detail,
            tier=tier,
        )
    ]


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


async def check_visual_brand_impersonation(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
    http_client: httpx.AsyncClient,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    image = snapshot.prominent_image
    if image is None:
        return []
    if image.b64.strip() == "" and image.url.strip() == "":
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    match: BrandMatch | None = await match_brand_from_prominent_image(
        http_client,
        image_b64=image.b64,
        image_url=image.url,
    )
    if match is None:
        return []

    dubious = page_looks_dubious(snapshot, context)
    log.info(
        "visual_brand: matched '%s' file=%s distance=%d similarity=%.2f "
        "host=%s dubious=%s",
        match.brand,
        match.matched_path,
        match.distance,
        match.similarity,
        snapshot.page_host,
        dubious,
    )

    page_url = snapshot.page_url or snapshot.page_origin or ""
    return evaluate_visual_brand(
        match,
        snapshot.page_host,
        page_url,
        context.whitelist_trusted,
        dubious,
    )
