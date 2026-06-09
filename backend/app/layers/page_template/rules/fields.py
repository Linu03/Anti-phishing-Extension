from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.rules.trust_context import TrustLevel, resolve_page_trust_context
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

RULE_SENSITIVE_FIELD_COLLECTION = "sensitive_field_collection"
RULE_FILE_UPLOAD_WITH_LOGIN = "file_upload_with_login"

POINTS_SENSITIVE_ONE_NEUTRAL = 8
POINTS_SENSITIVE_BOTH_NEUTRAL = 12
POINTS_SENSITIVE_ONE_UNTRUSTED = 12
POINTS_SENSITIVE_BOTH_UNTRUSTED = 18

POINTS_FILE_UPLOAD_NEUTRAL = 8
POINTS_FILE_UPLOAD_UNTRUSTED = 12


def _skip_for_trust(trust: TrustLevel) -> bool:
    return trust in {TrustLevel.USER_WHITELIST, TrustLevel.TRUSTED_BRAND_HOST}


def _sensitive_points(trust: TrustLevel, has_payment: bool, has_identity: bool) -> int:
    both = has_payment and has_identity
    if trust == TrustLevel.UNTRUSTED:
        return POINTS_SENSITIVE_BOTH_UNTRUSTED if both else POINTS_SENSITIVE_ONE_UNTRUSTED
    return POINTS_SENSITIVE_BOTH_NEUTRAL if both else POINTS_SENSITIVE_ONE_NEUTRAL


def _sensitive_detail(page_host: str,has_payment: bool,has_identity: bool) -> str:
    if has_payment and has_identity:
        kinds = "payment and identity fields (card/CVV and CNP/national ID)"
    elif has_payment:
        kinds = "payment fields (card/CVV)"
    else:
        kinds = "identity fields (CNP/national ID)"

    return (
        f"Login page also requests {kinds} on host '{page_host}'."
    )


def check_sensitive_field_collection(snapshot: PageSnapshotModel, context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    profile = snapshot.field_profile
    has_payment = profile.has_payment
    has_identity = profile.has_identity
    if not has_payment and not has_identity:
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url
    points = _sensitive_points(trust, has_payment, has_identity)

    return [
        PageFinding(
            rule=RULE_SENSITIVE_FIELD_COLLECTION,
            points=points,
            detail=_sensitive_detail(page_host, has_payment, has_identity),
            tier="B",
        )
    ]


def check_file_upload_with_login(snapshot: PageSnapshotModel, context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    if not snapshot.field_profile.has_file:
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url
    points = (
        POINTS_FILE_UPLOAD_UNTRUSTED
        if trust == TrustLevel.UNTRUSTED
        else POINTS_FILE_UPLOAD_NEUTRAL
    )

    return [
        PageFinding(
            rule=RULE_FILE_UPLOAD_WITH_LOGIN,
            points=points,
            detail=(
                f"Login page includes file upload on host '{page_host}'."
            ),
            tier="B",
        )
    ]
