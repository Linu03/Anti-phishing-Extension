export type UrlAnalyzerFinding = {
  rule: string;
  points: number;
  detail: string;
};

export type UrlRiskLevel = "low" | "medium" | "high";

export type UrlAnalyzerStepResult =
  | {
      status: "ok";
      score: number;
      risk: UrlRiskLevel;
      riskLabel: string;
      findings: UrlAnalyzerFinding[];
    }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };
