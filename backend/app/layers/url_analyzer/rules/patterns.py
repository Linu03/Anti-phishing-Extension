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
