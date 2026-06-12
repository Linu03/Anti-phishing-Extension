from __future__ import annotations

from collections.abc import Callable

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.rules.dynamic import (
    check_delayed_brand_injection,
    check_delayed_credential_form,
    check_dynamic_submit_destination,
)
from app.layers.behavioral.rules.redirect import check_rapid_cross_domain_redirect
from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel

BehaviorRuleFn = Callable[
    [BehaviorDiffModel, BehavioralContextModel],
    list[BehavioralFinding],
]

BEHAVIOR_RULES: list[BehaviorRuleFn] = [
    check_rapid_cross_domain_redirect,
    check_delayed_credential_form,
    check_dynamic_submit_destination,
    check_delayed_brand_injection,
]


def run_all_behavior_rules(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    findings: list[BehavioralFinding] = []

    for rule in BEHAVIOR_RULES:
        findings.extend(rule(diff, context))

    return findings
