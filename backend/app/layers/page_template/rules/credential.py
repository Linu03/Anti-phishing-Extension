from __future__ import annotations

from app.layers.page_template.schemas import PageSnapshotModel


def effective_has_credential_form(snapshot: PageSnapshotModel) -> bool:
    if snapshot.has_credential_form:
        return True

    profile = snapshot.field_profile
    return profile.has_password or profile.has_otp
