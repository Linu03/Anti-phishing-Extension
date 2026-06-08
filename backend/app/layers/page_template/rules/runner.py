from __future__ import annotations

from collections.abc import Callable

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.brand import check_brand_page_host_mismatch
from app.layers.page_template.rules.collection import check_collection_status
from app.layers.page_template.rules.forms import (
    check_http_form_action_on_https_page,
    check_invalid_form_action,
    check_suspicious_submit_destination,
)
from app.layers.page_template.rules.navigation import (
    check_base_href_cross_domain,
    check_canonical_host_mismatch,
    check_meta_refresh_cross_domain,
)
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.schemas import (
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

RuleFn = Callable[ [PageSnapshotModel, PageDiffModel | None, PriorLayersContextModel],list[PageFinding]]


def _wrap_snapshot_rule(fn: Callable[[PageSnapshotModel], list[PageFinding]]) -> RuleFn:
    def run(snapshot: PageSnapshotModel,_diff: PageDiffModel | None, _context: PriorLayersContextModel, ) -> list[PageFinding]:
        return fn(snapshot)

    return run


# Rules that only apply on login / 2FA pages (brand mismatch, form submit, etc.).
CREDENTIAL_GATED_RULES: list[RuleFn] = [
    check_brand_page_host_mismatch,
    check_invalid_form_action,
    check_http_form_action_on_https_page,
    check_suspicious_submit_destination,
    check_meta_refresh_cross_domain,
    check_base_href_cross_domain,
    check_canonical_host_mismatch,
]


# Rules that run whenever their own required fields are present in the snapshot.
GENERAL_RULES: list[RuleFn] = [
    check_collection_status,
]


def run_all_rules(snapshot: PageSnapshotModel, diff: PageDiffModel | None, context: PriorLayersContextModel) -> tuple[list[PageFinding], bool]:

    credential_context = effective_has_credential_form(snapshot)
    findings: list[PageFinding] = []

    for rule in GENERAL_RULES:
        findings.extend(rule(snapshot, diff, context))

    if credential_context:
        for rule in CREDENTIAL_GATED_RULES:
            findings.extend(rule(snapshot, diff, context))

    return findings, credential_context
