import type { LayerSignal } from "../types";
import { BEHAVIORAL_USER_MESSAGES } from "./messages";
import type { BehavioralStepResult } from "./types";

function normalizeContribution(score: number): number {
  if (score < 0) {
    return 0;
  }
  return score;
}

export function buildBehavioralLayer(step: BehavioralStepResult): LayerSignal {
  if (step.status === "ok") {
    let detail: string = BEHAVIORAL_USER_MESSAGES.noBehavioralIssues;
    if (step.findings.length > 0) {
      const lines: string[] = [];
      for (const finding of step.findings) {
        lines.push(finding.detail);
      }
      detail = lines.join(" ");
    }

    return {
      id: "behavioral",
      label: "Behavioral check",
      contribution: normalizeContribution(step.score),
      detail,
      findings: step.findings,
    };
  }

  if (step.status === "skipped") {
    const detail =
      step.reason === "restricted"
        ? BEHAVIORAL_USER_MESSAGES.restricted
        : BEHAVIORAL_USER_MESSAGES.noDiffAvailable;

    return {
      id: "behavioral",
      label: "Behavioral check",
      contribution: 0,
      detail,
    };
  }

  return {
    id: "behavioral",
    label: "Behavioral check",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
