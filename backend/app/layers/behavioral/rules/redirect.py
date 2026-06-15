from __future__ import annotations

import tldextract

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel
from app.layers.url_analyzer.official_domains import is_official_registered_domain

RAPID_REDIRECT_MS = 3000
URL_SUSPICIOUS_THRESHOLD = 15

POINTS_RAPID_REDIRECT_HIGH = 26
POINTS_RAPID_REDIRECT_LOW = 10

RULE_RAPID_REDIRECT = "rapid_cross_domain_redirect"


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}".lower()


def _page_on_official_domain(context: BehavioralContextModel) -> bool:
    page_host = context.page_host.strip()
    if page_host == "":
        return False
    return is_official_registered_domain(page_host)


def _has_phishing_context(context: BehavioralContextModel) -> bool:
    if context.has_sensitive_form:
        return True

    if context.has_credential_form and not _page_on_official_domain(context):
        return True

    score = context.url_analyzer_score
    if score is not None and score >= URL_SUSPICIOUS_THRESHOLD:
        return True

    return False


def check_rapid_cross_domain_redirect(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    start_host = diff.start_host.strip().lower()
    end_host = diff.end_host.strip().lower()
    if start_host == "" or end_host == "" or start_host == end_host:
        return []

    start_pld = _registered_domain(start_host)
    end_pld = _registered_domain(end_host)
    if start_pld == "" or end_pld == "" or start_pld == end_pld:
        return []

    if is_official_registered_domain(start_host) and is_official_registered_domain(
        end_host
    ):
        return []

    condition_timing = 0 < diff.redirect_ms <= RAPID_REDIRECT_MS
    condition_phishing_context = _has_phishing_context(context)

    if condition_timing and condition_phishing_context:
        return [
            BehavioralFinding(
                rule=RULE_RAPID_REDIRECT,
                points=POINTS_RAPID_REDIRECT_HIGH,
                detail=(
                    f"Page redirected from '{start_host}' to '{end_host}' "
                    f"in {diff.redirect_ms}ms after load — rapid cross-domain "
                    f"bait-and-switch with suspicious page context."
                ),
                tier="A",
            )
        ]

    if condition_phishing_context:
        return [
            BehavioralFinding(
                rule=RULE_RAPID_REDIRECT,
                points=POINTS_RAPID_REDIRECT_LOW,
                detail=(
                    f"Page redirected from '{start_host}' to '{end_host}' "
                    f"after load on a page with suspicious signals."
                ),
                tier="C",
            )
        ]

    return []
