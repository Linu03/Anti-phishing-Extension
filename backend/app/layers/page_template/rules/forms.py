from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.schemas import (
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_INVALID_FORM_ACTION = 25
RULE_NAME = "invalid_form_action"

# not valid schemes for form action 
_INVALID_SCHEMES = frozenset({"javascript", "data", "vbscript"})


def _normalize_action_scheme(action: str) -> str | None:
    text = action.strip().lower()
    if text == "":
        return None

    for scheme in _INVALID_SCHEMES:
        prefix = f"{scheme}:"
        if text.startswith(prefix):
            return scheme

    return "other"


def _collect_submit_targets(snapshot: PageSnapshotModel) -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = []

    for form in snapshot.forms:
        action = form.action.strip()
        if action != "":
            targets.append((action, "form action"))

    for button in snapshot.submit_buttons:
        formaction = button.formaction.strip()
        if formaction != "":
            targets.append((formaction, "formaction"))

    return targets


def check_invalid_form_action(
    snapshot: PageSnapshotModel,
    _diff: PageDiffModel | None,
    _context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    targets = _collect_submit_targets(snapshot)
    if not targets:
        return []

    for action, source in targets:
        scheme = _normalize_action_scheme(action)
        if scheme is None or scheme not in _INVALID_SCHEMES:
            continue

        return [
            PageFinding(
                rule=RULE_NAME,
                points=POINTS_INVALID_FORM_ACTION,
                detail=(
                    f"Credential form {source} uses {scheme}: URL "
                    f"(not a real HTTP endpoint)."
                ),
                tier="A",
            )
        ]

    return []
