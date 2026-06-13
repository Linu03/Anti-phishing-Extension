from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.layers.url_analyzer.service import analyze_url_with_rdap

router = APIRouter(prefix="/url-analyzer")


class UrlAnalyzerRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=8192)
    whitelist_trusted: bool = False


class UrlFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str
    tier: str = ""


class UrlAnalyzerResponse(BaseModel):
    score: int
    risk: str
    risk_label: str
    host: str
    url_normalized: str
    findings: list[UrlFindingResponse]


@router.post("/analyze", response_model=UrlAnalyzerResponse)
async def url_analyzer_analyze(
    body: UrlAnalyzerRequest,
    request: Request,
) -> UrlAnalyzerResponse:
    try:
        result = await analyze_url_with_rdap(
            body.url,
            request.app.state.http_client,
            whitelist_trusted=body.whitelist_trusted,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return UrlAnalyzerResponse(
        score=result["score"],
        risk=result["risk"],
        risk_label=result["risk_label"],
        host=result["host"],
        url_normalized=result["url_normalized"],
        findings=result["findings"],
    )
