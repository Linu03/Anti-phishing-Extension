from __future__ import annotations

import tldextract

from app.core.brand_subdomain import detect_brand_in_subdomain
from app.core.free_hosting import FreeHostingKind, is_free_hosting
from app.layers.page_template.impersonation_registry import (
    ImpersonationRegistry,
    get_impersonation_registry,
)
from app.layers.url_analyzer.finding import UrlFinding

RULE_HOSTING_BRAND_MATRIX = "hosting_brand_matrix"

POINTS_SUSPICIOUS_FREE_BRAND = 35
POINTS_SUSPICIOUS_FREE_ONLY = 10
POINTS_BRAND_ONLY = 15

POINTS_DEVELOPER_FREE_BRAND = 17
POINTS_DEVELOPER_FREE_ONLY = 5


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}"


def _all_official_domains(registry: ImpersonationRegistry) -> frozenset[str]:
    domains: set[str] = set()
    for official in registry.brand_domains.values():
        domains.update(official)
    return frozenset(domains)


def _official_domains_for_brand(
    registry: ImpersonationRegistry, brand: str
) -> frozenset[str]:
    return frozenset(registry.brand_domains.get(brand, ()))


def _tier_for_points(points: int) -> str:
    if points in {POINTS_SUSPICIOUS_FREE_BRAND, POINTS_DEVELOPER_FREE_BRAND}:
        return "A"
    if points == POINTS_BRAND_ONLY:
        return "B"
    if points in {POINTS_SUSPICIOUS_FREE_ONLY, POINTS_DEVELOPER_FREE_ONLY}:
        return "C"
    return ""


def _score_matrix(
    hosting_kind: FreeHostingKind | None,
    brand: str | None,
) -> int | None:
    if hosting_kind == "suspicious" and brand is not None:
        return POINTS_SUSPICIOUS_FREE_BRAND
    if hosting_kind == "developer" and brand is not None:
        return POINTS_DEVELOPER_FREE_BRAND
    if hosting_kind == "suspicious":
        return POINTS_SUSPICIOUS_FREE_ONLY
    if hosting_kind == "developer":
        return POINTS_DEVELOPER_FREE_ONLY
    if brand is not None:
        return POINTS_BRAND_ONLY
    return None


def check_hosting_brand_matrix(
    host: str,
    registry: ImpersonationRegistry | None = None,
) -> list[UrlFinding]:
    impersonation = registry or get_impersonation_registry()
    registered = _registered_domain(host)
    if registered == "":
        return []

    official_domains = _all_official_domains(impersonation)
    if registered in official_domains:
        return []

    brands = list(impersonation.brand_domains.keys())
    brand = detect_brand_in_subdomain(host, brands)
    if brand is not None and registered in _official_domains_for_brand(
        impersonation, brand
    ):
        return []

    hosting_kind = is_free_hosting(registered)
    points = _score_matrix(hosting_kind, brand)
    if points is None:
        return []

    tier = _tier_for_points(points)
    hosting_type = hosting_kind if hosting_kind is not None else "none"
    brand_text = brand if brand is not None else "none"

    if hosting_kind is not None and brand is not None:
        scenario = "free hosting with brand in subdomain"
    elif hosting_kind is not None:
        scenario = "free hosting without brand in subdomain"
    else:
        scenario = "brand in subdomain without free hosting"

    detail = (
        f"{scenario}; tier {tier}; hosting_type={hosting_type}; "
        f"brand={brand_text}; registered={registered}."
    )

    return [
        UrlFinding(
            rule=RULE_HOSTING_BRAND_MATRIX,
            points=points,
            detail=detail,
            tier=tier,
        )
    ]
