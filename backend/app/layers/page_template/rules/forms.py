from __future__ import annotations

from urllib.parse import urljoin, urlparse

import tldextract

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)
from app.layers.url_analyzer.service import analyze_url

POINTS_INVALID_FORM_ACTION = 25
RULE_INVALID_FORM_ACTION = "invalid_form_action"

POINTS_SUBMIT_DESTINATION_CAP = 15
RULE_SUSPICIOUS_SUBMIT = "suspicious_submit_destination"

POINTS_HTTP_FORM_ACTION = 25
RULE_HTTP_FORM_ACTION = "http_form_action_on_https_page"

# not valid schemes for form action 
_INVALID_SCHEMES = frozenset({"javascript", "data", "vbscript"})


def _normalize_action_scheme(action: str) -> str | None:
    text = action.strip().lower()
    if text == "":
        return None

    for scheme in _INVALID_SCHEMES:
        prefix = f"{scheme}:"
        if text.startswith(prefix):
            return scheme

    return "other"


def _collect_submit_targets(snapshot: PageSnapshotModel) -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = []

    for form in snapshot.forms:
        action = form.action.strip()
        if action != "":
            targets.append((action, "form action"))

    for button in snapshot.submit_buttons:
        formaction = button.formaction.strip()
        if formaction != "":
            targets.append((formaction, "formaction"))

    return targets


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host)
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}".lower()


def _host_from_url(url: str) -> str:
    text = url.strip()
    if text == "":
        return ""

    if "://" not in text:
        text = f"https://{text}"

    parsed = urlparse(text)
    hostname = parsed.hostname
    if hostname is None:
        return ""

    return hostname.lower()


def _resolve_submit_url(action: str, snapshot: PageSnapshotModel) -> str | None:
    text = action.strip()
    if text == "":
        return None

    lower = text.lower()
    if lower.startswith("javascript:") or lower.startswith("data:") or lower.startswith("vbscript:"):
        return None

    if "://" in text:
        return text

    base = snapshot.page_origin.strip()
    if base == "":
        base = snapshot.page_url.strip()
    if base == "":
        return None

    if not base.endswith("/"):
        base = f"{base}/"

    return urljoin(base, text)


def _same_registrable_domain(page_host: str, submit_host: str) -> bool:
    page_pld = _registered_domain(page_host)
    submit_pld = _registered_domain(submit_host)
    if page_pld == "" or submit_pld == "":
        return False

    return page_pld == submit_pld



# use layer 3 URL analyzer to check if the form submit destination is suspicious
def check_suspicious_submit_destination(snapshot: PageSnapshotModel, _context: PriorLayersContextModel) -> list[PageFinding]:

    if not effective_has_credential_form(snapshot):
        return []

    page_host = _host_from_url(snapshot.page_url)
    if page_host == "":
        page_host = snapshot.page_host.strip().lower()

    targets = _collect_submit_targets(snapshot)
    if not targets:
        return []

    for action, source in targets:
        resolved = _resolve_submit_url(action, snapshot)
        if resolved is None:
            continue

        submit_host = _host_from_url(resolved)
        if submit_host == "":
            continue

        if page_host != "" and _same_registrable_domain(page_host, submit_host):
            continue

        try:
            url_result = analyze_url(resolved)
        except ValueError:
            continue

        url_score = url_result.get("score", 0)
        if not isinstance(url_score, int) or url_score <= 0:
            continue

        rule_names: list[str] = []
        for item in url_result.get("findings", []):
            if isinstance(item, dict) and isinstance(item.get("rule"), str):
                rule_names.append(item["rule"])

        rules_text = ", ".join(rule_names) if rule_names else "url_risk"
        layer_points = url_score
        if layer_points > POINTS_SUBMIT_DESTINATION_CAP:
            layer_points = POINTS_SUBMIT_DESTINATION_CAP

        return [
            PageFinding(
                rule=RULE_SUSPICIOUS_SUBMIT,
                points=layer_points,
                detail=(
                    f"Credential form {source} posts to suspicious URL "
                    f"'{resolved}' (URL analyzer: {rules_text})."
                ),
                tier="B",
            )
        ]

    return []


def check_http_form_action_on_https_page(snapshot: PageSnapshotModel, _context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    page_url = snapshot.page_url.strip()
    if urlparse(page_url).scheme.lower() != "https":
        return []

    for action, source in _collect_submit_targets(snapshot):
        text = action.strip()
        lower = text.lower()
        if lower.startswith(("javascript:", "data:", "vbscript:")):
            continue

        resolved = urljoin(page_url, text)
        if urlparse(resolved).scheme.lower() != "http":
            continue

        return [
            PageFinding(
                rule=RULE_HTTP_FORM_ACTION,
                points=POINTS_HTTP_FORM_ACTION,
                detail=(
                    f"Credential form {source} posts over HTTP to "
                    f"'{resolved}' while the page is HTTPS."
                ),
                tier="A",
            )
        ]

    return []


def check_invalid_form_action(
    snapshot: PageSnapshotModel,
    _context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    targets = _collect_submit_targets(snapshot)
    if not targets:
        return []

    for action, source in targets:
        scheme = _normalize_action_scheme(action)
        if scheme is None or scheme not in _INVALID_SCHEMES:
            continue

        return [
            PageFinding(
                rule=RULE_INVALID_FORM_ACTION,
                points=POINTS_INVALID_FORM_ACTION,
                detail=(
                    f"Credential form {source} uses {scheme}: URL "
                    f"(not a real HTTP endpoint)."
                ),
                tier="A",
            )
        ]

    return []
