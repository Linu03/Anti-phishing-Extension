"""Shared allowlists for page-template rules (expanded in later steps)."""

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

MAX_LAYER_SCORE = 60
