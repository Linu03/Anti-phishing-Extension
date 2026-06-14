from __future__ import annotations

import os
from pathlib import Path

import asyncpg

_BACKEND_ROOT = Path(__file__).resolve().parents[2]

try:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND_ROOT / ".env")
except Exception:  # pragma: no cover
    pass

DEFAULT_DATABASE_URL = "postgresql://afs:afs@127.0.0.1:5432/afs"

_pool: asyncpg.Pool | None = None


def get_database_url() -> str:
    raw = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL).strip()
    if raw == "":
        return DEFAULT_DATABASE_URL
    return raw


def is_pool_ready() -> bool:
    return _pool is not None


async def open_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool

    _pool = await asyncpg.create_pool(
        get_database_url(),
        min_size=1,
        max_size=5,
        command_timeout=30.0,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("database pool is not initialized")
    return _pool
