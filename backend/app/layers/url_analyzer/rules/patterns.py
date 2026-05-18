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
