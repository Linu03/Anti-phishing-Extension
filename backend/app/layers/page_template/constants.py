from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

_CONSTANTS_PATH = Path(__file__)

IDP_SUBMIT_ORIGINS: frozenset[str] = frozenset(
    {
        "accounts.google.com",
        "login.microsoftonline.com",
        "login.live.com",
        "checkout.stripe.com",
        "js.stripe.com",
    }
)

SCRIPT_FP_ORIGINS: frozenset[str] = frozenset(
    {
        "www.gstatic.com",
        "gstatic.com",
        "www.google.com",
        "challenges.cloudflare.com",
        "cdnjs.cloudflare.com",
    }
)

IFRAME_TRUSTED_ORIGINS: frozenset[str] = frozenset(
    {
        "accounts.google.com",
        "login.microsoftonline.com",
        "login.live.com",
        "github.com",
        "challenges.cloudflare.com",
        "www.google.com",
        "www.recaptcha.net",
        "checkout.stripe.com",
        "js.stripe.com",
        "www.paypal.com",
    }
)

IFRAME_MAX_TOTAL_POINTS = 20

REAL_CAPTCHA_WIDGET_ORIGINS: frozenset[str] = frozenset(
    {
        "challenges.cloudflare.com",
        "www.recaptcha.net",
        "recaptcha.net",
        "hcaptcha.com",
        "newassets.hcaptcha.com",
    }
)

MAX_LAYER_SCORE = 65


def get_script_fp_origins_catalog() -> tuple[list[str], str]:
    """CDN/widget hosts excluded from external resource ratio (client collector)."""
    origins = sorted(SCRIPT_FP_ORIGINS)

    try:
        mtime = _CONSTANTS_PATH.stat().st_mtime
        version = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    except OSError:
        version = "unknown"

    return origins, version
