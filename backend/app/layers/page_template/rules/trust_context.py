from __future__ import annotations

from enum import Enum

from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.page_template.rules.brand import (
    _mismatched_brands,
    _primary_brand_hits,
    _relevant_brand_hits,
    host_matches_brand,
)
from app.layers.page_template.schemas import PageSnapshotModel, PriorLayersContextModel

URL_SCORE_UNTRUSTED_THRESHOLD = 15


class TrustLevel(str, Enum):
    USER_WHITELIST = "user_whitelist"
    TRUSTED_BRAND_HOST = "trusted_brand_host"
    UNTRUSTED = "untrusted"
    NEUTRAL = "neutral"


def _all_detected_brands(snapshot: PageSnapshotModel) -> list[str]:
    merged: list[str] = []
    for brand in _primary_brand_hits(snapshot) + _relevant_brand_hits(snapshot):
        if brand not in merged:
            merged.append(brand)
    return merged


def host_matches_any_detected_brand(snapshot: PageSnapshotModel) -> bool:
    registry = get_impersonation_registry()
    page_host = snapshot.page_host.strip().lower()
    if page_host == "":
        return False

    for brand in _all_detected_brands(snapshot):
        official_domains = registry.brand_domains.get(brand)
        if official_domains is None:
            continue
        if host_matches_brand(page_host, brand, official_domains):
            return True

    return False


def has_brand_host_mismatch(snapshot: PageSnapshotModel) -> bool:
    primary_hits = _primary_brand_hits(snapshot)
    all_hits = _relevant_brand_hits(snapshot)
    if not primary_hits and not all_hits:
        return False

    if _mismatched_brands(snapshot, primary_hits):
        return True

    secondary_candidates = [brand for brand in all_hits if brand not in primary_hits]
    return bool(_mismatched_brands(snapshot, secondary_candidates))


def resolve_page_trust_context(snapshot: PageSnapshotModel,context: PriorLayersContextModel) -> TrustLevel:
    if context.whitelist_trusted:
        return TrustLevel.USER_WHITELIST

    if host_matches_any_detected_brand(snapshot):
        return TrustLevel.TRUSTED_BRAND_HOST

    if has_brand_host_mismatch(snapshot):
        return TrustLevel.UNTRUSTED

    if context.blocklist_listed:
        return TrustLevel.UNTRUSTED

    url_score = context.url_analyzer_score
    if url_score is not None and url_score >= URL_SCORE_UNTRUSTED_THRESHOLD:
        return TrustLevel.UNTRUSTED

    return TrustLevel.NEUTRAL
