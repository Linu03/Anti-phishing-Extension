from urllib.parse import urlparse


def normalize_for_lookup(url: str) -> tuple[str, str]:
    raw = url.strip()
    if not raw:
        raise ValueError("Empty URL")

    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    scheme = (parsed.scheme or "http").lower()
    if scheme not in ("http", "https"):
        raise ValueError("Not allowed scheme - only http and https are allowed")

    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("Can't parse host from URL")

    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return f"{host}{path}", host
