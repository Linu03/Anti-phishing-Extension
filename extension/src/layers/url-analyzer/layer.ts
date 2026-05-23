import type { LayerSignal } from "../types";
import type { UrlAnalyzerStepResult } from "./types";

export function buildUrlAnalyzerLayer(step: UrlAnalyzerStepResult): LayerSignal {
  if (step.status === "ok") {
    const riskPrefix = `URL phishing risk: ${step.riskLabel} (score ${step.score}/50).`;

    if (step.findings.length === 0) {
      return {
        id: "url-analyzer",
        label: "URL analyzer",
        contribution: step.score,
        detail: `${riskPrefix} No suspicious URL patterns.`,
      };
    }

    const lines: string[] = [];
    for (const f of step.findings) {
      lines.push(f.detail);
    }
    const detailText = `${riskPrefix} ${lines.join(" ")}`;

    return {
      id: "url-analyzer",
      label: "URL analyzer",
      contribution: step.score,
      detail: detailText,
    };
  }

  if (step.status === "skipped") {
    return {
      id: "url-analyzer",
      label: "URL analyzer",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "url-analyzer",
    label: "URL analyzer",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
