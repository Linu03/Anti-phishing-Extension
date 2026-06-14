export type PageTemplateFinding = {
  rule: string;
  points: number;
  detail: string;
  tier?: string;
};

export type FormSnapshot = {
  method: string;
  action: string;
  action_origin: string;
  same_origin: boolean;
  hidden_count: number;
  has_password: boolean;
  visible_field_count: number;
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
  has_hidden_password: boolean;
  has_email: boolean;
  has_tel: boolean;
  has_file: boolean;
  has_otp: boolean;
  has_payment: boolean;
  has_identity: boolean;
};

export type ProminentImage = {
  url: string;
  b64: string;
  mime: string;
  width: number;
  height: number;
};

export type FaviconImage = {
  url: string;
  b64: string;
  mime: string;
  width: number;
  height: number;
};

export type CaptchaSurfaceHints = {
  has_standalone_checkbox: boolean;
  has_captcha_like_text: boolean;
  mentions_cloudflare_or_recaptcha: boolean;
  has_clickfix_instruction_text: boolean;
  has_real_captcha_widget: boolean;
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
  meta_refresh_delay_sec: number | null;
  base_href_origin: string;
  canonical_host: string;
  external_script_origins: string[];
  total_resource_count: number;
  external_resource_count: number;
  external_resource_ratio: number;
  brand_hits: string[];
  primary_brand_hits: string[];
  hidden_input_count: number;
  is_framed: boolean;
  field_profile: FieldProfile;
  prominent_image: ProminentImage | null;
  favicon: FaviconImage | null;
  captcha_surface: CaptchaSurfaceHints;
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

export type PageTemplateSkipKind = "restricted" | "not_active";

export type PageTemplateCollectionFailedKind = "untrusted" | "trusted";

export type PageTemplateStepResult =
  | {
      status: "ok";
      score: number;
      credential_context: boolean;
      findings: PageTemplateFinding[];
    }
  | { status: "skipped"; kind: PageTemplateSkipKind }
  | { status: "failed"; errorMessage: string }
  | {
      status: "collection_failed";
      kind: PageTemplateCollectionFailedKind;
      score?: number;
    };
