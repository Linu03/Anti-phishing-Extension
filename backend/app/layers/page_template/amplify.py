from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import PriorLayersContextModel


_URL_RULES_AMP_WITH_BRAND = frozenset({"typosquatting", "nested_url", "brand_in_subdomain"})


def apply_amplification(
    base_score: int,
    findings: list[PageFinding],
    context: PriorLayersContextModel,
) -> int:
    score = base_score

    has_brand_mismatch = any(item.rule == "brand_page_host_mismatch" for item in findings)
    if has_brand_mismatch:
        for url_rule in context.url_analyzer_rules:
            if url_rule in _URL_RULES_AMP_WITH_BRAND:
                score = score + 10
                break

    return score
