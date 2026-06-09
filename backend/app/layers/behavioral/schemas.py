from __future__ import annotations

from pydantic import BaseModel, Field


class BehaviorDiffModel(BaseModel):
    forms_appeared: bool = False
    password_inputs_increased: bool = False
    action_origin_changed: bool = False
    brand_hits_increased: bool = False
    observed_ms: int = 0


class BehavioralContextModel(BaseModel):
    page_host: str = ""
    has_credential_form: bool = False
    whitelist_trusted: bool = False
    blocklist_listed: bool = False
    url_analyzer_score: int | None = None
    tls_score: int | None = None
    page_template_score: int | None = None
    page_template_rules: list[str] = Field(default_factory=list)


class BehavioralAnalyzeRequest(BaseModel):
    page_url: str = Field(..., min_length=4, max_length=8192)
    diff: BehaviorDiffModel
    context: BehavioralContextModel = Field(default_factory=BehavioralContextModel)


class BehavioralFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str
    tier: str = "C"


class BehavioralAnalyzeResponse(BaseModel):
    score: int
    gate: str
    findings: list[BehavioralFindingResponse]
