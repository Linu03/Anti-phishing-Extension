import ipaddress
import math
import re
from urllib.parse import ParseResult

import tldextract

from app.layers.url_analyzer.finding import UrlFinding


def _path_and_query_text(parsed: ParseResult) -> str:
    path = parsed.path or ""
    query = parsed.query
    if query is None or query == "":
        return path
    return path + "?" + query


def _collect_url_parts(host: str, parsed: ParseResult) -> list[str]:
    parts: list[str] = []

    for label in host.split("."):
        label = label.strip().lower()
        if label != "":
            parts.append(label)

    path_text = _path_and_query_text(parsed)
    for segment in path_text.replace("?", "/").split("/"):
        segment = segment.strip().lower()
        if segment != "":
            parts.append(segment)

    return parts


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


# Rule 5: encoding suspect in path + query
MIN_VALID_PERCENT_SEQUENCES = 3
POINTS_SUSPICIOUS_ENCODING = 10
PERCENT_XX_PATTERN = re.compile(r"%[0-9A-Fa-f]{2}")


def check_suspicious_encoding(parsed: ParseResult) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    target = _path_and_query_text(parsed)

    valid_sequences = PERCENT_XX_PATTERN.findall(target)
    valid_count = len(valid_sequences)
    percent_sign_count = target.count("%")

    if valid_count >= MIN_VALID_PERCENT_SEQUENCES:
        findings.append(
            UrlFinding(
                rule="suspicious_encoding",
                points=POINTS_SUSPICIOUS_ENCODING,
                detail=(
                    f"Path or query has {valid_count} percent-encoded sequences "
                    f"({MIN_VALID_PERCENT_SEQUENCES} or more is suspicious)."
                ),
            )
        )
        return findings

    # % without two hex digits after 
    if percent_sign_count > valid_count:
        findings.append(
            UrlFinding(
                rule="suspicious_encoding",
                points=POINTS_SUSPICIOUS_ENCODING,
                detail="Path or query has invalid or incomplete percent-encoding.",
            )
        )

    return findings


# Rule 6: Phishing keywords - match on parts of host/path
MIN_KEYWORD_HITS = 2
POINTS_PHISHING_KEYWORDS = 6

PHISHING_KEYWORDS = {
    "login",
    "signin",
    "verify",
    "secure",
    "account",
    "password",
    "update",
    "confirm",
    "banking",
    "wallet",
    "oauth",
    "suspend",
}


def _keyword_part_variants(part: str) -> list[str]:
    lowered = part.lower()
    variants = [lowered]
    without_dash = lowered.replace("-", "")
    if without_dash != lowered and without_dash != "":
        variants.append(without_dash)
    return variants


def check_phishing_keywords(host: str, parsed: ParseResult) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    hits: list[str] = []
    already_seen: set[str] = set()

    for part in _collect_url_parts(host, parsed):
        for variant in _keyword_part_variants(part):
            if variant in PHISHING_KEYWORDS and variant not in already_seen:
                already_seen.add(variant)
                hits.append(variant)

    if len(hits) >= MIN_KEYWORD_HITS:
        hit_text = ", ".join(hits)
        findings.append(
            UrlFinding(
                rule="phishing_keywords",
                points=POINTS_PHISHING_KEYWORDS,
                detail=(
                    f"URL parts match suspicious keywords: {hit_text} "
                    f"({MIN_KEYWORD_HITS} or more)."
                ),
            )
        )

    return findings


# Rule 9: high entropy hostname label
MIN_LABEL_LENGTH_FOR_ENTROPY = 8
MIN_ENTROPY = 3
POINTS_HIGH_ENTROPY = 8


def _shannon_entropy(text: str) -> float:
    if text == "":
        return 0.0

    length = len(text)
    counts: dict[str, int] = {}

    for char in text:
        if char in counts:
            counts[char] = counts[char] + 1
        else:
            counts[char] = 1

    entropy = 0.0
    for count in counts.values():
        probability = count / length
        entropy = entropy - (probability * math.log2(probability))

    return entropy


def _hostname_label_for_entropy(host: str) -> str | None:
    extracted = tldextract.extract(host)
    if extracted.domain == "":
        return None

    return extracted.domain.lower()


def check_high_entropy_hostname(host: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    label = _hostname_label_for_entropy(host)
    if label is None:
        return findings

    if "-" in label or "_" in label:
        return findings

    if len(label) < MIN_LABEL_LENGTH_FOR_ENTROPY:
        return findings

    entropy = _shannon_entropy(label)
    if entropy < MIN_ENTROPY:
        return findings

    entropy_text = f"{entropy:.2f}"
    findings.append(
        UrlFinding(
            rule="high_entropy_hostname",
            points=POINTS_HIGH_ENTROPY,
            detail=(
                f'Hostname label "{label}" has high entropy ({entropy_text}, '
                f"limit {MIN_ENTROPY})."
            ),
        )
    )

    return findings


# Unicode normalization changed the URL (hidden homograph / invisible chars)
POINTS_UNICODE_NORMALIZATION = 8


def check_unicode_normalization(url_raw: str, url_clean: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    if url_raw == url_clean:
        return findings

    findings.append(
        UrlFinding(
            rule="unicode_normalization",
            points=POINTS_UNICODE_NORMALIZATION,
            detail=(
                "URL was changed by Unicode normalization "
                "(possible homograph or invisible characters)."
            ),
        )
    )

    return findings


# Rule 10: IDN / homograph (host + path + query)
POINTS_IDN_HOMOGRAPH = 10


def _text_has_punycode_label(text: str) -> bool:
    text_lower = text.lower()
    for label in text_lower.split("."):
        if label.startswith("xn--"):
            return True
    return False


def _text_has_non_ascii(text: str) -> bool:
    for char in text:
        if ord(char) > 127:
            return True
    return False


def _idn_reasons_for_text(text: str) -> list[str]:
    reasons: list[str] = []
    if _text_has_punycode_label(text):
        reasons.append("Punycode label (xn--)")
    if _text_has_non_ascii(text):
        reasons.append("non-ASCII characters")
    return reasons


def check_idn_homograph(host: str, parsed: ParseResult) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    host_reasons = _idn_reasons_for_text(host)
    if len(host_reasons) > 0:
        reason_text = ", ".join(host_reasons)
        findings.append(
            UrlFinding(
                rule="idn_homograph",
                points=POINTS_IDN_HOMOGRAPH,
                detail=(
                    f"Host has {reason_text} (possible homograph or IDN abuse)."
                ),
            )
        )

    path_and_query = _path_and_query_text(parsed)
    if path_and_query == "":
        return findings

    path_reasons = _idn_reasons_for_text(path_and_query)
    if len(path_reasons) > 0:
        reason_text = ", ".join(path_reasons)
        findings.append(
            UrlFinding(
                rule="idn_homograph",
                points=POINTS_IDN_HOMOGRAPH,
                detail=(
                    f"Path or query has {reason_text} "
                    "(possible homograph or IDN abuse)."
                ),
            )
        )

    return findings
