from __future__ import annotations

from urllib.parse import urlparse

import tldextract

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.rules.credential import effective_has_credential_form
from app.layers.page_template.schemas import (
    PageDiffModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

POINTS_META_REFRESH_CROSS = 15
POINTS_META_REFRESH_INSTANT_BONUS = 5
RULE_META_REFRESH = "meta_refresh_cross_domain"

POINTS_BASE_HREF_CROSS = 25
RULE_BASE_HREF = "base_href_cross_domain"

POINTS_CANONICAL_MISMATCH = 8
RULE_CANONICAL = "canonical_host_mismatch"


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


def _pld_mismatch(page_host: str, other_host: str) -> bool:
    page_pld = _registered_domain(page_host)
    other_pld = _registered_domain(other_host)
    if page_pld == "" or other_pld == "":
        return False

    return page_pld != other_pld


def check_meta_refresh_cross_domain(snapshot: PageSnapshotModel,_diff: PageDiffModel | None,_context: PriorLayersContextModel) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    target = snapshot.meta_refresh_target.strip()
    if target == "":
        return []

    page_host = _page_host(snapshot)
    target_host = _host_from_text(target)
    if page_host == "" or target_host == "":
        return []

    if not _pld_mismatch(page_host, target_host):
        return []

    points = POINTS_META_REFRESH_CROSS
    delay = snapshot.meta_refresh_delay_sec
    if delay is not None and delay == 0:
        points = points + POINTS_META_REFRESH_INSTANT_BONUS

    delay_text = "instant" if delay == 0 else f"after {delay}s" if delay is not None else "delayed"

    return [
        PageFinding(
            rule=RULE_META_REFRESH,
            points=points,
            detail=(
                f"Meta refresh redirects ({delay_text}) to '{target_host}' "
                f"while the page is on '{page_host}' (different registrable domain)."
            ),
            tier="B",
        )
    ]


def check_base_href_cross_domain(snapshot: PageSnapshotModel,_diff: PageDiffModel | None,_context: PriorLayersContextModel,) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    base_origin = snapshot.base_href_origin.strip()
    if base_origin == "":
        return []

    page_host = _page_host(snapshot)
    base_host = _host_from_text(base_origin)
    if page_host == "" or base_host == "":
        return []

    if not _pld_mismatch(page_host, base_host):
        return []

    return [
        PageFinding(
            rule=RULE_BASE_HREF,
            points=POINTS_BASE_HREF_CROSS,
            detail=(
                f"Document <base href> origin points to '{base_host}' "
                f"while the page is on '{page_host}' (different registrable domain)."
            ),
            tier="A",
        )
    ]


def check_canonical_host_mismatch(
    snapshot: PageSnapshotModel,
    _diff: PageDiffModel | None,
    _context: PriorLayersContextModel,
) -> list[PageFinding]:
    if not effective_has_credential_form(snapshot):
        return []

    canonical_host = snapshot.canonical_host.strip().lower()
    if canonical_host == "":
        return []

    page_host = _page_host(snapshot)
    if page_host == "":
        return []

    if not _pld_mismatch(page_host, canonical_host):
        return []

    return [
        PageFinding(
            rule=RULE_CANONICAL,
            points=POINTS_CANONICAL_MISMATCH,
            detail=(
                f"Canonical link host '{canonical_host}' differs from page host "
                f"'{page_host}' (different registrable domain)."
            ),
            tier="B",
        )
    ]
