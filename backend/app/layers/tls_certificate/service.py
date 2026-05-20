from __future__ import annotations

from dataclasses import asdict

from app.core.url_normalize import parse_http_url
from app.layers.tls_certificate.finding import TlsFinding

MAX_LAYER_SCORE = 40


def _findings_to_dict_list(findings: list[TlsFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


async def analyze_tls(url: str) -> dict:
    parsed = parse_http_url(url)
    host = parsed.hostname or ""

    all_findings: list[TlsFinding] = []

    score = 0
    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    return {
        "score": score,
        "host": host,
        "scheme": parsed.scheme,
        "issuer": None,
        "not_before": None,
        "not_after": None,
        "findings": _findings_to_dict_list(all_findings),
    }


