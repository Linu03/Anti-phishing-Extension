export type UrlAnalyzerFinding = {
  rule: string;
  points: number;
  detail: string;
};

export type UrlAnalyzerStepResult =
  | { status: "ok"; score: number; findings: UrlAnalyzerFinding[] }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };
