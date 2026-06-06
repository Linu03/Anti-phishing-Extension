import type { LayerSignal } from "../types";
import type { PageTemplateStepResult } from "./types";

const MAX_CONTRIBUTION = 60;

export function buildPageTemplateLayer(step: PageTemplateStepResult): LayerSignal {
  if (step.status === "ok") {
    let contribution = step.score;
    if (contribution > MAX_CONTRIBUTION) {
      contribution = MAX_CONTRIBUTION;
    }
    if (contribution < 0) {
      contribution = 0;
    }

    const gatePrefix = `Page gate: ${step.gate}.`;
    if (step.findings.length === 0) {
      return {
        id: "page-template",
        label: "Page template",
        contribution,
        detail: `${gatePrefix} No suspicious page patterns.`,
      };
    }

    const lines: string[] = [];
    for (const finding of step.findings) {
      lines.push(finding.detail);
    }

    return {
      id: "page-template",
      label: "Page template",
      contribution,
      detail: `${gatePrefix} ${lines.join(" ")}`,
    };
  }

  if (step.status === "skipped") {
    return {
      id: "page-template",
      label: "Page template",
      contribution: 0,
      detail: step.reason,
    };
  }

  if (step.status === "collection_failed") {
    return {
      id: "page-template",
      label: "Page template",
      contribution: 0,
      detail: `Could not read page: ${step.reason}`,
    };
  }

  return {
    id: "page-template",
    label: "Page template",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
