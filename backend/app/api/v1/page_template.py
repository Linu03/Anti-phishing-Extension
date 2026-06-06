from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.layers.page_template.schemas import (
    PageTemplateAnalyzeRequest,
    PageTemplateAnalyzeResponse,
)
from app.layers.page_template.service import analyze_page_template

router = APIRouter(prefix="/page-template")


@router.post("/analyze", response_model=PageTemplateAnalyzeResponse)
async def page_template_analyze(body: PageTemplateAnalyzeRequest) -> PageTemplateAnalyzeResponse:
    try:
        result = analyze_page_template(body.snapshot, body.diff, body.context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return PageTemplateAnalyzeResponse(
        score=result["score"],
        gate=result["gate"],
        page_safe=result["page_safe"],
        credential_context=result["credential_context"],
        findings=result["findings"],
    )
