from __future__ import annotations

from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]

try:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND_ROOT / ".env")
except Exception:  # pragma: no cover - dotenv is optional at runtime
    pass
