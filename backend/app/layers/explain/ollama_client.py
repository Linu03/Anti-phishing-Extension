from __future__ import annotations

import logging

import httpx

from app.core.config import Settings
from app.layers.explain.prompt import build_messages
from app.layers.explain.schemas import ExplainAudience

log = logging.getLogger(__name__)


async def generate_explanation(
    settings: Settings,
    user_text: str,
    audience: ExplainAudience = "plain",
) -> str | None:
    url = f"{settings.ollama_base_url}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": build_messages(audience, user_text),
        "stream": False,
    }

    timeout = httpx.Timeout(settings.explain_timeout_sec, connect=5.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        log.warning("ollama request failed: %s", exc)
        return None

    if response.status_code != 200:
        log.warning("ollama returned HTTP %s", response.status_code)
        return None

    try:
        data = response.json()
    except ValueError:
        log.warning("ollama response was not valid JSON")
        return None

    message = data.get("message")
    if not isinstance(message, dict):
        return None

    content = message.get("content")
    if not isinstance(content, str):
        return None

    text = content.strip()
    if text == "":
        return None

    return text


async def check_ollama_available(settings: Settings) -> bool:
    url = f"{settings.ollama_base_url}/api/tags"
    timeout = httpx.Timeout(3.0, connect=2.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
    except httpx.HTTPError:
        return False

    return response.status_code == 200
