from __future__ import annotations

import logging

import httpx

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
from app.layers.page_template.rules.credential import effective_has_sensitive_form
from app.layers.page_template.rules.trust_context import (
    TrustLevel,
    resolve_page_trust_context,
)
from app.layers.page_template.rules.visual_brand import (
    brand_absent_from_url,
    page_looks_dubious,
)
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

log = logging.getLogger(__name__)

RULE_FAVICON_BRAND_MISMATCH = "favicon_brand_mismatch"

POINTS_FAVICON_HIGH = 25
POINTS_FAVICON_MEDIUM = 15
POINTS_FAVICON_WHITELIST = 10


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


def score_favicon_brand_match(
    similarity: float,
    dubious_url: bool,
    brand_hidden_in_url: bool,
) -> tuple[int, str] | None:
    if similarity < PHASH_SIMILARITY_FLOOR:
        return None

    if similarity >= PHASH_SIMILARITY_HIGH:
        return POINTS_FAVICON_HIGH, "A"

    if (
        similarity >= PHASH_SIMILARITY_MEDIUM
        and brand_hidden_in_url
        and dubious_url
    ):
        return POINTS_FAVICON_MEDIUM, "B"

    return None


def evaluate_favicon_brand(
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
    scored = score_favicon_brand_match(match.similarity, dubious_url, brand_hidden)
    if scored is None:
        return []

    points, tier = scored
    similarity_pct = int(round(match.similarity * 100))

    if whitelist_trusted:
        points = min(points, POINTS_FAVICON_WHITELIST)
        tier = "B"
        detail = (
            f"Favicon ~{similarity_pct}% similar to '{brand}' on host '{host}' "
            f"(trusted site; downgraded to review)."
        )
    elif match.similarity >= PHASH_SIMILARITY_HIGH:
        detail = (
            f"Favicon recognized as '{brand}' but page is hosted on "
            f"'{host}', not an official '{brand}' domain."
        )
    else:
        detail = (
            f"Favicon ~{similarity_pct}% similar to '{brand}' on host '{host}', "
            f"but the URL does not reference '{brand}' and the page context is suspicious."
        )

    return [
        PageFinding(
            rule=RULE_FAVICON_BRAND_MISMATCH,
            points=points,
            detail=detail,
            tier=tier,
        )
    ]


async def check_favicon_brand_impersonation(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
    http_client: httpx.AsyncClient,
    *,
    exclude_brand: str | None = None,
) -> list[PageFinding]:
    if not effective_has_sensitive_form(snapshot):
        return []

    favicon = snapshot.favicon
    if favicon is None:
        return []
    if favicon.b64.strip() == "" and favicon.url.strip() == "":
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    match: BrandMatch | None = await match_brand_from_prominent_image(
        http_client,
        image_b64=favicon.b64,
        image_url=favicon.url,
    )
    if match is None:
        return []

    if exclude_brand and match.brand == exclude_brand.strip().lower():
        return []

    dubious = page_looks_dubious(snapshot, context)
    log.info(
        "favicon_brand: matched '%s' file=%s distance=%d similarity=%.2f "
        "host=%s dubious=%s",
        match.brand,
        match.matched_path,
        match.distance,
        match.similarity,
        snapshot.page_host,
        dubious,
    )

    page_url = snapshot.page_url or snapshot.page_origin or ""
    return evaluate_favicon_brand(
        match,
        snapshot.page_host,
        page_url,
        context.whitelist_trusted,
        dubious,
    )
