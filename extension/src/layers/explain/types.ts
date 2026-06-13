export type ExplainFindingInput = {
  rule: string;
  points: number;
  detail: string;
};

export type ExplainLayerInput = {
  id: string;
  label: string;
  contribution: number;
  detail: string;
  findings: ExplainFindingInput[];
};

export type ExplainAudience = "plain" | "technical";

export type ExplainRequest = {
  threat_score: number;
  verdict: string;
  page_url: string;
  page_host: string;
  audience: ExplainAudience;
  layers: ExplainLayerInput[];
};

export type ExplainResponse = {
  explanation: string;
  source: string;
  model: string | null;
};
