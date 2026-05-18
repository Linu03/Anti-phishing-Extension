import ipaddress
from urllib.parse import ParseResult

from app.layers.url_analyzer.finding import UrlFinding

# Rule 1 : URL is too long
MAX_URL_LENGTH = 200
POINTS_URL_TOO_LONG = 10


def check_url_too_long(full_url: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    url_length = len(full_url)

    if url_length > MAX_URL_LENGTH:
        findings.append(
            UrlFinding(
                rule="url_too_long",
                points=POINTS_URL_TOO_LONG,
                detail=f"URL length is {url_length} characters (limit {MAX_URL_LENGTH}).",
            )
        )

    return findings


# Rule 2 : Many subdomains
MIN_SUBDOMAINS_FOR_FLAG = 3
POINTS_MANY_SUBDOMAINS = 12


def _count_subdomains(host: str) -> int:
    parts = host.split(".")
    if len(parts) <= 2:
        return 0
    return len(parts) - 2


def check_many_subdomains(host: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    subdomain_count = _count_subdomains(host)

    if subdomain_count >= MIN_SUBDOMAINS_FOR_FLAG:
        findings.append(
            UrlFinding( rule="many_subdomains", points=POINTS_MANY_SUBDOMAINS,
                detail=(
                    f"Host has {subdomain_count} subdomains "
                    f"({MIN_SUBDOMAINS_FOR_FLAG} or more is suspicious)."
                    ),
            )
        )

    return findings


# Rule 3: @ in URL (parsed comes from url_normalize.parse_http_url)
POINTS_AT_IN_URL = 15


def check_at_in_url(parsed: ParseResult) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    if parsed.username is not None:
        findings.append(
            UrlFinding(
                rule="at_in_url",
                points=POINTS_AT_IN_URL,
                detail="URL contains userinfo before @ (common phishing trick).",
            )
        )

    return findings


# Rule 4: host is an IP address
POINTS_IP_HOST = 15


def check_ip_host(host: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    try:
        ipaddress.ip_address(host)
    except ValueError:
        return findings

    findings.append(
        UrlFinding(
            rule="ip_host",
            points=POINTS_IP_HOST,
            detail=f"Host is an IP address ({host}), not a domain name.",
        )
    )

    return findings


# Rule 5: too many % in path + query
MIN_PERCENT_SIGNS = 4
POINTS_SUSPICIOUS_ENCODING = 10


def _path_and_query_text(parsed: ParseResult) -> str:
    path = parsed.path or ""
    query = parsed.query
    if query is None or query == "":
        return path
    return path + "?" + query


def check_suspicious_encoding(parsed: ParseResult) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    target = _path_and_query_text(parsed)
    percent_count = target.count("%")

    if percent_count >= MIN_PERCENT_SIGNS:
        findings.append(
            UrlFinding(
                rule="suspicious_encoding",
                points=POINTS_SUSPICIOUS_ENCODING,
                detail=(
                    f"Path or query has {percent_count} percent signs "
                    f"({MIN_PERCENT_SIGNS} or more is suspicious)."
                ),
            )
        )

    return findings
