from __future__ import annotations

import tldextract

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.schemas import (
    BehaviorDiffModel,
    BehavioralContextModel,
    JsExfilAttemptModel,
)
from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.url_analyzer.brand_registry import get_brand_registry
from app.layers.url_analyzer.service import analyze_url

RULE_JS_EXFIL_SUBMIT = "js_exfil_submit"

POINTS_JS_EXFIL_HIGH = 26
POINTS_JS_EXFIL_MEDIUM = 14

URL_SUSPICIOUS_THRESHOLD = 15
DEST_URL_SUSPICIOUS_THRESHOLD = 10

TRUSTED_EXFIL_PLDS = frozenset(
    {
        "google.com",
        "googleapis.com",
        "gstatic.com",
        "googleusercontent.com",
        "youtube.com",
        "microsoft.com",
        "microsoftonline.com",
        "live.com",
        "office.com",
        "apple.com",
        "icloud.com",
        "facebook.com",
        "fbcdn.net",
        "cloudflare.com",
        "challenges.cloudflare.com",
        "stripe.com",
        "stripe.network",
        "paypal.com",
        "hcaptcha.com",
        "recaptcha.net",
        "doubleclick.net",
        "googletagmanager.com",
        "google-analytics.com",
        "hotjar.com",
        "clarity.ms",
        "jquery.com",
        "jsdelivr.net",
        "cloudfront.net",
        "akamaized.net",
    }
)

POST_LIKE_METHODS = frozenset({"POST", "PUT", "PATCH", "BEACON"})


def _all_official_domains() -> frozenset[str]:
    registry = get_impersonation_registry()
    domains: set[str] = set()
    for official in registry.brand_domains.values():
        domains.update(official)
    return frozenset(domains)


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host.strip().lower())
    if extracted.domain == "" or extracted.suffix == "":
        return ""
    return f"{extracted.domain}.{extracted.suffix}".lower()


def _is_trusted_exfil_pld(pld: str) -> bool:
    if pld == "":
        return True
    if pld in TRUSTED_EXFIL_PLDS:
        return True
    for trusted in TRUSTED_EXFIL_PLDS:
        if pld.endswith(f".{trusted}"):
            return True
    return False


def _page_has_sensitive_context(context: BehavioralContextModel) -> bool:
    return context.has_sensitive_form or context.has_credential_form


def _page_looks_dubious(context: BehavioralContextModel) -> bool:
    if context.blocklist_listed:
        return True
    score = context.url_analyzer_score
    if score is not None and score >= URL_SUSPICIOUS_THRESHOLD:
        return True
    page_score = context.page_template_score
    if page_score is not None and page_score >= URL_SUSPICIOUS_THRESHOLD:
        return True
    return False


def _dest_url_is_suspicious(dest_origin: str, dest_host: str) -> bool:
    candidate = dest_origin.strip() or f"https://{dest_host.strip()}"
    if candidate == "":
        return False
    try:
        result = analyze_url(candidate)
    except ValueError:
        return False
    score = result.get("score", 0)
    return isinstance(score, int) and score >= DEST_URL_SUSPICIOUS_THRESHOLD


def _filter_attempt(
    attempt: JsExfilAttemptModel,
    page_host: str,
    page_pld: str,
) -> JsExfilAttemptModel | None:
    method = (attempt.method or "").strip().upper()
    if method not in POST_LIKE_METHODS:
        return None

    dest_host = (attempt.dest_host or "").strip().lower()
    if dest_host == "":
        return None

    dest_pld = _registered_domain(dest_host)
    if dest_pld == "" or dest_pld == page_pld:
        return None

    if _is_trusted_exfil_pld(dest_pld):
        return None

    registry = get_brand_registry()
    if dest_pld in registry.legitimate_domains:
        return None

    if dest_pld in _all_official_domains():
        return None

    return attempt


def check_js_exfil_submit(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    if not _page_has_sensitive_context(context):
        return []

    page_host = (context.page_host or diff.end_host or diff.start_host).strip().lower()
    if page_host == "":
        return []

    page_pld = _registered_domain(page_host)
    if page_pld == "":
        return []

    attempts = diff.js_exfil_attempts or []
    if not attempts:
        return []

    filtered: list[JsExfilAttemptModel] = []
    seen_hosts: set[str] = set()
    for attempt in attempts:
        kept = _filter_attempt(attempt, page_host, page_pld)
        if kept is None:
            continue
        if kept.dest_host in seen_hosts:
            continue
        seen_hosts.add(kept.dest_host)
        filtered.append(kept)

    if not filtered:
        return []

    dubious_page = _page_looks_dubious(context)

    best_attempt = filtered[0]
    best_points = 0
    best_tier = "B"
    best_reason = "cross-domain JavaScript submit on a sensitive page"

    for attempt in filtered:
        dest_suspicious = _dest_url_is_suspicious(attempt.dest_origin, attempt.dest_host)
        if dest_suspicious or dubious_page:
            points = POINTS_JS_EXFIL_HIGH
            tier = "A"
            reason = (
                "destination URL looks suspicious"
                if dest_suspicious
                else "page already has other suspicious signals"
            )
        else:
            points = POINTS_JS_EXFIL_MEDIUM
            tier = "B"
            reason = "cross-domain JavaScript submit on a sensitive page"

        if points > best_points:
            best_attempt = attempt
            best_points = points
            best_tier = tier
            best_reason = reason

    via = best_attempt.via or "fetch"
    detail = (
        f"Sensitive page on '{page_host}' sent a {best_attempt.method} request via {via} "
        f"to '{best_attempt.dest_origin or best_attempt.dest_host}' after user interaction "
        f"({best_reason})."
    )

    if len(filtered) > 1:
        detail = f"{detail} (+{len(filtered) - 1} more cross-domain target(s))."

    return [
        BehavioralFinding(
            rule=RULE_JS_EXFIL_SUBMIT,
            points=best_points,
            detail=detail,
            tier=best_tier,
        )
    ]
