from __future__ import annotations

from collections.abc import Awaitable, Callable

import httpx

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
    effective_has_sensitive_form,
)
from app.layers.page_template.rules.framing import check_login_page_is_framed
from app.layers.page_template.rules.hosting import check_credential_form_on_free_hosting
from app.layers.page_template.rules.resources import check_external_resource_ratio
from app.layers.page_template.rules.favicon_brand import check_favicon_brand_impersonation
from app.layers.page_template.rules.visual_brand import (
    RULE_VISUAL_BRAND_MISMATCH,
    check_visual_brand_impersonation,
    resolve_prominent_brand_match,
)
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

RuleFn = Callable[
    [PageSnapshotModel, PriorLayersContextModel],
    list[PageFinding],
]

AsyncRuleFn = Callable[
    [PageSnapshotModel, PriorLayersContextModel, httpx.AsyncClient],
    Awaitable[list[PageFinding]],
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
    check_credential_form_on_free_hosting,
]


GENERAL_RULES: list[RuleFn] = [
    check_collection_status,
]


def run_all_rules(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> tuple[list[PageFinding], bool]:

    sensitive_context = effective_has_sensitive_form(snapshot)
    findings: list[PageFinding] = []

    for rule in GENERAL_RULES:
        findings.extend(rule(snapshot, context))

    if sensitive_context:
        for rule in CREDENTIAL_GATED_RULES:
            findings.extend(rule(snapshot, context))

    return findings, sensitive_context


async def run_async_rules(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
    http_client: httpx.AsyncClient,
) -> list[PageFinding]:
    findings: list[PageFinding] = []
    prominent_match = await resolve_prominent_brand_match(snapshot, context, http_client)

    visual_findings: list[PageFinding] = []
    try:
        visual_findings = await check_visual_brand_impersonation(
            snapshot,
            context,
            http_client,
            precomputed_match=prominent_match,
        )
        findings.extend(visual_findings)
    except Exception:
        pass

    exclude_brand: str | None = None
    if prominent_match is not None and any(
        item.rule == RULE_VISUAL_BRAND_MISMATCH for item in visual_findings
    ):
        exclude_brand = prominent_match.brand

    try:
        findings.extend(
            await check_favicon_brand_impersonation(
                snapshot,
                context,
                http_client,
                exclude_brand=exclude_brand,
            )
        )
    except Exception:
        pass

    return findings
