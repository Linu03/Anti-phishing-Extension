from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Literal

import asyncpg

from app.db.connection import get_pool

StatsPeriod = Literal["day", "week", "month", "year"]
Verdict = Literal["safe", "caution", "high_risk"]

PERIOD_INTERVALS: dict[StatsPeriod, str] = {
    "day": "1 day",
    "week": "7 days",
    "month": "30 days",
    "year": "365 days",
}

DEFAULT_LIST_LIMIT = 50
MAX_LIST_LIMIT = 200


def _period_since_sql(period: StatsPeriod) -> tuple[str, str]:
    interval = PERIOD_INTERVALS[period]
    return f"now() - interval '{interval}'", interval


def _parse_layer_scores(raw: Any) -> dict[str, int]:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return {}
    if not isinstance(raw, dict):
        return {}
    result: dict[str, int] = {}
    for key, value in raw.items():
        try:
            result[str(key)] = int(value)
        except (TypeError, ValueError):
            continue
    return result


def _row_to_scan_summary(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "scanned_at": row["scanned_at"].isoformat(),
        "page_url": row["page_url"],
        "page_host": row["page_host"],
        "page_title": row["page_title"],
        "threat_score": int(row["threat_score"]),
        "verdict": row["verdict"],
        "layer_scores": _parse_layer_scores(row["layer_scores"]),
    }


async def list_scans(
    *,
    limit: int = DEFAULT_LIST_LIMIT,
    offset: int = 0,
    verdict: Verdict | None = None,
    host: str | None = None,
    period: StatsPeriod | None = None,
) -> tuple[list[dict[str, Any]], int]:
    pool = get_pool()
    safe_limit = max(1, min(limit, MAX_LIST_LIMIT))
    safe_offset = max(0, offset)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if period is not None:
        since_sql, _ = _period_since_sql(period)
        conditions.append(f"scanned_at >= {since_sql}")

    if verdict is not None:
        conditions.append(f"verdict = ${param_idx}")
        params.append(verdict)
        param_idx += 1

    if host is not None and host.strip() != "":
        conditions.append(f"page_host ILIKE ${param_idx}")
        params.append(f"%{host.strip()}%")
        param_idx += 1

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS total FROM scans {where_clause}"
    list_sql = f"""
        SELECT id, scanned_at, page_url, page_host, page_title, threat_score, verdict, layer_scores
        FROM scans
        {where_clause}
        ORDER BY scanned_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """

    async with pool.acquire() as connection:
        total_row = await connection.fetchrow(count_sql, *params)
        total = int(total_row["total"]) if total_row is not None else 0

        list_params = [*params, safe_limit, safe_offset]
        rows = await connection.fetch(list_sql, *list_params)

    return [_row_to_scan_summary(row) for row in rows], total


async def get_scan_by_id(scan_id: int) -> dict[str, Any] | None:
    pool = get_pool()

    async with pool.acquire() as connection:
        scan_row = await connection.fetchrow(
            """
            SELECT id, scanned_at, page_url, page_host, page_title, threat_score, verdict, layer_scores
            FROM scans
            WHERE id = $1
            """,
            scan_id,
        )
        if scan_row is None:
            return None

        hit_rows = await connection.fetch(
            """
            SELECT layer_id, rule, points, tier, detail
            FROM rule_hits
            WHERE scan_id = $1
            ORDER BY points DESC, id ASC
            """,
            scan_id,
        )

    summary = _row_to_scan_summary(scan_row)
    summary["rule_hits"] = [
        {
            "layer_id": row["layer_id"],
            "rule": row["rule"],
            "points": int(row["points"]),
            "tier": row["tier"],
            "detail": row["detail"],
        }
        for row in hit_rows
    ]
    return summary


async def get_stats_summary(period: StatsPeriod) -> dict[str, Any]:
    pool = get_pool()
    since_sql, interval_label = _period_since_sql(period)

    async with pool.acquire() as connection:
        total_row = await connection.fetchrow(
            f"""
            SELECT COUNT(*) AS total
            FROM scans
            WHERE scanned_at >= {since_sql}
            """
        )
        verdict_rows = await connection.fetch(
            f"""
            SELECT verdict, COUNT(*) AS count
            FROM scans
            WHERE scanned_at >= {since_sql}
            GROUP BY verdict
            """
        )
        top_host_rows = await connection.fetch(
            f"""
            SELECT page_host, COUNT(*) AS count
            FROM scans
            WHERE scanned_at >= {since_sql}
            GROUP BY page_host
            ORDER BY count DESC, page_host ASC
            LIMIT 10
            """
        )
        since_row = await connection.fetchrow(f"SELECT {since_sql} AS since")

    by_verdict: dict[str, int] = {"safe": 0, "caution": 0, "high_risk": 0}
    for row in verdict_rows:
        by_verdict[str(row["verdict"])] = int(row["count"])

    since_dt = since_row["since"] if since_row is not None else datetime.now(timezone.utc)

    return {
        "period": period,
        "interval": interval_label,
        "since": since_dt.isoformat(),
        "total_scans": int(total_row["total"]) if total_row is not None else 0,
        "by_verdict": by_verdict,
        "top_hosts": [
            {"page_host": row["page_host"], "count": int(row["count"])}
            for row in top_host_rows
        ],
    }


async def export_scans_csv(period: StatsPeriod | None = None) -> str:
    pool = get_pool()
    conditions = ""
    if period is not None:
        since_sql, _ = _period_since_sql(period)
        conditions = f"WHERE scanned_at >= {since_sql}"

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT id, scanned_at, page_url, page_host, page_title, threat_score, verdict
            FROM scans
            {conditions}
            ORDER BY scanned_at DESC
            """
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["id", "scanned_at", "page_host", "page_title", "threat_score", "verdict", "page_url"]
    )
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["scanned_at"].isoformat(),
                row["page_host"],
                row["page_title"],
                row["threat_score"],
                row["verdict"],
                row["page_url"],
            ]
        )
    return buffer.getvalue()
