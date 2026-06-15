from __future__ import annotations

from app.layers.page_template.constants import IDP_SUBMIT_ORIGINS
from app.layers.page_template.finding import PageFinding
from app.layers.page_template.impersonation_registry import get_impersonation_registry
from app.layers.page_template.rules.brand import _host_from_origin, host_matches_brand
from app.layers.page_template.rules.credential import effective_has_sensitive_form
from app.layers.page_template.schemas import PageSnapshotModel, PriorLayersContextModel

RULE_OAUTH_AITM_LOGIN_SURFACE = "oauth_aitm_login_surface"
RULE_IDP_FORM_ON_FOREIGN_HOST = "idp_form_on_foreign_host"

POINTS_OAUTH_AITM = 35
POINTS_IDP_FORM_ON_FOREIGN_HOST = 28


def _primary_oauth_brand_hits(snapshot: PageSnapshotModel) -> list[str]:
    registry = get_impersonation_registry()
    hits: list[str] = []

    for raw in snapshot.primary_brand_hits:
        brand = raw.strip().lower()
        if brand == "":
            continue
        if brand not in registry.oauth_brands:
            continue
        if brand not in registry.brand_domains:
            continue
        if brand in hits:
            continue
        hits.append(brand)

    return hits


def has_oauth_login_identifier(snapshot: PageSnapshotModel) -> bool:
    profile = snapshot.field_profile
    if not profile.has_email and not profile.has_tel:
        return False
    return not effective_has_sensitive_form(snapshot)


def _mismatched_oauth_brands(snapshot: PageSnapshotModel) -> list[str]:
    registry = get_impersonation_registry()
    mismatched: list[str] = []

    for brand in _primary_oauth_brand_hits(snapshot):
        official_domains = registry.brand_domains.get(brand)
        if official_domains is None:
            continue
        if host_matches_brand(snapshot.page_host, brand, official_domains):
            continue
        mismatched.append(brand)

    return mismatched


def _oauth_brand_for_idp_host(idp_host: str) -> str | None:
    registry = get_impersonation_registry()
    host = idp_host.strip().lower()
    if host not in IDP_SUBMIT_ORIGINS:
        return None

    for brand in registry.oauth_brands:
        official_domains = registry.brand_domains.get(brand)
        if official_domains is None:
            continue
        if host_matches_brand(host, brand, official_domains):
            return brand

    return None


def _collect_idp_submit_hosts(snapshot: PageSnapshotModel) -> list[str]:
    hosts: list[str] = []
    seen: set[str] = set()

    for form in snapshot.forms:
        host = _host_from_origin(form.action_origin)
        if host == "" or host not in IDP_SUBMIT_ORIGINS:
            continue
        if host in seen:
            continue
        seen.add(host)
        hosts.append(host)

    for button in snapshot.submit_buttons:
        host = _host_from_origin(button.formaction_origin)
        if host == "" or host not in IDP_SUBMIT_ORIGINS:
            continue
        if host in seen:
            continue
        seen.add(host)
        hosts.append(host)

    return hosts


def check_idp_form_on_foreign_host(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if context.whitelist_trusted:
        return []

    mismatched = set(_mismatched_oauth_brands(snapshot))
    if not mismatched:
        return []

    idp_hosts = _collect_idp_submit_hosts(snapshot)
    if not idp_hosts:
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url

    for idp_host in idp_hosts:
        brand = _oauth_brand_for_idp_host(idp_host)
        if brand is None or brand not in mismatched:
            continue

        return [
            PageFinding(
                rule=RULE_IDP_FORM_ON_FOREIGN_HOST,
                points=POINTS_IDP_FORM_ON_FOREIGN_HOST,
                detail=(
                    f"Page on host '{page_host}' submits login form to official "
                    f"'{brand}' identity provider '{idp_host}' — "
                    f"possible adversary-in-the-middle / proxy phishing."
                ),
                tier="A",
            )
        ]

    return []


def check_oauth_aitm_login_surface(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if context.whitelist_trusted:
        return []

    if not has_oauth_login_identifier(snapshot):
        return []

    mismatched = _mismatched_oauth_brands(snapshot)
    if not mismatched:
        return []

    brand = mismatched[0]
    page_host = snapshot.page_host.strip() or snapshot.page_url

    identifier = "email"
    if snapshot.field_profile.has_tel and not snapshot.field_profile.has_email:
        identifier = "phone"

    return [
        PageFinding(
            rule=RULE_OAUTH_AITM_LOGIN_SURFACE,
            points=POINTS_OAUTH_AITM,
            detail=(
                f"Page presents '{brand}' login (asks for {identifier}) on host "
                f"'{page_host}', not an official '{brand}' domain — "
                f"possible adversary-in-the-middle / proxy phishing."
            ),
            tier="A",
        )
    ]
