export type BehaviorDiff = {
  forms_appeared: boolean;
  password_inputs_increased: boolean;
  action_origin_changed: boolean;
  brand_hits_increased: boolean;
  observed_ms: number;
  redirect_ms: number;
  start_host: string;
  end_host: string;
};

export type BehavioralContextPayload = {
  page_host: string;
  has_credential_form: boolean;
  has_sensitive_form: boolean;
  whitelist_trusted: boolean;
  blocklist_listed: boolean;
  url_analyzer_score: number | null;
  tls_score: number | null;
  page_template_score: number | null;
  page_template_rules: string[];
};

export type BehavioralFinding = {
  rule: string;
  points: number;
  detail: string;
  tier?: string;
};

export type BehavioralStepResult =
  | {
      status: "ok";
      score: number;
      findings: BehavioralFinding[];
    }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };
