from __future__ import annotations

import logging

from app.db.connection import close_pool, is_pool_ready, open_pool
from app.db.schema import apply_schema

log = logging.getLogger(__name__)


async def init_database() -> None:
    pool = await open_pool()
    await apply_schema(pool)
    log.info("postgresql schema ready")


async def ensure_database_ready() -> bool:
    if is_pool_ready():
        return True

    try:
        await init_database()
    except Exception as exc:
        log.warning("postgresql connect retry failed: %s", exc)
        return False

    return is_pool_ready()


async def shutdown_database() -> None:
    if not is_pool_ready():
        return
    await close_pool()
    log.info("postgresql pool closed")
