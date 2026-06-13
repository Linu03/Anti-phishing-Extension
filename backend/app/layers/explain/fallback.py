from __future__ import annotations

from app.layers.explain.payload import (
    build_signal_bullets,
    build_technical_bullets,
    verdict_label,
)
from app.layers.explain.schemas import ExplainRequest


def _host_label(request: ExplainRequest) -> str:
    host = request.page_host.strip()
    if host != "":
        return host
    page_url = request.page_url.strip()
    if page_url != "":
        return page_url
    return "this website"


def _as_sentence(text: str) -> str:
    cleaned = text.strip()
    if cleaned == "":
        return ""
    if cleaned.endswith("."):
        return cleaned
    return f"{cleaned}."


def _join_sentences(parts: list[str]) -> str:
    sentences: list[str] = []
    for item in parts:
        sentence = _as_sentence(item)
        if sentence != "":
            sentences.append(sentence)
    return " ".join(sentences)


def _technical_signals_from_bullets(bullets: list[str]) -> list[str]:
    signals: list[str] = []
    seen: set[str] = set()
    for bullet in bullets:
        if ":" not in bullet:
            continue
        _, rest = bullet.split(":", 1)
        for part in rest.split(";"):
            text = part.strip()
            key = text.lower()
            if text != "" and key not in seen:
                seen.add(key)
                signals.append(text)
    return signals


def _plain_opener(verdict: str) -> str:
    key = verdict.strip().lower()
    if key == "safe":
        return "This page looks mostly okay."
    if key == "caution":
        return "This page looks suspicious."
    if key == "high_risk":
        return "This page looks like a scam."
    return "Please be careful on this page."


def build_fallback_explanation_plain(request: ExplainRequest) -> str:
    opener = _plain_opener(request.verdict)
    bullets = build_signal_bullets(request)

    closing = "If you need to log in, use the official website - not this page."

    if request.threat_score <= 0 or len(bullets) == 0:
        return f"{opener} Stay careful before entering passwords or payment details."

    main_reason = bullets[0].strip()
    if not main_reason.endswith("."):
        main_reason = f"{main_reason}."

    return f"{opener} {main_reason} {closing}"


def build_fallback_explanation_technical(request: ExplainRequest) -> str:
    host = _host_label(request)
    risk = verdict_label(request.verdict)
    bullets = build_technical_bullets(request)

    intro = f"Analysis of {host} indicates {risk.lower()}."

    if len(bullets) == 0:
        return f"{intro} No layer contributed findings to this assessment."

    signals = _technical_signals_from_bullets(bullets)
    if len(signals) == 0:
        return intro

    body = _join_sentences(signals[:3])
    return f"{intro} {body}"


def build_fallback_explanation(request: ExplainRequest) -> str:
    if request.audience == "technical":
        return build_fallback_explanation_technical(request)
    return build_fallback_explanation_plain(request)
