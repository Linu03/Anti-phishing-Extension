from __future__ import annotations

import tldextract

from app.core.free_hosting import FREE_HOSTING_ALL
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.rules.trust_context import TrustLevel, resolve_page_trust_context
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

RULE_CREDENTIAL_FORM_ON_FREE_HOSTING = "credential_form_on_free_hosting"

POINTS_FREE_HOSTING = 24

def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}"


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


def check_credential_form_on_free_hosting(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    page_host = snapshot.page_host.strip().lower()
    if page_host == "":
        return []

    registered = _registered_domain(page_host)
    if registered == "" or registered not in FREE_HOSTING_ALL:
        return []

    return [
        PageFinding(
            rule=RULE_CREDENTIAL_FORM_ON_FREE_HOSTING,
            points=POINTS_FREE_HOSTING,
            detail=(
                f"Credential form is hosted on free site-builder domain "
                f"'{registered}' (page host '{page_host}'). "
                f"Legitimate institutions do not collect passwords on prototyping hosts."
            ),
            tier="A",
        )
    ]
