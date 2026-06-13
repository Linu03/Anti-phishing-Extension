from __future__ import annotations

import logging

from app.core.config import get_settings
from app.layers.explain.fallback import build_fallback_explanation
from app.layers.explain.ollama_client import generate_explanation
from app.layers.explain.payload import build_prompt_user_text
from app.layers.explain.schemas import ExplainRequest, ExplainResponse

log = logging.getLogger(__name__)


async def explain_scan(request: ExplainRequest) -> ExplainResponse:
    settings = get_settings()
    user_text = build_prompt_user_text(request)

    if not settings.explain_enabled:
        log.info("explain disabled in config, using fallback text")
        return ExplainResponse(
            explanation=build_fallback_explanation(request),
            source="fallback",
            model=None,
        )

    llm_text = await generate_explanation(settings, user_text, request.audience)
    if llm_text is not None:
        return ExplainResponse(
            explanation=llm_text,
            source="ollama",
            model=settings.ollama_model,
        )

    log.info("ollama explain failed, using fallback text")
    return ExplainResponse(
        explanation=build_fallback_explanation(request),
        source="fallback",
        model=None,
    )
