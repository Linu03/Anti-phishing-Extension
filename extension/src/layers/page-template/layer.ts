import type { LayerSignal } from "../types";
import { PAGE_TEMPLATE_USER_MESSAGES } from "./messages";
import type { PageTemplateStepResult } from "./types";

const RULE_COLLECTION_FAILED = "collection_failed";

function normalizeContribution(score: number): number {
  if (score < 0) {
    return 0;
  }
  return score;
}

function collectionFailedUserMessage(score: number): string {
  if (score > 0) {
    return PAGE_TEMPLATE_USER_MESSAGES.collectionFailed;
  }
  return PAGE_TEMPLATE_USER_MESSAGES.collectionFailedTrusted;
}

function buildOkDetail(step: Extract<PageTemplateStepResult, { status: "ok" }>): string {
  const onlyCollectionFailed =
    step.findings.length > 0 &&
    step.findings.every((item) => item.rule === RULE_COLLECTION_FAILED);

  if (onlyCollectionFailed) {
    return collectionFailedUserMessage(step.score);
  }

  if (step.findings.length === 0) {
    return "No suspicious page patterns.";
  }

  const lines: string[] = [];
  const sortedFindings = [...step.findings].sort((a, b) => b.points - a.points);
  for (const finding of sortedFindings) {
    if (finding.rule === RULE_COLLECTION_FAILED) {
      lines.push(collectionFailedUserMessage(step.score));
      continue;
    }
    lines.push(finding.detail);
  }

  return lines.join(" ");
}

export function buildPageTemplateLayer(step: PageTemplateStepResult): LayerSignal {
  if (step.status === "ok") {
    return {
      id: "page-template",
      label: "Page template",
      contribution: normalizeContribution(step.score),
      detail: buildOkDetail(step),
      findings: step.findings,
    };
  }

  if (step.status === "skipped") {
    const detail =
      step.kind === "restricted"
        ? PAGE_TEMPLATE_USER_MESSAGES.restricted
        : PAGE_TEMPLATE_USER_MESSAGES.notActive;

    return {
      id: "page-template",
      label: "Page template",
      contribution: 0,
      detail,
    };
  }

  if (step.status === "collection_failed") {
    const detail =
      step.kind === "trusted"
        ? PAGE_TEMPLATE_USER_MESSAGES.collectionFailedTrusted
        : PAGE_TEMPLATE_USER_MESSAGES.collectionFailed;

    let contribution = 0;
    if (typeof step.score === "number") {
      contribution = normalizeContribution(step.score);
    } else if (step.kind === "untrusted") {
      contribution = 10;
    }

    return {
      id: "page-template",
      label: "Page template",
      contribution,
      detail,
      findings:
        contribution > 0
          ? [{ rule: RULE_COLLECTION_FAILED, points: contribution, detail }]
          : [],
    };
  }

  return {
    id: "page-template",
    label: "Page template",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
