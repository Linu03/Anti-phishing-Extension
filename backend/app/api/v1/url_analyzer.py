from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.layers.url_analyzer.service import analyze_url

router = APIRouter(prefix="/url-analyzer")


class UrlAnalyzerRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=8192)


class UrlFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str


class UrlAnalyzerResponse(BaseModel):
    score: int
    risk: str
    risk_label: str
    host: str
    url_normalized: str
    findings: list[UrlFindingResponse]


@router.post("/analyze", response_model=UrlAnalyzerResponse)
async def url_analyzer_analyze(body: UrlAnalyzerRequest) -> UrlAnalyzerResponse:
    try:
        result = analyze_url(body.url)
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
