from __future__ import annotations

from dataclasses import asdict

from app.core.url_normalize import normalize_for_lookup
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.patterns import check_url_too_long

# Maximum score for this layer (each new rule can increase the total)
MAX_LAYER_SCORE = 50


def _findings_to_dict_list(findings: list[UrlFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def analyze_url(url: str) -> dict:
    normalized_key, host = normalize_for_lookup(url)

    all_findings: list[UrlFinding] = []

    all_findings.extend(check_url_too_long(url))        # Rule 1
    


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
