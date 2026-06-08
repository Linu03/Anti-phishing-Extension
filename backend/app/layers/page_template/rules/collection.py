from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import (
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_COLLECTION_FAILED = 10
RULE_COLLECTION_FAILED = "collection_failed"
RULE_COLLECTION_PARTIAL = "collection_partial"


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


def check_collection_status(
    snapshot: PageSnapshotModel,
    _diff: PageDiffModel | None,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if snapshot.collection_ok:
        return []

    if _snapshot_has_usable_fields(snapshot):
        return [
            PageFinding(
                rule=RULE_COLLECTION_PARTIAL,
                points=0,
                detail="Incomplete page snapshot; rules still run on received fields.",
                tier="INFO",
            )
        ]

    if context.whitelist_trusted:
        return [
            PageFinding(
                rule=RULE_COLLECTION_FAILED,
                points=0,
                detail=(
                    "Page collection failed on a trusted site; "
                    "Layer 5 abstains from scoring."
                ),
                tier="INFO",
            )
        ]

    return [
        PageFinding(
            rule=RULE_COLLECTION_FAILED,
            points=POINTS_COLLECTION_FAILED,
            detail="Page collection failed; page structure could not be verified.",
            tier="B",
        )
    ]
