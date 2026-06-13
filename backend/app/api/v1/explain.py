from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.layers.explain.ollama_client import check_ollama_available
from app.layers.explain.schemas import ExplainRequest, ExplainResponse
from app.layers.explain.service import explain_scan

router = APIRouter(prefix="/explain")


@router.post("", response_model=ExplainResponse)
async def explain_scan_results(body: ExplainRequest) -> ExplainResponse:
    return await explain_scan(body)


@router.get("/health")
async def explain_health() -> dict:
    settings = get_settings()
    ollama_ok = await check_ollama_available(settings)

    return {
        "explain_enabled": settings.explain_enabled,
        "ollama_reachable": ollama_ok,
        "ollama_model": settings.ollama_model,
    }
