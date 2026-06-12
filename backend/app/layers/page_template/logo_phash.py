from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx
import imagehash
from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[3]
BRAND_LOGOS_DIR = BACKEND_ROOT / "app" / "data" / "brand_logos"

# pHash size: 8 -> 64-bit hash. Hamming distance is in [0, 64].
PHASH_SIZE = 8
PHASH_BITS = PHASH_SIZE * PHASH_SIZE

PHASH_SIMILARITY_HIGH = 0.90
PHASH_SIMILARITY_MEDIUM = 0.75
PHASH_SIMILARITY_FLOOR = 0.50

PHASH_DISTANCE_HIGH = 6
PHASH_DISTANCE_MEDIUM = 16
PHASH_MAX_DISTANCE = 32

LOGO_FILE_GLOB = "*.png"
VARIANT_SEPARATOR = "__"

MAX_IMAGE_BYTES = 4 * 1024 * 1024
FETCH_TIMEOUT = httpx.Timeout(8.0, connect=5.0)


@dataclass(frozen=True)
class BrandLogoEntry:
    brand: str
    path: Path
    phashes: tuple[imagehash.ImageHash, ...]


@dataclass(frozen=True)
class BrandMatch:
    brand: str
    distance: int
    similarity: float
    matched_path: str = ""


_registry: list[BrandLogoEntry] | None = None


def similarity_from_distance(distance: int) -> float:
    return 1.0 - (distance / PHASH_BITS)


def brand_id_from_logo_filename(path: Path) -> str:
    stem = path.stem.strip().lower()
    if stem == "":
        return ""
    if VARIANT_SEPARATOR in stem:
        return stem.split(VARIANT_SEPARATOR, 1)[0].strip()
    return stem


def _hash_variants(img: Image.Image) -> tuple[imagehash.ImageHash, ...]:
    gray = img.convert("L")
    return (
        imagehash.phash(gray, hash_size=PHASH_SIZE),
        imagehash.phash(ImageOps.invert(gray), hash_size=PHASH_SIZE),
    )


def _min_hash_distance(
    left: tuple[imagehash.ImageHash, ...],
    right: tuple[imagehash.ImageHash, ...],
) -> int:
    return min(candidate - reference for candidate in left for reference in right)


def _hash_variants_from_image(img: Image.Image) -> tuple[imagehash.ImageHash, ...] | None:
    try:
        return _hash_variants(img)
    except Exception as exc:  # pragma: no cover
        log.info("logo_phash: phash computation failed: %s", exc)
        return None


def _compute_phash_variants_from_path(path: Path) -> tuple[imagehash.ImageHash, ...] | None:
    try:
        with Image.open(path) as img:
            return _hash_variants(img)
    except (UnidentifiedImageError, OSError) as exc:
        log.warning("logo_phash: failed to read %s: %s", path, exc)
        return None


def load_brand_logo_registry(directory: Path | None = None) -> list[BrandLogoEntry]:
    target = directory or BRAND_LOGOS_DIR
    if not target.exists():
        log.info("logo_phash: brand logos dir missing: %s", target)
        return []

    entries: list[BrandLogoEntry] = []
    for path in sorted(target.glob(LOGO_FILE_GLOB)):
        brand = brand_id_from_logo_filename(path)
        if brand == "":
            continue
        phashes = _compute_phash_variants_from_path(path)
        if phashes is None:
            continue
        entries.append(BrandLogoEntry(brand=brand, path=path, phashes=phashes))

    log.info("logo_phash: loaded %d brand logos from %s", len(entries), target)
    return entries


def get_brand_logo_registry() -> list[BrandLogoEntry]:
    global _registry
    if _registry is None:
        _registry = load_brand_logo_registry()
    return _registry


def reset_brand_logo_registry() -> None:
    global _registry
    _registry = None


def _is_fetchable_image_url(image_url: str) -> bool:
    parsed = urlparse(image_url.strip())
    return parsed.scheme in {"http", "https"} and parsed.netloc != ""


async def fetch_image_bytes(
    client: httpx.AsyncClient,
    image_url: str,
) -> bytes | None:
    url = image_url.strip()
    if not _is_fetchable_image_url(url):
        return None

    try:
        response = await client.get(url, timeout=FETCH_TIMEOUT, follow_redirects=True)
    except Exception as exc:
        log.info("logo_phash: image fetch failed for %s: %s", url, exc)
        return None

    if response.status_code != 200:
        log.info("logo_phash: image fetch non-200 (%s) for %s", response.status_code, url)
        return None

    content = response.content
    if not content or len(content) > MAX_IMAGE_BYTES:
        return None

    return content


def _decode_image_bytes(raw: bytes) -> Image.Image | None:
    if not raw:
        return None
    try:
        return Image.open(io.BytesIO(raw))
    except (UnidentifiedImageError, OSError):
        return None


def _decode_image_b64(data_b64: str) -> Image.Image | None:
    payload = (data_b64 or "").strip()
    if payload == "":
        return None
    if payload.startswith("data:"):
        comma = payload.find(",")
        if comma == -1:
            return None
        payload = payload[comma + 1 :]

    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception:
        return None

    return _decode_image_bytes(raw)


def match_brand_by_hashes(
    candidate_phashes: tuple[imagehash.ImageHash, ...],
    registry: list[BrandLogoEntry] | None = None,
    max_distance: int = PHASH_MAX_DISTANCE,
) -> BrandMatch | None:
    entries = registry if registry is not None else get_brand_logo_registry()
    if not entries or not candidate_phashes:
        return None

    best: BrandLogoEntry | None = None
    best_distance = max_distance + 1

    for entry in entries:
        distance = _min_hash_distance(candidate_phashes, entry.phashes)
        if distance < best_distance:
            best_distance = distance
            best = entry

    if best is None or best_distance > max_distance:
        return None

    return BrandMatch(
        brand=best.brand,
        distance=best_distance,
        similarity=similarity_from_distance(best_distance),
        matched_path=best.path.name,
    )


async def _load_prominent_image(
    client: httpx.AsyncClient,
    image_b64: str,
    image_url: str,
) -> Image.Image | None:
    img = _decode_image_b64(image_b64)
    if img is not None:
        return img
    if image_url.strip() == "":
        return None
    raw = await fetch_image_bytes(client, image_url)
    if raw is None:
        return None
    return _decode_image_bytes(raw)


async def match_brand_from_prominent_image(
    client: httpx.AsyncClient,
    image_b64: str = "",
    image_url: str = "",
) -> BrandMatch | None:
    """Match using dual pHash (normal + inverted). Returns best brand if similarity >= 50%."""
    img = await _load_prominent_image(client, image_b64, image_url)
    if img is None:
        return None

    candidate_phashes = _hash_variants_from_image(img)
    if candidate_phashes is None:
        return None

    return match_brand_by_hashes(candidate_phashes)
