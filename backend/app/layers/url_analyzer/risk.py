from __future__ import annotations
from typing import Literal

UrlRiskLevel = Literal["low", "medium", "high"]
RISK_LOW_MAX_SCORE = 11
RISK_MEDIUM_MAX_SCORE = 27

RISK_LABELS: dict[UrlRiskLevel, str] = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
}


def url_risk_from_score(score: int) -> UrlRiskLevel:
    if score <= RISK_LOW_MAX_SCORE:
        return "low"
    if score <= RISK_MEDIUM_MAX_SCORE:
        return "medium"
    return "high"


def url_risk_label(level: UrlRiskLevel) -> str:
    return RISK_LABELS[level]
