from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import PageSnapshotModel


def _snapshot_has_usable_fields(snapshot: PageSnapshotModel) -> bool:
    if snapshot.brand_hits:
        return True
    if snapshot.forms:
        return True
    if snapshot.iframes:
        return True
    if snapshot.meta_refresh_target.strip() != "":
        return True
    if snapshot.base_href_origin.strip() != "":
        return True
    if snapshot.canonical_host.strip() != "":
        return True
    if snapshot.external_script_origins:
        return True
    if effective_field_signals(snapshot):
        return True
    return False


def effective_field_signals(snapshot: PageSnapshotModel) -> bool:
    profile = snapshot.field_profile
    return (
        profile.has_password
        or profile.has_otp
        or profile.has_email
        or profile.has_payment
        or profile.has_identity
        or profile.has_file
        or profile.has_tel
    )


def check_collection_status(snapshot: PageSnapshotModel) -> list[PageFinding]:

    if snapshot.collection_ok:
        return []

    if _snapshot_has_usable_fields(snapshot):
        return [
            PageFinding(
                rule="collection_partial",
                points=0,
                detail="Incomplete page snapshot; rules still run on received fields.",
                tier="INFO",
            )
        ]

    return [
        PageFinding(
            rule="collection_empty",
            points=0,
            detail="Page collection failed and no usable fields were received.",
            tier="INFO",
        )
    ]
