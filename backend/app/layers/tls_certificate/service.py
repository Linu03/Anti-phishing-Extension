from __future__ import annotations

from dataclasses import asdict
from urllib.parse import ParseResult

from app.core.url_normalize import parse_http_url
from app.layers.tls_certificate.cache import (
    get_cached_response,
    make_cache_key,
    set_cached_response,
    ttl_seconds_from_inspection,
)
from app.layers.tls_certificate.finding import TlsFinding
from app.layers.tls_certificate.inspector import inspect_tls
from app.layers.tls_certificate.rules import check_certificate, check_no_https
from app.layers.url_analyzer.official_domains import is_official_registered_domain

OFFICIAL_TLS_SOFT_RULES = frozenset({"untrusted_chain"})

MAX_LAYER_SCORE = 40


def _findings_to_dict_list(findings: list[TlsFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def _build_result( host: str, parsed: ParseResult, all_findings: list[TlsFinding], inspection: dict | None) -> dict:
    score = 0
    for f in all_findings:
        score = score + f.points

    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    issuer: str | None = None
    not_before: str | None = None
    not_after: str | None = None

    if inspection is not None:
        cert = inspection.get("cert")
        if cert is not None:
            issuer = cert.get("issuer") or None
            not_before = cert.get("not_before")
            not_after = cert.get("not_after")

    return {
        "score": score,
        "host": host,
        "scheme": parsed.scheme,
        "issuer": issuer,
        "not_before": not_before,
        "not_after": not_after,
        "findings": _findings_to_dict_list(all_findings),
    }


async def analyze_tls(url: str) -> dict:
    parsed = parse_http_url(url)
    host = parsed.hostname or ""

    all_findings: list[TlsFinding] = []

    no_https_findings = check_no_https(parsed)
    all_findings.extend(no_https_findings)

    if len(no_https_findings) > 0:
        return _build_result(host, parsed, all_findings, None)

    cache_key = make_cache_key(host, parsed.port)
    cached_response = get_cached_response(cache_key)
    if cached_response is not None:
        return cached_response

    inspection = await inspect_tls(parsed)

    cert_findings = check_certificate(inspection, host)
    if (
        is_official_registered_domain(host)
        and inspection.get("handshake_ok") is True
    ):
        cert_findings = [
            item
            for item in cert_findings
            if item.rule not in OFFICIAL_TLS_SOFT_RULES
        ]
    all_findings.extend(cert_findings)

    result = _build_result(host, parsed, all_findings, inspection)

    ttl_seconds = ttl_seconds_from_inspection(inspection)
    set_cached_response(cache_key, result, ttl_seconds)

    return result
