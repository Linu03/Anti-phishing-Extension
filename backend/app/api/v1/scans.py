from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.db.connection import is_pool_ready
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
