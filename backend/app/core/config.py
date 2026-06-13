from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]

try:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND_ROOT / ".env")
except Exception:  # pragma: no cover - dotenv is optional at runtime
    pass


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default

    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    try:
        return float(raw.strip())
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    explain_enabled: bool
    ollama_base_url: str
    ollama_model: str
    explain_timeout_sec: float


@lru_cache
def get_settings() -> Settings:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip()
    if base_url.endswith("/"):
        base_url = base_url.rstrip("/")

    model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct").strip()
    if model == "":
        model = "qwen2.5:3b-instruct"

    return Settings(
        explain_enabled=_env_bool("EXPLAIN_ENABLED", True),
        ollama_base_url=base_url,
        ollama_model=model,
        explain_timeout_sec=_env_float("EXPLAIN_TIMEOUT_SEC", 15.0),
    )
