export type Verdict = "safe" | "caution" | "high_risk";

export interface LayerSignal {
  id: string;
  label: string;
  contribution: number;
  detail: string;
}

export interface AnalysisSnapshot {
  threatScore: number;
  verdict: Verdict;
  pageUrl: string;
  pageTitle: string;
  lastChecked: string;
  layers: LayerSignal[];
}
