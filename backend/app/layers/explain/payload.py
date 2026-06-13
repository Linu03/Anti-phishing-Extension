from __future__ import annotations

from app.layers.explain.schemas import ExplainLayerInput, ExplainRequest
from app.layers.explain.signal_labels import label_for_rule


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


def _technical_layer_bullet(layer: ExplainLayerInput) -> str | None:
    if layer.contribution == 0:
        return None

    label = layer.label.strip()
    if label == "":
        label = layer.id.strip()
    if label == "":
        label = "Layer"

    contrib = layer.contribution
    if contrib > 0:
        contrib_text = f"+{contrib}"
    else:
        contrib_text = str(contrib)

    rules: list[str] = []
    for finding in layer.findings:
        rule = finding.rule.strip()
        if rule != "" and finding.points != 0 and rule not in rules:
            rules.append(rule)

    detail = layer.detail.strip()
    head = f"{label} ({contrib_text})"
    if len(rules) > 0:
        head = f"{head}, rules: {', '.join(rules)}"

    if detail != "":
        return f"{head}: {detail}"
    return head


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

    if request.audience == "technical":
        bullets = build_technical_bullets(request)
        closing = (
            "Write a short technical summary in full sentences for an analyst. "
            "One bullet = one layer that contributed points. Synthesize across layers; "
            "do not copy bullet text verbatim or list pipe-separated fields."
        )
    else:
        bullets = build_signal_bullets(request)
        closing = (
            "Write a short explanation for a non-technical user. "
            "Translate each warning into plain everyday language."
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
        f"Overall score: {request.threat_score} out of 100\n"
        f"Risk level: {verdict_label(request.verdict)}\n"
        f"Warning signals:\n"
        f"{bullet_text}\n"
        f"\n"
        f"{closing}"
    )
