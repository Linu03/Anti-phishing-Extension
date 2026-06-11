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
RULE_EXCESSIVE_HIDDEN_INPUTS = "excessive_hidden_inputs"
RULE_HIDDEN_PASSWORD_FIELD = "hidden_password_field"

HIDDEN_COUNT_THRESHOLD = 10
HIDDEN_RATIO_THRESHOLD = 0.55

POINTS_EXCESSIVE_HIDDEN_NEUTRAL = 8
POINTS_EXCESSIVE_HIDDEN_UNTRUSTED = 10

POINTS_SENSITIVE_ONE_NEUTRAL = 8
POINTS_SENSITIVE_BOTH_NEUTRAL = 12
POINTS_SENSITIVE_ONE_UNTRUSTED = 12
POINTS_SENSITIVE_BOTH_UNTRUSTED = 18

POINTS_FILE_UPLOAD_NEUTRAL = 8
POINTS_FILE_UPLOAD_UNTRUSTED = 12

POINTS_HIDDEN_PASSWORD_NEUTRAL = 10
POINTS_HIDDEN_PASSWORD_UNTRUSTED = 12


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


def _form_hidden_ratio(hidden_count: int, visible_field_count: int) -> float:
    total = hidden_count + visible_field_count
    if total <= 0:
        return 0.0
    return hidden_count / total


def _login_form_has_excessive_hidden(snapshot: PageSnapshotModel) -> tuple[bool, int]:
    worst_hidden = 0

    for form in snapshot.forms:
        if not form.has_password:
            continue

        hidden_count = form.hidden_count
        if hidden_count < HIDDEN_COUNT_THRESHOLD:
            continue

        ratio = _form_hidden_ratio(hidden_count, form.visible_field_count)
        if form.visible_field_count > 0 and ratio < HIDDEN_RATIO_THRESHOLD:
            continue

        if hidden_count > worst_hidden:
            worst_hidden = hidden_count

    if worst_hidden == 0:
        return False, 0

    return True, worst_hidden


def check_excessive_hidden_inputs(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    triggered, hidden_count = _login_form_has_excessive_hidden(snapshot)
    if not triggered:
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url
    points = (
        POINTS_EXCESSIVE_HIDDEN_UNTRUSTED
        if trust == TrustLevel.UNTRUSTED
        else POINTS_EXCESSIVE_HIDDEN_NEUTRAL
    )

    return [
        PageFinding(
            rule=RULE_EXCESSIVE_HIDDEN_INPUTS,
            points=points,
            detail=(
                f"Login form contains {hidden_count} hidden fields on host "
                f"'{page_host}' (unusually high for a credential form)."
            ),
            tier="B",
        )
    ]


def check_hidden_password_field(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    if not snapshot.field_profile.has_hidden_password:
        return []

    trust = resolve_page_trust_context(snapshot, context)
    if _skip_for_trust(trust):
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url
    points = (
        POINTS_HIDDEN_PASSWORD_UNTRUSTED
        if trust == TrustLevel.UNTRUSTED
        else POINTS_HIDDEN_PASSWORD_NEUTRAL
    )

    return [
        PageFinding(
            rule=RULE_HIDDEN_PASSWORD_FIELD,
            points=points,
            detail=(
                f"Login page contains a password field hidden from view on host "
                f"'{page_host}' (CSS hide, zero size, or off-screen)."
            ),
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
