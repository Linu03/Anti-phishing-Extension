from __future__ import annotations

from pydantic import BaseModel, Field


class FormSnapshotModel(BaseModel):
    method: str = ""
    action: str = ""
    action_origin: str = ""
    same_origin: bool = True
    hidden_count: int = 0


class SubmitButtonSnapshotModel(BaseModel):
    formaction: str = ""
    formaction_origin: str = ""


class IframeSnapshotModel(BaseModel):
    src_origin: str = ""
    width: int = 0
    height: int = 0
    is_hidden: bool = False


class FieldProfileModel(BaseModel):
    has_password: bool = False
    has_email: bool = False
    has_tel: bool = False
    has_file: bool = False
    has_otp: bool = False
    has_payment: bool = False
    has_identity: bool = False


class PageSnapshotModel(BaseModel):
    page_url: str = Field(..., min_length=4, max_length=8192)
    page_host: str = ""
    page_origin: str = ""
    collection_ok: bool = True
    collection_error: str = ""
    has_credential_form: bool = False
    forms: list[FormSnapshotModel] = Field(default_factory=list)
    submit_buttons: list[SubmitButtonSnapshotModel] = Field(default_factory=list)
    iframes: list[IframeSnapshotModel] = Field(default_factory=list)
    meta_refresh_target: str = ""
    base_href_origin: str = ""
    canonical_host: str = ""
    external_script_origins: list[str] = Field(default_factory=list)
    brand_hits: list[str] = Field(default_factory=list)
    hidden_input_count: int = 0
    field_profile: FieldProfileModel = Field(default_factory=FieldProfileModel)


class PageDiffModel(BaseModel):
    forms_appeared: bool = False
    password_inputs_increased: bool = False
    action_origin_changed: bool = False
    brand_hits_increased: bool = False
    observed_ms: int = 0


class PriorLayersContextModel(BaseModel):
    blocklist_listed: bool = False
    blocklist_sources: list[str] = Field(default_factory=list)
    whitelist_trusted: bool = False
    url_analyzer_score: int | None = None
    url_analyzer_rules: list[str] = Field(default_factory=list)
    tls_score: int | None = None
    tls_rules: list[str] = Field(default_factory=list)


class PageTemplateAnalyzeRequest(BaseModel):
    page_url: str = Field(..., min_length=4, max_length=8192)
    snapshot: PageSnapshotModel
    diff: PageDiffModel | None = None
    context: PriorLayersContextModel = Field(default_factory=PriorLayersContextModel)


class PageFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str
    tier: str = "C"


class PageTemplateAnalyzeResponse(BaseModel):
    score: int
    gate: str
    page_safe: bool
    credential_context: bool
    findings: list[PageFindingResponse]
