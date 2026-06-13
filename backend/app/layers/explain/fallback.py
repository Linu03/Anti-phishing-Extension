from __future__ import annotations

from app.layers.explain.payload import (
    build_signal_bullets,
    build_technical_bullets,
    verdict_label,
)
from app.layers.explain.schemas import ExplainRequest


def _friendly_verdict(verdict: str) -> str:
    key = verdict.strip().lower()
    if key == "safe":
        return "Nothing major stood out in our checks."
    if key == "caution":
        return "We found some warning signs, so you should be careful."
    if key == "high_risk":
        return "We found several warning signs that this page may be a scam."
    return "Please be careful on this page."


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


def _layer_names_from_bullets(bullets: list[str]) -> list[str]:
    names: list[str] = []
    for bullet in bullets:
        head = bullet.split("(", 1)[0].strip()
        if head != "" and head not in names:
            names.append(head)
    return names


def build_fallback_explanation_plain(request: ExplainRequest) -> str:
    host = _host_label(request)
    intro = _friendly_verdict(request.verdict)
    bullets = build_signal_bullets(request)

    closing = (
        "If you are not sure, close this tab and open the official website by typing "
        "the address yourself. Do not enter your password here."
    )

    if request.threat_score <= 0 or len(bullets) == 0:
        return (
            f"We checked {host}. {intro} "
            f"If you need to log in or pay, use the official site you typed yourself."
        )

    reasons = _join_sentences(bullets[:3])
    return f"We checked {host}. {intro} {reasons} {closing}"


def build_fallback_explanation_technical(request: ExplainRequest) -> str:
    host = _host_label(request)
    risk = verdict_label(request.verdict)
    bullets = build_technical_bullets(request)

    intro = (
        f"This scan of {host} scored {request.threat_score} out of 100 ({risk})."
    )

    if len(bullets) == 0:
        return f"{intro} No layer contributed points to the score."

    body = _join_sentences(bullets[:4])
    drivers = _layer_names_from_bullets(bullets[:3])
    if len(drivers) == 1:
        conclusion = f"The primary risk driver is {drivers[0]}."
    elif len(drivers) == 2:
        conclusion = f"The primary risk drivers are {drivers[0]} and {drivers[1]}."
    else:
        conclusion = (
            f"The primary risk drivers are {drivers[0]}, {drivers[1]}, and {drivers[2]}."
        )

    return f"{intro} {body} {conclusion}"


def build_fallback_explanation(request: ExplainRequest) -> str:
    if request.audience == "technical":
        return build_fallback_explanation_technical(request)
    return build_fallback_explanation_plain(request)
