from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import PriorLayersContextModel

RULE_BRAND_MISMATCH = "brand_page_host_mismatch"
RULE_SENSITIVE_COLLECTION = "sensitive_field_collection"
RULE_NEWLY_REGISTERED = "newly_registered_domain"
RULE_AMP_YOUNG_DOMAIN_IMPERSONATION = "young_domain_sensitive_impersonation"

AMP_URL_WITH_BRAND_POINTS = 12
AMP_YOUNG_DOMAIN_IMPERSONATION_POINTS = 18

_URL_RULES_AMP_WITH_BRAND = frozenset(
    {
        "typosquatting",
        "nested_url_in_query",
        "hosting_brand_matrix",
        "combosquatting_label",
    }
)


def apply_amplification(
    base_score: int,
    findings: list[PageFinding],
    context: PriorLayersContextModel,
) -> tuple[int, list[PageFinding]]:
    bonus = 0
    extra_findings: list[PageFinding] = []

    if context.whitelist_trusted:
        return base_score, extra_findings

    has_brand_mismatch = any(item.rule == RULE_BRAND_MISMATCH for item in findings)
    if not has_brand_mismatch:
        return base_score, extra_findings

    for url_rule in context.url_analyzer_rules:
        if url_rule in _URL_RULES_AMP_WITH_BRAND:
            bonus = bonus + AMP_URL_WITH_BRAND_POINTS
            break

    has_sensitive_collection = any(
        item.rule == RULE_SENSITIVE_COLLECTION for item in findings
    )
    has_newly_registered = RULE_NEWLY_REGISTERED in context.url_analyzer_rules

    if has_sensitive_collection and has_newly_registered:
        bonus = bonus + AMP_YOUNG_DOMAIN_IMPERSONATION_POINTS
        extra_findings.append(
            PageFinding(
                rule=RULE_AMP_YOUNG_DOMAIN_IMPERSONATION,
                points=AMP_YOUNG_DOMAIN_IMPERSONATION_POINTS,
                detail=(
                    "Very new domain hosts a page that impersonates a known brand "
                    "and collects sensitive payment or identity data — a combined "
                    "signal that is rare on legitimate sites."
                ),
                tier="A",
            )
        )

    return base_score + bonus, extra_findings
