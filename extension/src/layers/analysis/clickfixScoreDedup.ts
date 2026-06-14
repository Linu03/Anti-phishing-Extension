import type { LayerSignal } from "../types";

const RULE_CLICKFIX_FULL_CHAIN = "clickfix_full_chain";
const PAGE_CLICKFIX_RULES = new Set(["fake_captcha_surface", "clickfix_lure_surface"]);

export function applyClickfixScoreDedup(
  pageLayer: LayerSignal,
  behavioralLayer: LayerSignal,
): { pageLayer: LayerSignal; behavioralLayer: LayerSignal } {
  const behavioralFindings = behavioralLayer.findings ?? [];
  const hasFullChain = behavioralFindings.some((item) => item.rule === RULE_CLICKFIX_FULL_CHAIN);
  if (!hasFullChain) {
    return { pageLayer, behavioralLayer };
  }

  const pageFindings = pageLayer.findings ?? [];
  let removedPoints = 0;
  const keptFindings = [];

  for (const finding of pageFindings) {
    if (PAGE_CLICKFIX_RULES.has(finding.rule)) {
      removedPoints = removedPoints + finding.points;
      continue;
    }
    keptFindings.push(finding);
  }

  const contribution = pageLayer.contribution - removedPoints;
  const clampedContribution = contribution < 0 ? 0 : contribution;

  return {
    pageLayer: {
      ...pageLayer,
      contribution: clampedContribution,
      findings: keptFindings,
    },
    behavioralLayer,
  };
}
