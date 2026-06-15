from __future__ import annotations

import tldextract

from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.url_analyzer.brand_registry import get_brand_registry


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""
    return f"{extracted.domain}.{extracted.suffix}"


def all_official_registered_domains() -> frozenset[str]:
    domains: set[str] = set(get_brand_registry().legitimate_domains)

    impersonation = get_impersonation_registry()
    for official in impersonation.brand_domains.values():
        domains.update(item.strip().lower() for item in official if item.strip() != "")

    return frozenset(domains)


def is_official_registered_domain(host: str) -> bool:
    registered = _registered_domain(host)
    if registered == "":
        return False
    return registered in all_official_registered_domains()


def is_relaxed_official_page(snapshot, context) -> bool:
    """Benign big-brand context: official host and no on-page brand impersonation."""
    from app.layers.page_template.rules.trust_context import (
        TrustLevel,
        has_brand_host_mismatch,
        resolve_page_trust_context,
    )

    if context.whitelist_trusted:
        return True

    if has_brand_host_mismatch(snapshot):
        return False

    page_host = snapshot.page_host.strip().lower()
    if page_host != "" and is_official_registered_domain(page_host):
        return True

    trust = resolve_page_trust_context(snapshot, context)
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}
