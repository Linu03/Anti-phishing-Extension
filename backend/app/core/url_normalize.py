import unicodedata
from urllib.parse import ParseResult, urlparse

# characters that are invisible in the browser bar but change the real URL string
INVISIBLE_CHARACTERS = (
    "\u200b",  # zero-width space
    "\u200c",  # zero-width non-joiner
    "\u200d",  # zero-width joiner
    "\ufeff",  # byte order mark
)


def strip_invisible_characters(text: str) -> str:
    result = text
    for char in INVISIBLE_CHARACTERS:
        result = result.replace(char, "")
    return result


def normalize_url_input(url: str) -> tuple[str, str]:
    url_raw = url.strip()
    without_invisible = strip_invisible_characters(url_raw)
    url_clean = unicodedata.normalize("NFKC", without_invisible)
    return url_raw, url_clean


def parse_http_url(url: str) -> ParseResult:
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

    return parsed


def lookup_key_from_parsed(parsed: ParseResult) -> tuple[str, str]:
    host = (parsed.hostname or "").lower()
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    key = host + path
    return key, host


def normalize_for_lookup(url: str) -> tuple[str, str]:
    parsed = parse_http_url(url)
    return lookup_key_from_parsed(parsed)
