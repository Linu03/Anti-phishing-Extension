from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExplainAudience = Literal["plain", "technical"]


class ExplainFindingInput(BaseModel):
    rule: str = ""
    points: int = 0
    detail: str = ""


class ExplainLayerInput(BaseModel):
    id: str = ""
    label: str = ""
    contribution: int = 0
    detail: str = ""
    findings: list[ExplainFindingInput] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    threat_score: int = Field(..., ge=0, le=100)
    verdict: str = Field(..., min_length=1, max_length=32)
    page_url: str = Field(default="", max_length=8192)
    page_host: str = Field(default="", max_length=512)
    audience: ExplainAudience = "plain"
    layers: list[ExplainLayerInput] = Field(default_factory=list)


class ExplainResponse(BaseModel):
    explanation: str
    source: str
    model: str | None = None
