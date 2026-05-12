import type { AnalysisSnapshot, LayerSignal } from "./types";
import { verdictFromScore } from "./verdict";

const POINTS_IF_ON_BLOCKLIST = 72;

export type BlocklistStepResult =
  | { status: "listed"; sources: string[] }
  | { status: "clear" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };

function buildOpenPhishLayer(step: BlocklistStepResult): LayerSignal {
  if (step.status === "listed") {
    return {
      id: "openphish",
      label: "Blocklist",
      contribution: POINTS_IF_ON_BLOCKLIST,
      detail: "This URL matches the blocklist.",
    };
  }

  if (step.status === "clear") {
    return {
      id: "openphish",
      label: "Blocklist",
      contribution: 0,
      detail: "No blocklist match.",
    };
  }

  if (step.status === "skipped") {
    return {
      id: "openphish",
      label: "Blocklist",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "openphish",
    label: "Blocklist",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}

export function composePhishingAnalysis(pageUrl: string, pageTitle: string, blocklistStep: BlocklistStepResult): AnalysisSnapshot {
  const blocklistLayer = buildOpenPhishLayer(blocklistStep);
  const layers: LayerSignal[] = [blocklistLayer];

  let threatScore = blocklistLayer.contribution;
  if (threatScore > 100) {
    threatScore = 100;
  }

  const timeText = new Date().toLocaleString("en-GB");

  return {
    threatScore,
    verdict: verdictFromScore(threatScore),
    pageUrl,
    pageTitle,
    lastChecked: timeText,
    layers,
  };
}
