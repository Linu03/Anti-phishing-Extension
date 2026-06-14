from __future__ import annotations

from app.layers.page_template.finding import PageFinding
from app.layers.page_template.schemas import (
    CaptchaSurfaceHintsModel,
    PageSnapshotModel,
    PriorLayersContextModel,
)

RULE_FAKE_CAPTCHA_SURFACE = "fake_captcha_surface"
RULE_CLICKFIX_LURE_SURFACE = "clickfix_lure_surface"

POINTS_FAKE_CAPTCHA_SURFACE = 32
POINTS_CLICKFIX_LURE_SURFACE = 62


def _surface_ready(hints: CaptchaSurfaceHintsModel) -> bool:
    if hints.has_real_captcha_widget:
        return False
    if not hints.has_standalone_checkbox:
        return False
    if not hints.has_captcha_like_text:
        return False
    return True


def check_clickfix_page_signals(
    snapshot: PageSnapshotModel,
    context: PriorLayersContextModel,
) -> list[PageFinding]:
    if context.whitelist_trusted:
        return []

    hints = snapshot.captcha_surface
    if not _surface_ready(hints):
        return []

    page_host = snapshot.page_host.strip() or snapshot.page_url

    if hints.has_clickfix_instruction_text:
        return [
            PageFinding(
                rule=RULE_CLICKFIX_LURE_SURFACE,
                points=POINTS_CLICKFIX_LURE_SURFACE,
                detail=(
                    f"Page on '{page_host}' mimics a CAPTCHA human-verification gate "
                    f"(checkbox + robot-check wording) and includes terminal-style "
                    f"instructions (Win+R / Ctrl+V) — possible ClickFix lure."
                ),
                tier="A",
            )
        ]

    return [
        PageFinding(
            rule=RULE_FAKE_CAPTCHA_SURFACE,
            points=POINTS_FAKE_CAPTCHA_SURFACE,
            detail=(
                f"Page on '{page_host}' shows CAPTCHA-style robot verification "
                f"(checkbox and challenge wording) without loading a real "
                f"Cloudflare/reCAPTCHA widget."
            ),
            tier="A",
        )
    ]
