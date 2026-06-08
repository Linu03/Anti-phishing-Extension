import type { LayerSignal } from "../types";
import { PAGE_TEMPLATE_USER_MESSAGES } from "./messages";
import type { PageTemplateStepResult } from "./types";

const MAX_CONTRIBUTION = 60;
const RULE_COLLECTION_FAILED = "collection_failed";

function clampContribution(score: number): number {
  let contribution = score;
  if (contribution > MAX_CONTRIBUTION) {
    contribution = MAX_CONTRIBUTION;
  }
  if (contribution < 0) {
    contribution = 0;
  }
  return contribution;
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

  const gatePrefix = `Page gate: ${step.gate}.`;
  if (step.findings.length === 0) {
    return `${gatePrefix} No suspicious page patterns.`;
  }

  const lines: string[] = [];
  for (const finding of step.findings) {
    if (finding.rule === RULE_COLLECTION_FAILED) {
      lines.push(collectionFailedUserMessage(step.score));
      continue;
    }
    lines.push(finding.detail);
  }

  return `${gatePrefix} ${lines.join(" ")}`;
}

export function buildPageTemplateLayer(step: PageTemplateStepResult): LayerSignal {
  if (step.status === "ok") {
    return {
      id: "page-template",
      label: "Page template",
      contribution: clampContribution(step.score),
      detail: buildOkDetail(step),
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
      contribution = clampContribution(step.score);
    } else if (step.kind === "untrusted") {
      contribution = 10;
    }

    return {
      id: "page-template",
      label: "Page template",
      contribution,
      detail,
    };
  }

  return {
    id: "page-template",
    label: "Page template",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
