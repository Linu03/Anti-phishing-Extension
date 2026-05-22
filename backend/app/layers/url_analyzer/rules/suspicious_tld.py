from __future__ import annotations

import tldextract

from app.layers.url_analyzer.finding import UrlFinding

# Research weights (10-90). Sources: Interisle Phishing Landscape 2025, ANY.RUN 2025, Forescout Vedere Labs Dec 2024-Jun 2025.
TLD_RESEARCH_WEIGHT: dict[str, int] = {
    # CRITICAL — persistent offenders
    "shop": 55,
    "online": 55,
    "xyz": 50,
    "top": 50,
    "info": 45,
    "ru": 40,
    # EXTREME ratio
    "xin": 90,
    "bond": 85,
    "sbs": 80,
    "cyou": 75,
    "cfd": 75,
    "qpon": 70,
    # Rising — monitored
    "best": 60,
    "beauty": 60,
    "fit": 55,
    "pro": 55,
    "city": 50,
    "buzz": 45,
    # Historically free / low verification
    "tk": 45,
    "ml": 45,
    "ga": 45,
    "cf": 45,
    "gq": 45,
    # Moderate
    "click": 30,
    "li": 30,
    "icu": 25,
    "vip": 25,
    "work": 20,
    "live": 20,
    # Context-dependent signal only
    "dev": 10,
    "cn": 15,
}

MAX_RESEARCH_WEIGHT = 90
MAX_TLD_POINTS_IN_LAYER = 12


def _scale_research_weight_to_layer_points(research_weight: int) -> int:
    if research_weight <= 0:
        return 0

    scaled = round(research_weight * MAX_TLD_POINTS_IN_LAYER / MAX_RESEARCH_WEIGHT)
    if scaled < 1:
        scaled = 1

    return scaled


def _tld_suffix_for_host(host: str) -> str | None:
    extracted = tldextract.extract(host)
    if extracted.suffix == "":
        return None

    return extracted.suffix.lower()


def check_suspicious_tld(host: str) -> list[UrlFinding]:
    findings: list[UrlFinding] = []

    suffix = _tld_suffix_for_host(host)
    if suffix is None:
        return findings

    research_weight = TLD_RESEARCH_WEIGHT.get(suffix)
    if research_weight is None:
        return findings

    layer_points = _scale_research_weight_to_layer_points(research_weight)

    detail = (
        f'TLD ".{suffix}" is on the high-risk list '
        f"(research weight {research_weight}, layer score +{layer_points})."
    )

    findings.append(
        UrlFinding(
            rule="suspicious_tld",
            points=layer_points,
            detail=detail,
        )
    )

    return findings
