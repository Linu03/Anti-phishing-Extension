from __future__ import annotations
from urllib.parse import urlparse

import tldextract

from app.layers.page_template.constants import IFRAME_MAX_TOTAL_POINTS, IFRAME_TRUSTED_ORIGINS
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.schemas import (
    IframeSnapshotModel,
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_HIDDEN_CROSS_ORIGIN = 15
POINTS_CROSS_ORIGIN_VISIBLE = 10

RULE_HIDDEN_CROSS_ORIGIN = "hidden_cross_origin_iframe"
RULE_CROSS_ORIGIN_VISIBLE = "cross_origin_iframe"

_SKIP_SRC_PREFIXES = ("about:", "javascript:", "data:", "blob:")


def _registered_domain(host: str) -> str:
    extracted = tldextract.extract(host)
    if extracted.domain == "" or extracted.suffix == "":
        return ""

    return f"{extracted.domain}.{extracted.suffix}".lower()


def _host_from_text(text: str) -> str:
    value = text.strip()
    if value == "":
        return ""

    if "://" not in value:
        value = f"https://{value}"

    parsed = urlparse(value)
    hostname = parsed.hostname
    if hostname is None:
        return ""

    return hostname.lower()


def _page_host(snapshot: PageSnapshotModel) -> str:
    host = snapshot.page_host.strip().lower()
    if host != "":
        return host

    return _host_from_text(snapshot.page_url)


def _is_skippable_src(src_origin: str) -> bool:
    text = src_origin.strip().lower()
    if text == "":
        return True

    for prefix in _SKIP_SRC_PREFIXES:
        if text.startswith(prefix):
            return True

    return False


def _is_trusted_origin(host: str) -> bool:
    return host in IFRAME_TRUSTED_ORIGINS


def _is_cross_origin(page_host: str, iframe_host: str) -> bool:
    page_pld = _registered_domain(page_host)
    iframe_pld = _registered_domain(iframe_host)
    if page_pld == "" or iframe_pld == "":
        return False

    return page_pld != iframe_pld


def _classify_iframe(
    iframe: IframeSnapshotModel,
    page_host: str,
) -> str | None:
    if _is_skippable_src(iframe.src_origin):
        return None

    iframe_host = _host_from_text(iframe.src_origin)
    if iframe_host == "":
        return None

    if _is_trusted_origin(iframe_host):
        return None

    if not _is_cross_origin(page_host, iframe_host):
        return None

    if iframe.is_hidden:
        return "hidden"

    return "visible"


def _format_hosts(hosts: list[str]) -> str:
    if len(hosts) == 1:
        return f"'{hosts[0]}'"

    return f"'{hosts[0]}' (+{len(hosts) - 1} more)"


def _apply_iframe_points_cap(findings: list[PageFinding]) -> list[PageFinding]:
    total = sum(item.points for item in findings)
    if total <= IFRAME_MAX_TOTAL_POINTS:
        return findings

    excess = total - IFRAME_MAX_TOTAL_POINTS
    adjusted: list[PageFinding] = []

    for item in reversed(findings):
        if excess <= 0:
            adjusted.insert(0, item)
            continue

        new_points = item.points - excess
        excess = 0
        if new_points <= 0:
            continue

        adjusted.insert(
            0,
            PageFinding(
                rule=item.rule,
                points=new_points,
                detail=item.detail,
                tier=item.tier,
            ),
        )

    return adjusted


def check_iframe_signals(snapshot: PageSnapshotModel, _diff: PageDiffModel | None,_context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    page_host = _page_host(snapshot)
    if page_host == "":
        return []

    hidden_hosts: list[str] = []
    visible_hosts: list[str] = []

    for iframe in snapshot.iframes:
        category = _classify_iframe(iframe, page_host)
        if category is None:
            continue

        iframe_host = _host_from_text(iframe.src_origin)
        if category == "hidden":
            hidden_hosts.append(iframe_host)
        else:
            visible_hosts.append(iframe_host)

    findings: list[PageFinding] = []

    if hidden_hosts:
        findings.append(
            PageFinding(
                rule=RULE_HIDDEN_CROSS_ORIGIN,
                points=POINTS_HIDDEN_CROSS_ORIGIN,
                detail=(
                    f"Hidden iframe loads external origin {_format_hosts(hidden_hosts)} "
                    f"while the page is on '{page_host}' (not a trusted provider)."
                ),
                tier="B",
            )
        )

    if visible_hosts:
        findings.append(
            PageFinding(
                rule=RULE_CROSS_ORIGIN_VISIBLE,
                points=POINTS_CROSS_ORIGIN_VISIBLE,
                detail=(
                    f"Visible iframe loads external origin {_format_hosts(visible_hosts)} "
                    f"while the page is on '{page_host}' (not on trusted providers list)."
                ),
                tier="B",
            )
        )

    return _apply_iframe_points_cap(findings)
