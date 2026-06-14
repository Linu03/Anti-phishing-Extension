from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.db.connection import is_pool_ready
from app.services.scan_query import StatsPeriod, export_scans_csv, get_stats_summary

router = APIRouter(prefix="/stats", tags=["stats"])


class VerdictCounts(BaseModel):
    safe: int = 0
    caution: int = 0
    high_risk: int = 0


class TopHostItem(BaseModel):
    page_host: str
    count: int


class StatsSummaryResponse(BaseModel):
    period: StatsPeriod
    interval: str
    since: str
    total_scans: int
    by_verdict: VerdictCounts
    top_hosts: list[TopHostItem] = Field(default_factory=list)


@router.get("/summary", response_model=StatsSummaryResponse)
async def stats_summary(
    period: StatsPeriod = Query(default="week"),
) -> StatsSummaryResponse:
    if not is_pool_ready():
        raise HTTPException(status_code=503, detail="database unavailable")

    try:
        payload = await get_stats_summary(period)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"could not load stats: {exc}") from exc

    return StatsSummaryResponse(
        period=payload["period"],
        interval=payload["interval"],
        since=payload["since"],
        total_scans=payload["total_scans"],
        by_verdict=VerdictCounts(**payload["by_verdict"]),
        top_hosts=[TopHostItem(**item) for item in payload["top_hosts"]],
    )


@router.get("/export.csv")
async def stats_export_csv(
    period: StatsPeriod | None = Query(default=None),
) -> PlainTextResponse:
    if not is_pool_ready():
        raise HTTPException(status_code=503, detail="database unavailable")

    try:
        csv_text = await export_scans_csv(period)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"could not export scans: {exc}") from exc

    filename = "scans.csv" if period is None else f"scans_{period}.csv"
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
