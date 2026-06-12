from __future__ import annotations

from dataclasses import asdict

import httpx

from app.layers.page_template.amplify import apply_amplification
from app.layers.page_template.constants import MAX_LAYER_SCORE
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.runner import run_all_rules, run_async_rules
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)


def _findings_to_dict_list(findings: list[PageFinding]) -> list[dict]:
    result: list[dict] = []
    for item in findings:
        result.append(asdict(item))
    return result


def _score_findings(findings: list[PageFinding],context: PriorLayersContextModel,) -> int:
    base_score = 0
    for finding in findings:
        base_score = base_score + finding.points

    if base_score > MAX_LAYER_SCORE:
        base_score = MAX_LAYER_SCORE

    score = apply_amplification(base_score, findings, context)
    if score > MAX_LAYER_SCORE:
        score = MAX_LAYER_SCORE

    return score


def analyze_page_template(snapshot: PageSnapshotModel,context: PriorLayersContextModel) -> dict:
    findings, credential_context = run_all_rules(snapshot, context)

    return {
        "score": _score_findings(findings, context),
        "credential_context": credential_context,
        "findings": _findings_to_dict_list(findings),
    }


async def analyze_page_template_async(snapshot: PageSnapshotModel,context: PriorLayersContextModel,http_client: httpx.AsyncClient) -> dict:
    findings, credential_context = run_all_rules(snapshot, context)

    if credential_context:
        findings = findings + await run_async_rules(snapshot, context, http_client)

    return {
        "score": _score_findings(findings, context),
        "credential_context": credential_context,
        "findings": _findings_to_dict_list(findings),
    }
