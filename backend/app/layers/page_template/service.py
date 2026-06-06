from __future__ import annotations

from dataclasses import asdict

from app.layers.page_template.amplify import apply_amplification
from app.layers.page_template.constants import MAX_LAYER_SCORE
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.gate import page_safe_from_gate, resolve_gate
from app.layers.page_template.rules.runner import run_all_rules
from app.layers.page_template.schemas import (
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)


def _findings_to_dict_list(findings: list[PageFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def analyze_page_template(
    snapshot: PageSnapshotModel,
    diff: PageDiffModel | None,
    context: PriorLayersContextModel,
) -> dict:
    findings, credential_context = run_all_rules(snapshot, diff, context)

    base_score = 0
    for finding in findings:
        base_score = base_score + finding.points

    if base_score > MAX_LAYER_SCORE:
        base_score = MAX_LAYER_SCORE

    score = apply_amplification(base_score, findings, context, diff)
    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    gate = resolve_gate(findings)

    return {
        "score": score,
        "gate": gate,
        "page_safe": page_safe_from_gate(gate),
        "credential_context": credential_context,
        "findings": _findings_to_dict_list(findings),
    }
