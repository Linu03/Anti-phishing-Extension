from __future__ import annotations

from dataclasses import asdict

from app.core.url_normalize import lookup_key_from_parsed, parse_http_url
from app.layers.url_analyzer.brand_registry import get_brand_registry
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.patterns import (
    check_at_in_url,
    check_ip_host,
    check_many_subdomains,
    check_phishing_keywords,
    check_suspicious_encoding,
    check_url_too_long,
)
from app.layers.url_analyzer.rules.typosquatting import check_typosquatting

# maximum score for this layer
MAX_LAYER_SCORE = 50


def _findings_to_dict_list(findings: list[UrlFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def analyze_url(url: str) -> dict:
    parsed = parse_http_url(url)
    normalized_key, host = lookup_key_from_parsed(parsed)

    all_findings: list[UrlFinding] = []

    all_findings.extend(check_url_too_long(url))  # Rule 1
    all_findings.extend(check_many_subdomains(host))  # Rule 2
    all_findings.extend(check_at_in_url(parsed))  # Rule 3
    all_findings.extend(check_ip_host(host))  # Rule 4
    all_findings.extend(check_suspicious_encoding(parsed))  # Rule 5
    all_findings.extend(check_phishing_keywords(host, parsed))  # Rule 6
    all_findings.extend(check_typosquatting(host, get_brand_registry()))  # Rule 7

    score = 0
    for f in all_findings:
        score = score + f.points

    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    return {
        "score": score,
        "host": host,
        "url_normalized": normalized_key,
        "findings": _findings_to_dict_list(all_findings),
    }
