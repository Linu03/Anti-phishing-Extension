from __future__ import annotations

from dataclasses import asdict

import httpx

from app.core.url_normalize import lookup_key_from_parsed, normalize_url_input, parse_http_url
from app.layers.url_analyzer.brand_registry import get_brand_registry
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.patterns import (
    check_at_in_url,
    check_high_entropy_hostname,
    check_idn_homograph,
    check_ip_host,
    check_many_subdomains,
    check_phishing_keywords,
    check_suspicious_encoding,
    check_unicode_normalization,
    check_url_too_long,
)
from app.layers.url_analyzer.risk import url_risk_from_score, url_risk_label
from app.layers.url_analyzer.rules.combosquatting_label import check_combosquatting_label
from app.layers.url_analyzer.rules.hosting_brand_matrix import check_hosting_brand_matrix
from app.layers.url_analyzer.rules.nested_url import check_nested_url_in_query
from app.layers.url_analyzer.rules.newly_registered import check_newly_registered_domain
from app.layers.url_analyzer.rules.suspicious_tld import check_suspicious_tld
from app.layers.url_analyzer.rules.typosquatting import check_typosquatting

MAX_LAYER_SCORE = 50


def _findings_to_dict_list(findings: list[UrlFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def _run_sync_url_rules(url: str) -> tuple[list[UrlFinding], str, str]:
    url_raw, url_clean = normalize_url_input(url)

    parsed = parse_http_url(url_clean)
    normalized_key, host = lookup_key_from_parsed(parsed)

    all_findings: list[UrlFinding] = []

    all_findings.extend(check_unicode_normalization(url_raw, url_clean))
    all_findings.extend(check_url_too_long(url_clean))
    all_findings.extend(check_many_subdomains(host))
    all_findings.extend(check_at_in_url(parsed))
    all_findings.extend(check_ip_host(host))
    all_findings.extend(check_suspicious_encoding(parsed))
    all_findings.extend(check_phishing_keywords(host, parsed))
    registry = get_brand_registry()
    all_findings.extend(check_typosquatting(host, registry))
    all_findings.extend(check_combosquatting_label(host))
    all_findings.extend(check_hosting_brand_matrix(host))
    all_findings.extend(check_suspicious_tld(host))
    all_findings.extend(check_high_entropy_hostname(host))
    all_findings.extend(check_idn_homograph(host, parsed))
    all_findings.extend(check_nested_url_in_query(parsed, registry))

    return all_findings, host, normalized_key


def _build_result(
    all_findings: list[UrlFinding],
    host: str,
    normalized_key: str,
) -> dict:
    score = 0
    for finding in all_findings:
        score = score + finding.points

    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    risk = url_risk_from_score(score)

    return {
        "score": score,
        "risk": risk,
        "risk_label": url_risk_label(risk),
        "host": host,
        "url_normalized": normalized_key,
        "findings": _findings_to_dict_list(all_findings),
    }


def analyze_url(url: str) -> dict:
    findings, host, normalized_key = _run_sync_url_rules(url)
    return _build_result(findings, host, normalized_key)


async def analyze_url_with_rdap(
    url: str,
    http_client: httpx.AsyncClient,
    *,
    whitelist_trusted: bool = False,
) -> dict:
    findings, host, normalized_key = _run_sync_url_rules(url)

    try:
        findings.extend(
            await check_newly_registered_domain(
                host,
                findings,
                http_client,
                whitelist_trusted=whitelist_trusted,
            )
        )
    except Exception:
        pass

    return _build_result(findings, host, normalized_key)
