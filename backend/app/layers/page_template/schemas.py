from __future__ import annotations

from pydantic import BaseModel, Field


class FormSnapshotModel(BaseModel):
    method: str = ""
    action: str = ""
    action_origin: str = ""
    same_origin: bool = True
    hidden_count: int = 0
    has_password: bool = False
    visible_field_count: int = 0


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
    has_hidden_password: bool = False
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
    meta_refresh_delay_sec: int | None = None
    base_href_origin: str = ""
    canonical_host: str = ""
    external_script_origins: list[str] = Field(default_factory=list)
    total_resource_count: int = 0
    external_resource_count: int = 0
    external_resource_ratio: float = 0.0
    brand_hits: list[str] = Field(default_factory=list)
    primary_brand_hits: list[str] = Field(
        default_factory=list,
        description="Brands matched on title/H1 only (collector sets this).",
    )
    hidden_input_count: int = 0
    is_framed: bool = False
    field_profile: FieldProfileModel = Field(default_factory=FieldProfileModel)


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
    context: PriorLayersContextModel = Field(default_factory=PriorLayersContextModel)


class PageFindingResponse(BaseModel):
    rule: str
    points: int
    detail: str
    tier: str = "C"


class PageTemplateAnalyzeResponse(BaseModel):
    score: int
    credential_context: bool
    findings: list[PageFindingResponse]


class BrandIdsResponse(BaseModel):
    brand_ids: list[str] = Field(
        default_factory=list,
        description="Brand identifiers for client-side page scanning only.",
    )
    version: str = Field(
        ...,
        description="Registry version (source file mtime UTC).",
    )


class ScriptFpOriginsResponse(BaseModel):
    script_fp_origins: list[str] = Field(
        default_factory=list,
        description="Hosts excluded from external resource ratio in the page collector.",
    )
    version: str = Field(
        ...,
        description="Catalog version (constants file mtime UTC).",
    )
