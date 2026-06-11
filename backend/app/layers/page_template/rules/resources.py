from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.rules.trust_context import TrustLevel, resolve_page_trust_context
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

RULE_EXTERNAL_RESOURCE_RATIO = "external_resource_ratio"

RATIO_THRESHOLD = 0.85
MIN_RESOURCE_COUNT = 6

POINTS_EXTERNAL_RESOURCE_NEUTRAL = 10
POINTS_EXTERNAL_RESOURCE_UNTRUSTED = 12


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


def check_external_resource_ratio(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    total = snapshot.total_resource_count
    if total < MIN_RESOURCE_COUNT:
        return []

    ratio = snapshot.external_resource_ratio
    if ratio < RATIO_THRESHOLD:
        return []

    external = snapshot.external_resource_count
    page_host = snapshot.page_host.strip() or snapshot.page_url
    percent = int(round(ratio * 100))
    points = (
        POINTS_EXTERNAL_RESOURCE_UNTRUSTED
        if trust == TrustLevel.UNTRUSTED
        else POINTS_EXTERNAL_RESOURCE_NEUTRAL
    )

    return [
        PageFinding(
            rule=RULE_EXTERNAL_RESOURCE_RATIO,
            points=points,
            detail=(
                f"{percent}% of page resources ({external}/{total}) load from external "
                f"domains on host '{page_host}' (CDN/widget hosts excluded)."
            ),
            tier="B",
        )
    ]
