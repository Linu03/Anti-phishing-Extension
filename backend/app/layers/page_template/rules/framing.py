from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_sensitive_form
from app.layers.page_template.rules.trust_context import TrustLevel, resolve_page_trust_context
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_LOGIN_PAGE_IS_FRAMED = 18
RULE_LOGIN_PAGE_IS_FRAMED = "login_page_is_framed"


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


def check_login_page_is_framed(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_sensitive_form(snapshot):
        return []

    if not snapshot.is_framed:
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url

    return [
        PageFinding(
            rule=RULE_LOGIN_PAGE_IS_FRAMED,
            points=POINTS_LOGIN_PAGE_IS_FRAMED,
            detail=(
                f"Credential page is loaded inside an iframe on host "
                f"'{page_host}' (user may not see the real address bar)."
            ),
            tier="B",
        )
    ]
