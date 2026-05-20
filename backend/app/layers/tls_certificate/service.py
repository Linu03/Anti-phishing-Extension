from __future__ import annotations

from dataclasses import asdict
from urllib.parse import ParseResult

from app.core.url_normalize import parse_http_url
from app.layers.tls_certificate.finding import TlsFinding
from app.layers.tls_certificate.rules import check_no_https

MAX_LAYER_SCORE = 40


def _findings_to_dict_list(findings: list[TlsFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def _build_result(host: str, parsed: ParseResult, all_findings: list[TlsFinding]) -> dict:
    score = 0
    for f in all_findings:
        score = score + f.points

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


async def analyze_tls(url: str) -> dict:
    parsed = parse_http_url(url)
    host = parsed.hostname or ""

    all_findings: list[TlsFinding] = []

    no_https_findings = check_no_https(parsed)
    all_findings.extend(no_https_findings)

    if len(no_https_findings) > 0:
        return _build_result(host, parsed, all_findings)

    return _build_result(host, parsed, all_findings)
