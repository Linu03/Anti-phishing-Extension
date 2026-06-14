from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import asyncpg

from app.db.connection import get_pool

DEDUP_WINDOW_SECONDS = 300
DETAIL_MAX_LEN = 500
VALID_VERDICTS = frozenset({"safe", "caution", "high_risk"})


@dataclass(frozen=True)
class RuleHitInput:
    layer_id: str
    rule: str
    points: int
    tier: str
    detail: str


@dataclass(frozen=True)
class ScanIngestInput:
    page_url: str
    page_host: str
    page_title: str
    threat_score: int
    verdict: str
    layer_scores: dict[str, int]
    rule_hits: list[RuleHitInput]


def page_host_from_url(page_url: str) -> str:
    text = (page_url or "").strip()
    if text == "" or text == "(no url)":
        return ""

    candidate = text
    if "://" not in candidate:
        candidate = f"http://{candidate}"

    try:
        parsed = urlparse(candidate)
    except ValueError:
        return ""

    host = (parsed.hostname or "").strip().lower()
    if host == "":
        return ""

    port = parsed.port
    if port is not None:
        return f"{host}:{port}"
    return host


def _clamp_threat_score(value: int) -> int:
    if value < 0:
        return 0
    if value > 100:
        return 100
    return value


def _truncate_detail(text: str) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= DETAIL_MAX_LEN:
        return cleaned
    return cleaned[:DETAIL_MAX_LEN]


def build_scan_ingest_input(payload: dict[str, Any]) -> ScanIngestInput:
    page_url = str(payload.get("page_url", "")).strip()
    page_title = str(payload.get("page_title", "")).strip()
    verdict = str(payload.get("verdict", "")).strip().lower()
    if verdict not in VALID_VERDICTS:
        raise ValueError(f"invalid verdict: {verdict}")

    page_host = page_host_from_url(page_url)
    if page_host == "":
        raise ValueError("could not derive page_host from page_url")

    threat_score = _clamp_threat_score(int(payload.get("threat_score", 0)))

    layer_scores: dict[str, int] = {}
    rule_hits: list[RuleHitInput] = []

    layers_raw = payload.get("layers")
    if isinstance(layers_raw, list):
        for layer in layers_raw:
            if not isinstance(layer, dict):
                continue
            layer_id = str(layer.get("id", "")).strip()
            if layer_id == "":
                continue
            try:
                contribution = int(layer.get("contribution", 0))
            except (TypeError, ValueError):
                contribution = 0
            layer_scores[layer_id] = contribution

            findings_raw = layer.get("findings")
            if not isinstance(findings_raw, list):
                continue
            for finding in findings_raw:
                if not isinstance(finding, dict):
                    continue
                rule = str(finding.get("rule", "")).strip()
                if rule == "":
                    continue
                try:
                    points = int(finding.get("points", 0))
                except (TypeError, ValueError):
                    points = 0
                tier = str(finding.get("tier", "")).strip()
                detail = _truncate_detail(str(finding.get("detail", "")))
                rule_hits.append(
                    RuleHitInput(
                        layer_id=layer_id,
                        rule=rule,
                        points=points,
                        tier=tier,
                        detail=detail,
                    )
                )

    return ScanIngestInput(
        page_url=page_url,
        page_host=page_host,
        page_title=page_title,
        threat_score=threat_score,
        verdict=verdict,
        layer_scores=layer_scores,
        rule_hits=rule_hits,
    )


async def _find_recent_scan_id(
    connection: asyncpg.Connection,
    page_host: str,
) -> int | None:
    row = await connection.fetchrow(
        """
        SELECT id
        FROM scans
        WHERE page_host = $1
          AND scanned_at >= now() - ($2 * interval '1 second')
        ORDER BY scanned_at DESC
        LIMIT 1
        """,
        page_host,
        DEDUP_WINDOW_SECONDS,
    )
    if row is None:
        return None
    return int(row["id"])


async def _insert_rule_hits(
    connection: asyncpg.Connection,
    scan_id: int,
    rule_hits: list[RuleHitInput],
) -> None:
    if not rule_hits:
        return

    await connection.executemany(
        """
        INSERT INTO rule_hits (scan_id, layer_id, rule, points, tier, detail)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        [
            (
                scan_id,
                item.layer_id,
                item.rule,
                item.points,
                item.tier,
                item.detail,
            )
            for item in rule_hits
        ],
    )


async def persist_scan(data: ScanIngestInput) -> tuple[int, bool]:
    """Returns (scan_id, created_new_row)."""
    pool = get_pool()
    layer_scores_json = json.dumps(data.layer_scores, ensure_ascii=False)

    async with pool.acquire() as connection:
        async with connection.transaction():
            existing_id = await _find_recent_scan_id(connection, data.page_host)

            if existing_id is not None:
                await connection.execute(
                    """
                    UPDATE scans
                    SET scanned_at = now(),
                        page_url = $2,
                        page_title = $3,
                        threat_score = $4,
                        verdict = $5,
                        layer_scores = $6::jsonb
                    WHERE id = $1
                    """,
                    existing_id,
                    data.page_url,
                    data.page_title,
                    data.threat_score,
                    data.verdict,
                    layer_scores_json,
                )
                await connection.execute(
                    "DELETE FROM rule_hits WHERE scan_id = $1",
                    existing_id,
                )
                await _insert_rule_hits(connection, existing_id, data.rule_hits)
                return existing_id, False

            row = await connection.fetchrow(
                """
                INSERT INTO scans (
                    scanned_at,
                    page_url,
                    page_host,
                    page_title,
                    threat_score,
                    verdict,
                    layer_scores
                )
                VALUES (now(), $1, $2, $3, $4, $5, $6::jsonb)
                RETURNING id
                """,
                data.page_url,
                data.page_host,
                data.page_title,
                data.threat_score,
                data.verdict,
                layer_scores_json,
            )
            if row is None:
                raise RuntimeError("failed to insert scan row")

            scan_id = int(row["id"])
            await _insert_rule_hits(connection, scan_id, data.rule_hits)
            return scan_id, True
