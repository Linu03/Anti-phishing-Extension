from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.layers.page_template.impersonation_registry import get_brand_ids_catalog
from app.layers.page_template.schemas import (
    BrandIdsResponse,
    PageTemplateAnalyzeRequest,
    PageTemplateAnalyzeResponse,
)
from app.layers.page_template.service import analyze_page_template

router = APIRouter(prefix="/page-template")


@router.get("/brand-ids", response_model=BrandIdsResponse)
async def page_template_brand_ids() -> BrandIdsResponse:
    brand_ids, version = get_brand_ids_catalog()
    return BrandIdsResponse(brand_ids=brand_ids, version=version)


@router.post("/analyze", response_model=PageTemplateAnalyzeResponse)
async def page_template_analyze(body: PageTemplateAnalyzeRequest) -> PageTemplateAnalyzeResponse:
    try:
        result = analyze_page_template(body.snapshot, body.context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return PageTemplateAnalyzeResponse(
        score=result["score"],
        gate=result["gate"],
        page_safe=result["page_safe"],
        credential_context=result["credential_context"],
        findings=result["findings"],
    )
