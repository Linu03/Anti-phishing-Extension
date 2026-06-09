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
    if not effective_has_credential_form(snapshot):
        return []

    if _page_http_scheme(snapshot) != "http":
        return []

    page_host = snapshot.page_host.strip()
    if page_host == "":
        page_host = snapshot.page_url.strip()

    return [
        PageFinding(
            rule=RULE_CREDENTIAL_FORM_ON_HTTP,
            points=POINTS_CREDENTIAL_FORM_ON_HTTP,
            detail=(
                f"Credential form is served over unencrypted HTTP on host "
                f"'{page_host}' (password or OTP can be intercepted)."
            ),
            tier="A",
        )
    ]
