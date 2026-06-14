from __future__ import annotations

import asyncpg

SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS scans (
        id            BIGSERIAL PRIMARY KEY,
        scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        page_url      TEXT NOT NULL,
        page_host     TEXT NOT NULL,
        page_title    TEXT NOT NULL DEFAULT '',
        threat_score  SMALLINT NOT NULL,
        verdict       TEXT NOT NULL CHECK (verdict IN ('safe', 'caution', 'high_risk')),
        layer_scores  JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_scans_scanned_at
        ON scans (scanned_at DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_scans_page_host
        ON scans (page_host);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_scans_verdict
        ON scans (verdict);
    """,
    """
    CREATE TABLE IF NOT EXISTS rule_hits (
        id        BIGSERIAL PRIMARY KEY,
        scan_id   BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        layer_id  TEXT NOT NULL,
        rule      TEXT NOT NULL,
        points    SMALLINT NOT NULL,
        tier      TEXT NOT NULL DEFAULT '',
        detail    TEXT NOT NULL DEFAULT ''
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rule_hits_scan_id
        ON rule_hits (scan_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rule_hits_rule
        ON rule_hits (rule);
    """,
)


async def apply_schema(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as connection:
        async with connection.transaction():
            for statement in SCHEMA_STATEMENTS:
                await connection.execute(statement)
