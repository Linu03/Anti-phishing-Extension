from __future__ import annotations

from dataclasses import asdict

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.rules.runner import run_all_behavior_rules
from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel

MAX_LAYER_SCORE = 65


def _findings_to_dict_list(findings: list[BehavioralFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


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

    return {
        "score": score,
        "findings": _findings_to_dict_list(findings),
    }
