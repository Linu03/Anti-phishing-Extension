from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.db.connection import is_pool_ready
from app.services.scan_query import StatsPeriod, get_scan_by_id, list_scans
from app.services.scan_store import build_scan_ingest_input, persist_scan

router = APIRouter(prefix="/scans", tags=["scans"])


class LayerFindingIn(BaseModel):
    rule: str
    points: int
    detail: str = ""
    tier: str = ""


class LayerSignalIn(BaseModel):
    id: str
    label: str = ""
    contribution: int = 0
    detail: str = ""
    findings: list[LayerFindingIn] = Field(default_factory=list)


class ScanIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    threat_score: int = Field(alias="threatScore")
    verdict: Literal["safe", "caution", "high_risk"]
    page_url: str = Field(alias="pageUrl", min_length=1, max_length=8192)
    page_title: str = Field(default="", alias="pageTitle", max_length=512)
    last_checked: str = Field(default="", alias="lastChecked")
    layers: list[LayerSignalIn] = Field(default_factory=list)


class ScanIngestResponse(BaseModel):
    ok: bool = True
    scan_id: int
    created: bool


class ScanSummaryItem(BaseModel):
    id: int
    scanned_at: str
    page_url: str
    page_host: str
    page_title: str
    threat_score: int
    verdict: Literal["safe", "caution", "high_risk"]
    layer_scores: dict[str, int] = Field(default_factory=dict)


class ScanListResponse(BaseModel):
    items: list[ScanSummaryItem]
    total: int
    limit: int
    offset: int


class RuleHitItem(BaseModel):
    layer_id: str
    rule: str
    points: int
    tier: str = ""
    detail: str = ""


class ScanDetailResponse(ScanSummaryItem):
    rule_hits: list[RuleHitItem] = Field(default_factory=list)


@router.get("", response_model=ScanListResponse)
async def get_scans(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    verdict: Literal["safe", "caution", "high_risk"] | None = Query(default=None),
    host: str | None = Query(default=None, max_length=253),
    period: StatsPeriod | None = Query(default=None),
) -> ScanListResponse:
    if not is_pool_ready():
        raise HTTPException(status_code=503, detail="database unavailable")

    try:
        items, total = await list_scans(
            limit=limit,
            offset=offset,
            verdict=verdict,
            host=host,
            period=period,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"could not list scans: {exc}") from exc

    return ScanListResponse(
        items=[ScanSummaryItem(**item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{scan_id}", response_model=ScanDetailResponse)
async def get_scan(scan_id: int) -> ScanDetailResponse:
    if not is_pool_ready():
        raise HTTPException(status_code=503, detail="database unavailable")

    if scan_id < 1:
        raise HTTPException(status_code=400, detail="invalid scan id")

    try:
        row = await get_scan_by_id(scan_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"could not load scan: {exc}") from exc

    if row is None:
        raise HTTPException(status_code=404, detail="scan not found")

    return ScanDetailResponse(**row)


@router.post("/ingest", response_model=ScanIngestResponse)
async def ingest_scan(body: ScanIngestRequest) -> ScanIngestResponse:
    if not is_pool_ready():
        raise HTTPException(status_code=503, detail="database unavailable")

    payload = {
        "page_url": body.page_url,
        "page_title": body.page_title,
        "threat_score": body.threat_score,
        "verdict": body.verdict,
        "layers": [layer.model_dump() for layer in body.layers],
    }

    try:
        ingest_input = build_scan_ingest_input(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        scan_id, created = await persist_scan(ingest_input)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"could not persist scan: {exc}") from exc

    return ScanIngestResponse(scan_id=scan_id, created=created)
