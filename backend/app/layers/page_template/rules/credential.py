from __future__ import annotations

from urllib.parse import urlparse

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_CREDENTIAL_FORM_ON_HTTP = 25
RULE_CREDENTIAL_FORM_ON_HTTP = "credential_form_on_http"


def effective_has_credential_form(snapshot: PageSnapshotModel) -> bool:
    if snapshot.has_credential_form:
        return True

    profile = snapshot.field_profile
    return profile.has_password or profile.has_otp


def effective_has_sensitive_form(snapshot: PageSnapshotModel) -> bool:
    if effective_has_credential_form(snapshot):
        return True

    profile = snapshot.field_profile
    return profile.has_payment or profile.has_identity


def is_payment_identity_only(snapshot: PageSnapshotModel) -> bool:
    return effective_has_sensitive_form(snapshot) and not effective_has_credential_form(
        snapshot
    )


PAYMENT_IDENTITY_ONLY_POINTS_SCALE = 0.85


def scaled_points_for_sensitive_context(snapshot: PageSnapshotModel, base_points: int) -> int:
    """Slightly lower tier-A/B scores when the page has no password/OTP field."""
    if not is_payment_identity_only(snapshot):
        return base_points

    scaled = round(base_points * PAYMENT_IDENTITY_ONLY_POINTS_SCALE)
    if base_points > 0 and scaled < 1:
        return 1
    return scaled


def _page_http_scheme(snapshot: PageSnapshotModel) -> str:
    candidates = [snapshot.page_url, snapshot.page_origin]
    for raw in candidates:
        text = raw.strip()
        if text == "":
            continue

        scheme = urlparse(text).scheme.lower()
        if scheme == "http":
            return "http"
        if scheme == "https":
            return "https"

    return ""


def check_credential_form_on_http(snapshot: PageSnapshotModel,_context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_sensitive_form(snapshot):
        return []

    if _page_http_scheme(snapshot) != "http":
        return []

    page_host = snapshot.page_host.strip()
    if page_host == "":
        page_host = snapshot.page_url.strip()

    points = scaled_points_for_sensitive_context(
        snapshot, POINTS_CREDENTIAL_FORM_ON_HTTP
    )
    if is_payment_identity_only(snapshot):
        detail = (
            f"Sensitive data form is served over unencrypted HTTP on host "
            f"'{page_host}' (card or identity fields can be intercepted)."
        )
    else:
        detail = (
            f"Credential form is served over unencrypted HTTP on host "
            f"'{page_host}' (password or OTP can be intercepted)."
        )

    return [
        PageFinding(
            rule=RULE_CREDENTIAL_FORM_ON_HTTP,
            points=points,
            detail=detail,
            tier="A",
        )
    ]
