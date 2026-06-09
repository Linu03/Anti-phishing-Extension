from __future__ import annotations

from dataclasses import asdict

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.rules.runner import run_all_behavior_rules
from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel

MAX_LAYER_SCORE = 40

GATE_BLOCK = "BLOCK"
GATE_REVIEW = "REVIEW"
GATE_SAFE = "SAFE"


def _findings_to_dict_list(findings: list[BehavioralFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def _resolve_gate(findings: list[BehavioralFinding]) -> str:
    for finding in findings:
        if finding.tier == "A":
            return GATE_BLOCK

    for finding in findings:
        if finding.tier == "B" or finding.points > 0:
            return GATE_REVIEW

    return GATE_SAFE


def analyze_behavior(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> dict:
    findings = run_all_behavior_rules(diff, context)

    score = 0
    for finding in findings:
        score = score + finding.points

    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    gate = _resolve_gate(findings)

    return {
        "score": score,
        "gate": gate,
        "findings": _findings_to_dict_list(findings),
    }
