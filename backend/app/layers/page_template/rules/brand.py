from __future__ import annotations

from urllib.parse import urlparse

import tldextract

from app.layers.page_template.constants import IDP_SUBMIT_ORIGINS
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.page_template.rules.credential import (
    effective_has_sensitive_form,
    scaled_points_for_sensitive_context,
)
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_BRAND_MISMATCH_PRIMARY = 28
POINTS_BRAND_MISMATCH_PRIMARY_WHITELIST = 15
POINTS_BRAND_MISMATCH_SECONDARY = 12

RULE_NAME = "brand_page_host_mismatch"


def _host_from_origin(origin: str) -> str:
    text = origin.strip()
    if text == "":
        return ""

    if "://" not in text:
        text = f"https://{text}"

    parsed = urlparse(text)
    hostname = parsed.hostname
    if hostname is None:
        return ""

    return hostname.lower()


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host)
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}".lower()


def _second_level_domain(host: str) -> str:
    extracted = tldextract.extract(host)
    if extracted.domain == "":
        return ""

    return extracted.domain.lower()


def host_matches_brand(page_host: str, brand: str, official_domains: tuple[str, ...]) -> bool:
    host = page_host.strip().lower()
    brand = brand.strip().lower()

    if host == "" or brand == "":
        return False

    registered = _registered_domain(host)
    sld = _second_level_domain(host)

    if registered in official_domains:
        return True

    if sld == brand:
        return True

    for domain in official_domains:
        if host == domain:
            return True
        if host.endswith(f".{domain}"):
            return True

    return False


def _relevant_brand_hits(snapshot: PageSnapshotModel) -> list[str]:
    registry = get_impersonation_registry()
    hits: list[str] = []

    for raw in snapshot.brand_hits:
        brand = raw.strip().lower()
        if brand == "":
            continue
        if brand not in registry.brand_domains:
            continue
        if brand in hits:
            continue
        hits.append(brand)

    return hits


def _primary_brand_hits(snapshot: PageSnapshotModel) -> list[str]:
    registry = get_impersonation_registry()
    hits: list[str] = []

    for raw in snapshot.primary_brand_hits:
        brand = raw.strip().lower()
        if brand == "":
            continue
        if brand not in registry.brand_domains:
            continue
        if brand in hits:
            continue
        hits.append(brand)

    return hits


def _all_submits_to_idp(snapshot: PageSnapshotModel) -> bool:
    has_submit_target = False

    for form in snapshot.forms:
        host = _host_from_origin(form.action_origin)
        if host == "":
            continue
        has_submit_target = True
        if host not in IDP_SUBMIT_ORIGINS:
            return False

    for button in snapshot.submit_buttons:
        host = _host_from_origin(button.formaction_origin)
        if host == "":
            continue
        has_submit_target = True
        if host not in IDP_SUBMIT_ORIGINS:
            return False

    return has_submit_target


def _is_oauth_login_context(snapshot: PageSnapshotModel, brand: str) -> bool:
    registry = get_impersonation_registry()
    if brand not in registry.oauth_brands:
        return False

    return _all_submits_to_idp(snapshot)


def _mismatched_brands(snapshot: PageSnapshotModel, brands: list[str]) -> list[str]:
    registry = get_impersonation_registry()
    mismatched: list[str] = []

    for brand in brands:
        official_domains = registry.brand_domains.get(brand)
        if official_domains is None:
            continue
        if _is_oauth_login_context(snapshot, brand):
            continue
        if host_matches_brand(snapshot.page_host, brand, official_domains):
            continue
        mismatched.append(brand)

    return mismatched


def check_brand_page_host_mismatch(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_sensitive_form(snapshot):
        return []

    primary_hits = _primary_brand_hits(snapshot)
    all_hits = _relevant_brand_hits(snapshot)

    if not all_hits and not primary_hits:
        return []

    primary_mismatched = _mismatched_brands(snapshot, primary_hits)
    if primary_mismatched:
        brand = primary_mismatched[0]
        if context.whitelist_trusted:
            return [
                PageFinding(
                    rule=RULE_NAME,
                    points=POINTS_BRAND_MISMATCH_PRIMARY_WHITELIST,
                    detail=(
                        f"Page presents brand '{brand}' on host '{snapshot.page_host}' "
                        f"(trusted site; downgraded to review)."
                    ),
                    tier="B",
                )
            ]

        return [
            PageFinding(
                rule=RULE_NAME,
                points=scaled_points_for_sensitive_context(
                    snapshot, POINTS_BRAND_MISMATCH_PRIMARY
                ),
                detail=(
                    f"Page presents brand '{brand}' but document host is "
                    f"'{snapshot.page_host}' (expected official domain)."
                ),
                tier="A",
            )
        ]

    secondary_candidates = [brand for brand in all_hits if brand not in primary_hits]
    secondary_mismatched = _mismatched_brands(snapshot, secondary_candidates)
    if secondary_mismatched:
        brand = secondary_mismatched[0]
        return [
            PageFinding(
                rule=RULE_NAME,
                points=scaled_points_for_sensitive_context(
                    snapshot, POINTS_BRAND_MISMATCH_SECONDARY
                ),
                detail=(
                    f"Brand '{brand}' appears on page but host is "
                    f"'{snapshot.page_host}' (secondary surface only)."
                ),
                tier="B",
            )
        ]

    return []
