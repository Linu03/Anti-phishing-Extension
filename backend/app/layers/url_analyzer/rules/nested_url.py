from __future__ import annotations

import re
from urllib.parse import ParseResult, parse_qs, unquote

from app.core.url_normalize import lookup_key_from_parsed, normalize_url_input, parse_http_url
from app.layers.url_analyzer.brand_registry import BrandRegistry
from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.brand_impersonation import check_brand_in_subdomain
from app.layers.url_analyzer.rules.patterns import (
    check_idn_homograph,
    check_unicode_normalization,
)
from app.layers.url_analyzer.rules.typosquatting import (
    _is_legitimate_host,
    check_typosquatting,
)

POINTS_NESTED_URL_IN_QUERY = 12

# Common redirect / wrapper query keys
QUERY_PARAM_NAMES = frozenset(
    {
        "q",
        "url",
        "u",
        "redirect",
        "redirect_url",
        "next",
        "continue",
        "dest",
        "destination",
        "target",
        "return",
        "returnurl",
        "goto",
    }
)

HTTP_URL_IN_TEXT = re.compile(r"https?://[^\s&\"'<>]+", re.IGNORECASE)

DOMAIN_LIKE_VALUE = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}$", re.IGNORECASE)


def _trim_url_token(url: str) -> str:
    return url.strip().rstrip(".,);]")


def _extract_nested_url_candidates(query: str) -> list[tuple[str, str]]:
    if query is None or query == "":
        return []

    seen: set[str] = set()
    candidates: list[tuple[str, str]] = []

    def add(param: str, raw_url: str) -> None:
        url = _trim_url_token(raw_url)
        if url == "":
            return
        key = url.lower()
        if key in seen:
            return
        seen.add(key)
        candidates.append((param, url))

    for match in HTTP_URL_IN_TEXT.finditer(query):
        add("embedded", match.group(0))

    for part in query.split("&"):
        if "=" not in part:
            continue
        name, _, value = part.partition("=")
        name = unquote(name).lower()
        value = unquote(value)
        if value == "":
            continue

        value_stripped = value.strip()
        if value_stripped.lower().startswith(("http://", "https://")):
            add(name, value_stripped)
            continue

        if name in QUERY_PARAM_NAMES and DOMAIN_LIKE_VALUE.match(value_stripped):
            add(name, value_stripped)

    # parse_qs catches repeated keys and proper decoding
    try:
        parsed_params = parse_qs(query, keep_blank_values=False)
    except ValueError:
        parsed_params = {}

    for name, values in parsed_params.items():
        name_lower = name.lower()
        for value in values:
            value_stripped = value.strip()
            if value_stripped == "":
                continue
            if value_stripped.lower().startswith(("http://", "https://")):
                add(name_lower, value_stripped)
            elif name_lower in QUERY_PARAM_NAMES and DOMAIN_LIKE_VALUE.match(
                value_stripped
            ):
                add(name_lower, value_stripped)

    return candidates


def _suspicious_reasons_for_nested_url(nested_url: str, registry: BrandRegistry) -> list[str]:
    url_raw, url_clean = normalize_url_input(nested_url)

    try:
        parsed = parse_http_url(url_clean)
    except ValueError:
        return []

    _, host = lookup_key_from_parsed(parsed)
    if _is_legitimate_host(host, registry):
        return []

    reasons: list[str] = []

    for finding in check_unicode_normalization(url_raw, url_clean):
        reasons.append(finding.detail)

    for finding in check_typosquatting(host, registry):
        reasons.append(finding.detail)

    for finding in check_brand_in_subdomain(host, registry):
        reasons.append(finding.detail)

    for finding in check_idn_homograph(host, parsed):
        reasons.append(finding.detail)

    return reasons


def check_nested_url_in_query(parsed: ParseResult, registry: BrandRegistry) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    query = parsed.query
    if query is None or query == "":
        return findings

    for param_name, nested_url in _extract_nested_url_candidates(query):
        reasons = _suspicious_reasons_for_nested_url(nested_url, registry)
        if len(reasons) == 0:
            continue

        reason_text = reasons[0]
        if len(reasons) > 1:
            reason_text = f"{reason_text} (+{len(reasons) - 1} more signal(s))"

        findings.append(
            UrlFinding(
                rule="nested_url_in_query",
                points=POINTS_NESTED_URL_IN_QUERY,
                detail=(
                    f'Query parameter "{param_name}" contains suspicious destination '
                    f'"{nested_url}": {reason_text}'
                ),
            )
        )

    return findings


