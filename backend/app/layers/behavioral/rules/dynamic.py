from __future__ import annotations

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel

POINTS_DELAYED_CREDENTIAL = 20
RULE_DELAYED_CREDENTIAL = "delayed_credential_form"

POINTS_DYNAMIC_SUBMIT = 28
RULE_DYNAMIC_SUBMIT = "dynamic_submit_destination"

POINTS_DELAYED_BRAND = 18
RULE_DELAYED_BRAND = "delayed_brand_injection"


def check_delayed_credential_form(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    if not diff.forms_appeared and not diff.password_inputs_increased:
        return []

    parts: list[str] = []
    if diff.forms_appeared:
        parts.append("login form appeared")
    if diff.password_inputs_increased:
        parts.append("password fields increased")

    delay_text = f"after {diff.observed_ms}ms" if diff.observed_ms > 0 else "after page load"

    return [
        BehavioralFinding(
            rule=RULE_DELAYED_CREDENTIAL,
            points=POINTS_DELAYED_CREDENTIAL,
            detail=(
                f"Credential elements injected dynamically ({', '.join(parts)}) "
                f"{delay_text} on host '{context.page_host}'."
            ),
            tier="B",
        )
    ]


def _has_sensitive_context(context: BehavioralContextModel) -> bool:
    return context.has_sensitive_form or context.has_credential_form


def check_dynamic_submit_destination(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    if not diff.action_origin_changed:
        return []

    if not _has_sensitive_context(context):
        return []

    return [
        BehavioralFinding(
            rule=RULE_DYNAMIC_SUBMIT,
            points=POINTS_DYNAMIC_SUBMIT,
            detail=(
                f"Form submit destination changed dynamically after page load "
                f"on host '{context.page_host}'. "
                f"Legitimate login pages do not modify their action post-load."
            ),
            tier="A",
        )
    ]


def check_delayed_brand_injection(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    if not diff.brand_hits_increased:
        return []

    return [
        BehavioralFinding(
            rule=RULE_DELAYED_BRAND,
            points=POINTS_DELAYED_BRAND,
            detail=(
                f"Brand references appeared in the page after initial load "
                f"on host '{context.page_host}'. "
                f"Page initially looked neutral, then mimicked a known brand."
            ),
            tier="B",
        )
    ]
