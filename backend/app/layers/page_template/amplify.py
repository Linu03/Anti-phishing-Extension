from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import PageDiffModel, PriorLayersContextModel


def apply_amplification(
    base_score: int,
    findings: list[PageFinding],
    context: PriorLayersContextModel,
    diff: PageDiffModel | None,
) -> int:
    """Amplification policies (AMP-1..AMP-8) are added in later steps."""
    _ = (findings, context, diff)
    return base_score
