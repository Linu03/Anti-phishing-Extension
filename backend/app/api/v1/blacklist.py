from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.blacklist.service import check_blacklist

router = APIRouter(prefix="/blacklist")


class BlacklistCheckRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=8192)


class BlacklistCheckResponse(BaseModel):
    listed: bool
    sources: list[str]
    url_normalized: str
    host: str


@router.post("/check", response_model=BlacklistCheckResponse)
async def blacklist_check(
    body: BlacklistCheckRequest,
    request: Request,
) -> BlacklistCheckResponse:
    client = request.app.state.http_client
    try:
        result = await check_blacklist(client, body.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return BlacklistCheckResponse(
        listed=result.listed,
        sources=result.sources,
        url_normalized=result.url_normalized,
        host=result.host,
    )
