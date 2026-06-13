export type Verdict = "safe" | "caution" | "high_risk";

export type LayerFinding = {
  rule: string;
  points: number;
  detail: string;
};

export interface LayerSignal {
  id: string;
  label: string;
  contribution: number;
  detail: string;
  findings?: LayerFinding[];
}

export interface AnalysisSnapshot {
  threatScore: number;
  verdict: Verdict;
  pageUrl: string;
  pageTitle: string;
  lastChecked: string;
  layers: LayerSignal[];
}
