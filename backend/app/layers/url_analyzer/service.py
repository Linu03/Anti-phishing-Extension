from __future__ import annotations

from dataclasses import asdict

from app.core.url_normalize import lookup_key_from_parsed, parse_http_url
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.patterns import (
    check_at_in_url,
    check_many_subdomains,
    check_url_too_long,
)

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

    all_findings.extend(check_url_too_long(url))  # Regula 1
    all_findings.extend(check_many_subdomains(host))  # Regula 2
    all_findings.extend(check_at_in_url(parsed))  # Regula 3

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
