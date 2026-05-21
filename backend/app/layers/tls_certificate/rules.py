from __future__ import annotations
from datetime import datetime, timezone
from urllib.parse import ParseResult
from app.layers.tls_certificate.finding import TlsFinding

POINTS_NO_HTTPS = 10
POINTS_CERT_EXPIRED = 15
POINTS_HOSTNAME_MISMATCH = 15
POINTS_SELF_SIGNED = 10
POINTS_UNTRUSTED_CHAIN = 10
POINTS_CERT_VERY_NEW = 5
POINTS_ISSUER_INFO = 0
CERT_VERY_NEW_MAX_DAYS = 14


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


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _is_expired_now(not_after_iso: str | None) -> tuple[bool, int]:
    not_after = _parse_iso_datetime(not_after_iso)
    if not_after is None:
        return False, 0

    now = datetime.now(tz=timezone.utc)
    if now <= not_after:
        return False, 0

    delta = now - not_after
    return True, delta.days


def _certificate_age_in_days(not_before_iso: str | None) -> int | None:
    not_before = _parse_iso_datetime(not_before_iso)
    if not_before is None:
        return None

    now = datetime.now(tz=timezone.utc)
    if now < not_before:
        return None

    delta = now - not_before
    return delta.days




def _hostname_matches_one(host: str, pattern: str) -> bool:
    host_lower = host.lower()
    pattern_lower = pattern.lower()

    if pattern_lower.startswith("*."):
        suffix = pattern_lower[2:]
        if "." not in host_lower:
            return False
        host_parent = host_lower.split(".", 1)[1]
        return host_parent == suffix

    return host_lower == pattern_lower


def _hostname_matches_any(host: str, san_list: list[str] | None) -> bool:
    if san_list is None:
        return False
    if len(san_list) == 0:
        return False

    for pattern in san_list:
        if _hostname_matches_one(host, pattern):
            return True

    return False


def check_cert_expired(inspection: dict) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    error = inspection.get("error")
    cert = inspection.get("cert")

    not_after_iso: str | None = None
    if cert is not None:
        not_after_iso = cert.get("not_after")

    expired_by_date, days_ago = _is_expired_now(not_after_iso)
    expired_by_error = error == "expired"

    if not expired_by_date and not expired_by_error:
        return findings

    if days_ago > 0:
        detail = f"Certificate has expired ({days_ago} days ago)."
    else:
        detail = "Certificate has expired."

    findings.append(
        TlsFinding(
            rule="cert_expired",
            points=POINTS_CERT_EXPIRED,
            detail=detail,
        )
    )

    return findings


def check_hostname_mismatch(inspection: dict, host: str) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    error = inspection.get("error")
    cert = inspection.get("cert")

    san_list: list[str] | None = None
    if cert is not None:
        san_list = cert.get("san")

    error_says_mismatch = error == "hostname_mismatch"

    cert_says_mismatch = False
    if cert is not None and san_list is not None:
        if not _hostname_matches_any(host, san_list):
            cert_says_mismatch = True

    if not error_says_mismatch and not cert_says_mismatch:
        return findings

    if san_list is not None and len(san_list) > 0:
        san_text = ", ".join(san_list)
        detail = f"Hostname '{host}' does not match certificate SAN ({san_text})."
    else:
        detail = f"Hostname '{host}' does not match certificate SAN."

    findings.append(
        TlsFinding(
            rule="hostname_mismatch",
            points=POINTS_HOSTNAME_MISMATCH,
            detail=detail,
        )
    )

    return findings


def _is_self_signed_by_cert(cert: dict | None) -> bool:
    if cert is None:
        return False

    subject = cert.get("subject") or ""
    issuer = cert.get("issuer") or ""

    if subject == "" or issuer == "":
        return False

    return subject == issuer


def check_self_signed(inspection: dict) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    error = inspection.get("error")
    cert = inspection.get("cert")

    error_says_self_signed = error == "self_signed"
    cert_says_self_signed = _is_self_signed_by_cert(cert)

    if error_says_self_signed and not cert_says_self_signed:
        return findings

    if not error_says_self_signed and not cert_says_self_signed:
        return findings

    findings.append(
        TlsFinding(
            rule="self_signed",
            points=POINTS_SELF_SIGNED,
            detail="Certificate is self-signed (subject equals issuer).",
        )
    )

    return findings


def check_untrusted_chain(inspection: dict) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    error = inspection.get("error")
    cert = inspection.get("cert")

    is_untrusted = False

    if error == "untrusted_chain":
        is_untrusted = True

    if error == "self_signed" and not _is_self_signed_by_cert(cert):
        is_untrusted = True

    if not is_untrusted:
        return findings

    findings.append(
        TlsFinding(
            rule="untrusted_chain",
            points=POINTS_UNTRUSTED_CHAIN,
            detail="Certificate chain does not lead to a trusted root.",
        )
    )

    return findings


def check_cert_very_new(inspection: dict) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    cert = inspection.get("cert")
    if cert is None:
        return findings

    not_before_iso = cert.get("not_before")
    age_in_days = _certificate_age_in_days(not_before_iso)

    if age_in_days is None:
        return findings

    if age_in_days >= CERT_VERY_NEW_MAX_DAYS:
        return findings

    detail = (
        f"Certificate was issued {age_in_days} days ago "
        f"(less than {CERT_VERY_NEW_MAX_DAYS} days)."
    )

    findings.append(
        TlsFinding(
            rule="cert_very_new",
            points=POINTS_CERT_VERY_NEW,
            detail=detail,
        )
    )

    return findings


def check_issuer_info(inspection: dict) -> list[TlsFinding]:
    findings: list[TlsFinding] = []

    cert = inspection.get("cert")
    if cert is None:
        return findings

    issuer = cert.get("issuer") or ""
    if issuer == "":
        return findings

    detail = f"Certificate issuer: {issuer}"

    findings.append(
        TlsFinding(
            rule="issuer_info",
            points=POINTS_ISSUER_INFO,
            detail=detail,
        )
    )

    return findings




def check_certificate(inspection: dict, host: str) -> list[TlsFinding]:
    findings: list[TlsFinding] = []
    cert = inspection.get("cert")
    if cert is not None:
        findings.extend(check_issuer_info(inspection))
        findings.extend(check_cert_very_new(inspection))

    if inspection.get("handshake_ok") is True:
        return findings

    if inspection.get("reachable") is not True:
        return findings

    findings.extend(check_cert_expired(inspection))
    findings.extend(check_hostname_mismatch(inspection, host))
    findings.extend(check_self_signed(inspection))
    findings.extend(check_untrusted_chain(inspection))

    return findings


