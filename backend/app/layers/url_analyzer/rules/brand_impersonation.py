from __future__ import annotations

import tldextract

from app.layers.url_analyzer.brand_registry import BrandRegistry
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.patterns import PHISHING_KEYWORDS
from app.layers.url_analyzer.rules.suspicious_tld import TLD_RESEARCH_WEIGHT
from app.layers.url_analyzer.rules.typosquatting import (
    _is_legitimate_host,
    _registered_domain,
    _second_level_domain,
)

POINTS_BRAND_IN_SUBDOMAIN = 14

MIN_KEYWORD_HITS_ON_REGISTERED_SLD = 2


def _subdomain_labels(host: str) -> list[str]:
    extracted = tldextract.extract(host)
    if extracted.subdomain == "":
        return []

    labels: list[str] = []
    for part in extracted.subdomain.split("."):
        part = part.strip().lower()
        if part != "":
            labels.append(part)
    return labels


def _registered_suffix_is_suspicious(host: str) -> bool:
    extracted = tldextract.extract(host)
    if extracted.suffix == "":
        return False

    suffix = extracted.suffix.lower()
    return suffix in TLD_RESEARCH_WEIGHT


def _keyword_hit_count_in_label(text: str) -> int:
    hits: set[str] = set()
    normalized = text.lower().replace("-", " ").replace("_", " ")
    for token in normalized.split():
        if token in PHISHING_KEYWORDS:
            hits.add(token)
    return len(hits)


def _registered_domain_looks_risky(host: str) -> bool:
    if _registered_suffix_is_suspicious(host):
        return True

    sld = _second_level_domain(host)
    if sld is None:
        return False

    return _keyword_hit_count_in_label(sld) >= MIN_KEYWORD_HITS_ON_REGISTERED_SLD


def _find_brand_dot_tld_impersonation(
    labels: list[str], registered: str, registry: BrandRegistry
) -> list[str]:
    reasons: list[str] = []

    for index in range(len(labels) - 1):
        brand_part = labels[index]
        tld_part = labels[index + 1]

        if brand_part not in registry.brands_exact:
            continue

        fake_brand_domain = f"{brand_part}.{tld_part}"
        if registered == fake_brand_domain:
            continue

        reasons.append(
            f'subdomain labels "{brand_part}.{tld_part}" impersonate brand "{brand_part}" '
            f"(registered domain is {registered})"
        )

    return reasons


def check_brand_in_subdomain(host: str, registry: BrandRegistry) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    if _is_legitimate_host(host, registry):
        return findings

    registered = _registered_domain(host)
    if registered is None:
        return findings

    labels = _subdomain_labels(host)
    if len(labels) == 0:
        return findings

    reasons = _find_brand_dot_tld_impersonation(labels, registered, registry)

    if len(reasons) == 0 and _registered_domain_looks_risky(host):
        for label in labels:
            if "." in label:
                continue

            if label not in registry.brands_exact:
                continue

            if registered.startswith(label + "."):
                continue

            reasons.append(
                f'subdomain label "{label}" on risky host "{registered}" '
                f"(possible brand impersonation)"
            )
            break

    if len(reasons) == 0:
        return findings

    detail_text = "; ".join(reasons)
    findings.append(
        UrlFinding(
            rule="brand_in_subdomain",
            points=POINTS_BRAND_IN_SUBDOMAIN,
            detail=f"{detail_text}.",
        )
    )

    return findings
