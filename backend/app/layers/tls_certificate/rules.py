from urllib.parse import ParseResult

from app.layers.tls_certificate.finding import TlsFinding

POINTS_NO_HTTPS = 10


def check_no_https(parsed: ParseResult) -> list[TlsFinding]:
    findings: list[TlsFinding] = []
    scheme = (parsed.scheme or "").lower()

    if scheme == "https":
        return findings

    findings.append(
        TlsFinding(
            rule="no_https",
            points=POINTS_NO_HTTPS,
            detail="URL is not https; traffic is not encrypted.",
        )
    )

    return findings

