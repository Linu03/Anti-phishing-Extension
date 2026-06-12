from __future__ import annotations

from typing import Literal

FreeHostingKind = Literal["suspicious", "developer"]

SUSPICIOUS_FREE_HOSTING: frozenset[str] = frozenset(
    {
        "jimdofree.com",
        "jimdosite.com",
        "weebly.com",
        "000webhostapp.com",
        "wixsite.com",
        "blogspot.com",
        "wordpress.com",
        "framer.app",
        "framer.website",
        "webflow.io",
        "editorx.io",
        "notion.site",
        "carrd.co",
        "godaddysites.com",
        "my.canva.site",
        "squarespace.com",
    }
)

DEVELOPER_FREE_HOSTING: frozenset[str] = frozenset(
    {
        "netlify.app",
        "vercel.app",
        "github.io",
        "gitlab.io",
        "firebaseapp.com",
        "web.app",
        "pages.dev",
        "glitch.me",
    }
)

FREE_HOSTING_ALL: frozenset[str] = SUSPICIOUS_FREE_HOSTING | DEVELOPER_FREE_HOSTING


def is_free_hosting(etld1: str) -> FreeHostingKind | None:
    """Classify a registrable domain (eTLD+1), not a full hostname.

    Examples:
        is_free_hosting("jimdofree.com") -> "suspicious"
        is_free_hosting("vercel.app") -> "developer"
        is_free_hosting("upt.ro") -> None
    """
    normalized = etld1.strip().lower()
    if normalized == "":
        return None

    if normalized in SUSPICIOUS_FREE_HOSTING:
        return "suspicious"
    if normalized in DEVELOPER_FREE_HOSTING:
        return "developer"
    return None
