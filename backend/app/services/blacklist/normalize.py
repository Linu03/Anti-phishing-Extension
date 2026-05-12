from urllib.parse import urlparse


def normalize_for_lookup(url: str) -> tuple[str, str]:
    text = url.strip()
    if text == "":
        raise ValueError("empty url")

    if "://" not in text:
        text = "http://" + text

    parsed = urlparse(text)
    scheme = (parsed.scheme or "http").lower()
    if scheme not in ("http", "https"):
        raise ValueError("only http and https")

    host = (parsed.hostname or "").lower()
    if host == "":
        raise ValueError("bad host")

    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    key = host + path
    return key, host