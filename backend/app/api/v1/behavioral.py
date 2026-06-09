from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.layers.behavioral.schemas import (
    BehavioralAnalyzeRequest,
    BehavioralAnalyzeResponse,
)
from app.layers.behavioral.service import analyze_behavior

router = APIRouter(prefix="/behavioral")


@router.post("/analyze", response_model=BehavioralAnalyzeResponse)
async def behavioral_analyze(body: BehavioralAnalyzeRequest) -> BehavioralAnalyzeResponse:
    try:
        result = analyze_behavior(body.diff, body.context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return BehavioralAnalyzeResponse(
        score=result["score"],
        findings=result["findings"],
    )
