from __future__ import annotations

from dataclasses import asdict

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
from app.layers.url_analyzer.rules.hosting_brand_matrix import check_hosting_brand_matrix
from app.layers.url_analyzer.rules.nested_url import check_nested_url_in_query
from app.layers.url_analyzer.rules.suspicious_tld import check_suspicious_tld
from app.layers.url_analyzer.rules.typosquatting import check_typosquatting

MAX_LAYER_SCORE = 50


def _findings_to_dict_list(findings: list[UrlFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def analyze_url(url: str) -> dict:
    url_raw, url_clean = normalize_url_input(url)

    parsed = parse_http_url(url_clean)
    normalized_key, host = lookup_key_from_parsed(parsed)

    all_findings: list[UrlFinding] = []

    all_findings.extend(check_unicode_normalization(url_raw, url_clean)) # Rule 1
    all_findings.extend(check_url_too_long(url_clean)) # Rule 2
    all_findings.extend(check_many_subdomains(host))    # Rule 3
    all_findings.extend(check_at_in_url(parsed))        # Rule 4
    all_findings.extend(check_ip_host(host))            # Rule 5
    all_findings.extend(check_suspicious_encoding(parsed)) # Rule 6
    all_findings.extend(check_phishing_keywords(host, parsed)) # Rule 7
    registry = get_brand_registry()
    all_findings.extend(check_typosquatting(host, registry))  # Rule 8
    all_findings.extend(check_hosting_brand_matrix(host))  # Rule 8b
    all_findings.extend(check_suspicious_tld(host))  # Rule 9
    all_findings.extend(check_high_entropy_hostname(host))  # Rule 10
    all_findings.extend(check_idn_homograph(host, parsed))  # Rule 11
    all_findings.extend(check_nested_url_in_query(parsed, registry))  # Rule 12

    score = 0
    for f in all_findings:
        score = score + f.points

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
