from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_sensitive_form
from app.layers.page_template.rules.trust_context import (
    URL_SCORE_UNTRUSTED_THRESHOLD,
    has_brand_host_mismatch,
)
from app.layers.page_template.schemas import (
    ManipulationSurfaceHintsModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

RULE_PSYCHOLOGICAL_MANIPULATION = "psychological_manipulation_surface"
POINTS_PSYCHOLOGICAL_MANIPULATION = 12
MIN_ACTIVE_CATEGORIES = 2


def _relevant_brand_hits(snapshot: PageSnapshotModel) -> list[str]:
    merged: list[str] = []
    for brand in snapshot.primary_brand_hits + snapshot.brand_hits:
        key = brand.strip().lower()
        if key != "" and key not in merged:
            merged.append(key)
    return merged


def _active_manipulation_categories(
    hints: ManipulationSurfaceHintsModel,
    snapshot: PageSnapshotModel,
) -> list[str]:
    categories: list[str] = []

    if hints.has_urgency_fear_pressure:
        categories.append("urgency_fear")

    if hints.has_fake_social_proof_numeric:
        categories.append("social_proof")

    if hints.has_false_authority_language and len(_relevant_brand_hits(snapshot)) > 0:
        categories.append("false_authority")

    return categories


def _manipulation_gate(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> bool:
    if context.whitelist_trusted:
        return False

    if effective_has_sensitive_form(snapshot):
        return True

    if has_brand_host_mismatch(snapshot):
        return True

    url_score = context.url_analyzer_score
    if url_score is not None and url_score >= URL_SCORE_UNTRUSTED_THRESHOLD:
        return True

    return False


def _category_detail_label(category: str) -> str:
    if category == "urgency_fear":
        return "urgency or fear pressure"
    if category == "social_proof":
        return "numeric social-proof claims"
    if category == "false_authority":
        return "false authority tied to a detected brand"
    return category


def check_psychological_manipulation_surface(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not _manipulation_gate(snapshot, context):
        return []

    hints = snapshot.manipulation_surface
    categories = _active_manipulation_categories(hints, snapshot)
    if len(categories) < MIN_ACTIVE_CATEGORIES:
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url
    labels = ", ".join(_category_detail_label(item) for item in categories)

    return [
        PageFinding(
            rule=RULE_PSYCHOLOGICAL_MANIPULATION,
            points=POINTS_PSYCHOLOGICAL_MANIPULATION,
            detail=(
                f"Page on '{page_host}' combines persuasive manipulation cues "
                f"({labels}) on a page already flagged as suspicious — "
                f"common phishing pressure tactics."
            ),
            tier="B",
        )
    ]
