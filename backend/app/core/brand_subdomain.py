from __future__ import annotations

import re

import tldextract

MIN_TOKEN_BRAND_REGEX_LENGTH = 4


def _subdomain_tokens(host: str) -> list[str]:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.subdomain == "":
        return []

    labels: list[str] = []
    for part in extracted.subdomain.split("."):
        part = part.strip().lower()
        if part != "" and part != "www":
            labels.append(part)

    if len(labels) == 0:
        return []

    tokens: list[str] = []
    subdomain_text = ".".join(labels)
    for token in re.split(r"[-_.]+", subdomain_text):
        token = token.strip().lower()
        if token != "":
            tokens.append(token)

    return tokens


def detect_brand_in_subdomain(host: str, brands: list[str]) -> str | None:
    """Return the first impersonation brand id found in the host subdomain tokens."""
    tokens = _subdomain_tokens(host)
    if len(tokens) == 0:
        return None

    ordered_brands = sorted(
        {brand.strip().lower() for brand in brands if brand.strip() != ""},
        key=len,
        reverse=True,
    )

    for brand in ordered_brands:
        if len(brand) < MIN_TOKEN_BRAND_REGEX_LENGTH:
            for token in tokens:
                if token == brand:
                    return brand
            continue

        pattern = re.compile(rf"\b{re.escape(brand)}\b", re.IGNORECASE)
        for token in tokens:
            if pattern.search(token):
                return brand

    return None
