from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.layers.tls_certificate.service import analyze_tls

router = APIRouter(prefix="/tls")


class TlsInspectRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=8192)


class TlsFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str


class TlsInspectResponse(BaseModel):
    score: int
    host: str
    scheme: str
    issuer: str | None
    not_before: str | None
    not_after: str | None
    findings: list[TlsFindingResponse]


@router.post("/inspect", response_model=TlsInspectResponse)
async def tls_inspect(body: TlsInspectRequest) -> TlsInspectResponse:
    try:
        result = await analyze_tls(body.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return TlsInspectResponse(
        score=result["score"],
        host=result["host"],
        scheme=result["scheme"],
        issuer=result["issuer"],
        not_before=result["not_before"],
        not_after=result["not_after"],
        findings=result["findings"],
    )
