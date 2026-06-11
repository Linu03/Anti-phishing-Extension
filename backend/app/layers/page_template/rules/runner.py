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
from app.layers.page_template.rules.fields import (
    check_excessive_hidden_inputs,
    check_file_upload_with_login,
    check_hidden_password_field,
    check_sensitive_field_collection,
)
from app.layers.page_template.rules.iframes import check_iframe_signals
from app.layers.page_template.rules.navigation import (
    check_base_href_cross_domain,
    check_canonical_host_mismatch,
    check_meta_refresh_cross_domain,
)
from app.layers.page_template.rules.credential import (
    check_credential_form_on_http,
    effective_has_credential_form,
)
from app.layers.page_template.rules.framing import check_login_page_is_framed
from app.layers.page_template.rules.resources import check_external_resource_ratio
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

RuleFn = Callable[
    [PageSnapshotModel, PriorLayersContextModel],
    list[PageFinding],
]


CREDENTIAL_GATED_RULES: list[RuleFn] = [
    check_brand_page_host_mismatch,
    check_invalid_form_action,
    check_credential_form_on_http,
    check_http_form_action_on_https_page,
    check_suspicious_submit_destination,
    check_meta_refresh_cross_domain,
    check_base_href_cross_domain,
    check_canonical_host_mismatch,
    check_iframe_signals,
    check_sensitive_field_collection,
    check_file_upload_with_login,
    check_excessive_hidden_inputs,
    check_hidden_password_field,
    check_login_page_is_framed,
    check_external_resource_ratio,
]


GENERAL_RULES: list[RuleFn] = [
    check_collection_status,
]


def run_all_rules(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> tuple[list[PageFinding], bool]:

    credential_context = effective_has_credential_form(snapshot)
    findings: list[PageFinding] = []

    for rule in GENERAL_RULES:
        findings.extend(rule(snapshot, context))

    if credential_context:
        for rule in CREDENTIAL_GATED_RULES:
            findings.extend(rule(snapshot, context))

    return findings, credential_context
