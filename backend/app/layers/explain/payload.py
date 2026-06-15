from __future__ import annotations

import re

from app.layers.explain.schemas import ExplainLayerInput, ExplainRequest
from app.layers.explain.signal_labels import label_for_rule, technical_label_for_rule

_INTERNAL_DETAIL_RE = re.compile(
    r"(?:"
    r"URL phishing risk:\s*\w+\s*|"
    r"\(score\s+\d+/\d+\)|"
    r"\btier\s+[A-Z]\b|"
    r"hosting_type=\S+|"
    r"brand=\w+|"
    r"registered=\S+"
    r")",
    re.IGNORECASE,
)

_CONTRIBUTION_RE = re.compile(r"\(\+\d+\)|\(-\d+\)")


def verdict_label(verdict: str) -> str:
    key = verdict.strip().lower()
    if key == "safe":
        return "Low risk"
    if key == "caution":
        return "Medium risk"
    if key == "high_risk":
        return "High risk"
    return verdict.strip()


def _signals_from_layer(layer: ExplainLayerInput) -> list[str]:
    signals: list[str] = []

    # Prefer structured findings when the extension sends them.
    for finding in layer.findings:
        # Skip informational-only rows (e.g. TLS issuer_info at 0 points).
        if finding.points == 0:
            continue

        label = label_for_rule(finding.rule)
        if label is not None:
            signals.append(label)
            continue

        if finding.detail.strip() != "":
            signals.append(finding.detail.strip())

    # If we only have layer summary (contribution + detail), use that.
    if len(signals) == 0 and layer.contribution != 0:
        if layer.detail.strip() != "":
            signals.append(layer.detail.strip())
        elif layer.label.strip() != "":
            signals.append(
                f"{layer.label.strip()} contributed {layer.contribution} points"
            )

    return signals


def sanitize_technical_detail(text: str) -> str:
    cleaned = _INTERNAL_DETAIL_RE.sub("", text.strip())
    cleaned = _CONTRIBUTION_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .;")
    if cleaned == "":
        return ""

    parts = [part.strip() for part in re.split(r"[;.]", cleaned) if part.strip()]
    for part in parts:
        if len(part) >= 20:
            return part
    return parts[0] if parts else cleaned


def _technical_signals_from_layer(layer: ExplainLayerInput) -> list[str]:
    signals: list[str] = []
    seen: set[str] = set()

    for finding in layer.findings:
        if finding.points == 0:
            continue

        label = technical_label_for_rule(finding.rule)
        if label is not None:
            key = label.lower()
            if key not in seen:
                seen.add(key)
                signals.append(label)
            continue

        detail = sanitize_technical_detail(finding.detail)
        if detail != "":
            key = detail.lower()
            if key not in seen:
                seen.add(key)
                signals.append(detail)

    if len(signals) == 0 and layer.contribution != 0:
        detail = sanitize_technical_detail(layer.detail)
        if detail != "":
            signals.append(detail)

    return signals


def _technical_layer_bullet(layer: ExplainLayerInput) -> str | None:
    if layer.contribution == 0:
        return None

    label = layer.label.strip()
    if label == "":
        label = layer.id.strip()
    if label == "":
        label = "Layer"

    signals = _technical_signals_from_layer(layer)
    if len(signals) == 0:
        return None

    return f"{label}: {'; '.join(signals)}"


def build_technical_bullets(request: ExplainRequest) -> list[str]:
    bullets: list[str] = []
    for layer in request.layers:
        if layer.contribution == 0:
            continue
        bullet = _technical_layer_bullet(layer)
        if bullet is not None:
            bullets.append(bullet)
    return bullets


def build_signal_bullets(request: ExplainRequest) -> list[str]:
    bullets: list[str] = []
    seen: set[str] = set()

    for layer in request.layers:
        if layer.contribution == 0:
            continue
        for signal in _signals_from_layer(layer):
            key = signal.lower()
            if key in seen:
                continue
            seen.add(key)
            bullets.append(signal)

    return bullets


def build_prompt_user_text(request: ExplainRequest) -> str:
    host = request.page_host.strip()
    if host == "":
        host = request.page_url.strip()
    if host == "":
        host = "unknown site"

    low_risk = request.threat_score < 30 or request.verdict.strip().lower() == "safe"

    if request.audience == "technical":
        bullets = build_technical_bullets(request)
        closing = (
            "Write a short technical summary in 2 to 4 connected sentences. "
            "Synthesize across layers into coherent prose. Do not quote the lines "
            "above verbatim, list rule ids, or mention numeric scores."
        )
        if low_risk:
            closing = (
                f"{closing} The overall risk is Low — keep the tone measured; "
                "do not speculate about AitM or session hijacking."
            )
    else:
        bullets = build_signal_bullets(request)
        closing = (
            "Write a very short explanation (2-3 sentences) for a non-technical user. "
            "Focus on the main risk in plain language — do not list every bullet."
        )
        if low_risk:
            closing = (
                f"{closing} Overall risk is Low — reassure the user unless bullets "
                "clearly show impersonation or payment fraud."
            )

    if len(bullets) == 0:
        bullet_text = "- No specific warning signals were recorded."
    else:
        lines: list[str] = []
        for item in bullets:
            lines.append(f"- {item}")
        bullet_text = "\n".join(lines)

    return (
        f"Website: {host}\n"
        f"Risk level: {verdict_label(request.verdict)}\n"
        f"Contributing findings:\n"
        f"{bullet_text}\n"
        f"\n"
        f"{closing}"
    )
