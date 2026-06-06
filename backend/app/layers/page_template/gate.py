from __future__ import annotations

from app.layers.page_template.finding import PageFinding

GATE_BLOCK = "BLOCK"
GATE_REVIEW = "REVIEW"
GATE_SAFE = "SAFE"
GATE_INFO = "INFO"


def resolve_gate(findings: list[PageFinding]) -> str:
    for finding in findings:
        if finding.tier == "A":
            return GATE_BLOCK

    for finding in findings:
        if finding.tier == "B" or finding.points > 0:
            return GATE_REVIEW

    for finding in findings:
        if finding.tier == "INFO":
            return GATE_INFO

    return GATE_SAFE


def page_safe_from_gate(gate: str) -> bool:
    return gate == GATE_SAFE or gate == GATE_INFO
