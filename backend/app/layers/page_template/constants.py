
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

MAX_LAYER_SCORE = 60
