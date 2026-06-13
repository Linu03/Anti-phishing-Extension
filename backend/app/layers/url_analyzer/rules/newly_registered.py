from __future__ import annotations

import tldextract

import httpx

from app.core.free_hosting import is_free_hosting
from app.layers.page_template.impersonation_registry import (
    ImpersonationRegistry,
    get_impersonation_registry,
)
from app.layers.url_analyzer.brand_registry import BrandRegistry, get_brand_registry
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rdap.client import fetch_domain_age_days

RULE_NEWLY_REGISTERED_DOMAIN = "newly_registered_domain"

VERY_NEW_MAX_DAYS = 7
RECENT_MAX_DAYS = 30

POINTS_VERY_NEW_WITH_CONTEXT = 18
POINTS_RECENT_WITH_CONTEXT = 10
POINTS_VERY_NEW_STANDALONE = 5

COMBO_CONTEXT_RULES = frozenset(
    {
        "typosquatting",
        "combosquatting_label",
        "hosting_brand_matrix",
        "suspicious_tld",
        "ip_host",
        "nested_url_in_query",
        "phishing_keywords",
        "idn_homograph",
        "high_entropy_hostname",
        "many_subdomains",
        "at_in_url",
        "suspicious_encoding",
        "unicode_normalization",
    }
)


def registered_domain_for_host(host: str) -> str:
    extracted = tldextract.extract((host or "").strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""
    return f"{extracted.domain}.{extracted.suffix}"


def _all_official_domains(registry: ImpersonationRegistry) -> frozenset[str]:
    domains: set[str] = set()
    for official in registry.brand_domains.values():
        domains.update(official)
    return frozenset(domains)


def should_skip_rdap_lookup(
    registered: str,
    *,
    brand_registry: BrandRegistry | None = None,
    impersonation_registry: ImpersonationRegistry | None = None,
    whitelist_trusted: bool = False,
) -> bool:
    if whitelist_trusted:
        return True

    normalized = registered.strip().lower()
    if normalized == "":
        return True

    brands = brand_registry or get_brand_registry()
    if normalized in brands.legitimate_domains:
        return True

    impersonation = impersonation_registry or get_impersonation_registry()
    if normalized in _all_official_domains(impersonation):
        return True

    if is_free_hosting(normalized) is not None:
        return True

    return False


def has_combo_url_context(sync_findings: list[UrlFinding]) -> bool:
    for finding in sync_findings:
        if finding.rule in COMBO_CONTEXT_RULES and finding.points > 0:
            return True
    return False


def evaluate_newly_registered_domain(
    registered: str,
    age_days: int | None,
    sync_findings: list[UrlFinding],
) -> list[UrlFinding]:
    if age_days is None:
        return []

    if age_days > RECENT_MAX_DAYS:
        return []

    has_context = has_combo_url_context(sync_findings)

    if age_days < VERY_NEW_MAX_DAYS:
        if has_context:
            points = POINTS_VERY_NEW_WITH_CONTEXT
            tier = "A"
            detail = (
                f"Domain '{registered}' was registered {age_days} days ago "
                f"(under {VERY_NEW_MAX_DAYS} days) with other suspicious URL signals."
            )
        else:
            points = POINTS_VERY_NEW_STANDALONE
            tier = "C"
            detail = (
                f"Domain '{registered}' was registered {age_days} days ago "
                f"(under {VERY_NEW_MAX_DAYS} days; weak standalone signal)."
            )
    else:
        if not has_context:
            return []
        points = POINTS_RECENT_WITH_CONTEXT
        tier = "B"
        detail = (
            f"Domain '{registered}' was registered {age_days} days ago "
            f"(under {RECENT_MAX_DAYS} days) with other suspicious URL signals."
        )

    return [
        UrlFinding(
            rule=RULE_NEWLY_REGISTERED_DOMAIN,
            points=points,
            detail=detail,
            tier=tier,
        )
    ]


async def check_newly_registered_domain(
    host: str,
    sync_findings: list[UrlFinding],
    http_client: httpx.AsyncClient,
    *,
    whitelist_trusted: bool = False,
) -> list[UrlFinding]:
    registered = registered_domain_for_host(host)
    if registered == "":
        return []

    if should_skip_rdap_lookup(registered, whitelist_trusted=whitelist_trusted):
        return []

    try:
        age_days = await fetch_domain_age_days(http_client, registered)
    except Exception:
        return []

    return evaluate_newly_registered_domain(registered, age_days, sync_findings)
