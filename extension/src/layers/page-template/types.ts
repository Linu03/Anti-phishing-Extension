export type PageTemplateFinding = {
  rule: string;
  points: number;
  detail: string;
  tier?: string;
};

export type PageTemplateGate = "BLOCK" | "REVIEW" | "SAFE" | "INFO";

export type FormSnapshot = {
  method: string;
  action: string;
  action_origin: string;
  same_origin: boolean;
  hidden_count: number;
};

export type SubmitButtonSnapshot = {
  formaction: string;
  formaction_origin: string;
};

export type IframeSnapshot = {
  src_origin: string;
  width: number;
  height: number;
  is_hidden: boolean;
};

export type FieldProfile = {
  has_password: boolean;
  has_email: boolean;
  has_tel: boolean;
  has_file: boolean;
  has_otp: boolean;
  has_payment: boolean;
  has_identity: boolean;
};

export type PageSnapshot = {
  page_url: string;
  page_host: string;
  page_origin: string;
  collection_ok: boolean;
  collection_error: string;
  has_credential_form: boolean;
  forms: FormSnapshot[];
  submit_buttons: SubmitButtonSnapshot[];
  iframes: IframeSnapshot[];
  meta_refresh_target: string;
  base_href_origin: string;
  canonical_host: string;
  external_script_origins: string[];
  brand_hits: string[];
  hidden_input_count: number;
  field_profile: FieldProfile;
};

export type PageDiff = {
  forms_appeared: boolean;
  password_inputs_increased: boolean;
  action_origin_changed: boolean;
  brand_hits_increased: boolean;
  observed_ms: number;
};

export type PriorLayersContextPayload = {
  blocklist_listed: boolean;
  blocklist_sources: string[];
  whitelist_trusted: boolean;
  url_analyzer_score: number | null;
  url_analyzer_rules: string[];
  tls_score: number | null;
  tls_rules: string[];
};

export type PageTemplateStepResult =
  | {
      status: "ok";
      score: number;
      gate: PageTemplateGate;
      page_safe: boolean;
      findings: PageTemplateFinding[];
    }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string }
  | { status: "collection_failed"; reason: string };
