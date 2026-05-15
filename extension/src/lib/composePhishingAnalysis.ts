import { buildWhitelistLayer } from "../layers/whitelist/layer";
import type { WhitelistStepResult } from "../layers/whitelist/types";
import type { AnalysisSnapshot, LayerSignal } from "./types";
import { verdictFromScore } from "./verdict";

const POINTS_IF_ON_BLOCKLIST = 72;

export type BlocklistStepResult =
  | { status: "listed"; sources: string[] }
  | { status: "clear" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };

function buildBlocklistLayer(step: BlocklistStepResult): LayerSignal {
  if (step.status === "listed") {
    const src =
      step.sources.length > 0
        ? ` Sources: ${step.sources.join(", ")}.`
        : "";
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: POINTS_IF_ON_BLOCKLIST,
      detail: `This URL matches the blocklist.${src}`,
    };
  }

  if (step.status === "clear") {
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: 0,
      detail: "No blocklist match.",
    };
  }

  if (step.status === "skipped") {
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "blocklist",
    label: "Blocklist",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}

function sumLayerContributions(layers: LayerSignal[]): number {
  let total = 0;
  for (let i = 0; i < layers.length; i++) {
    total = total + layers[i].contribution;
  }
  if (total < 0) {
    total = 0;
  }
  if (total > 100) {
    total = 100;
  }
  return total;
}

export function composePhishingAnalysis(
  pageUrl: string,
  pageTitle: string,
  blocklistStep: BlocklistStepResult,
  whitelistStep: WhitelistStepResult,
): AnalysisSnapshot {
  const blocklistLayer = buildBlocklistLayer(blocklistStep);
  const whitelistLayer = buildWhitelistLayer(whitelistStep);
  const layers: LayerSignal[] = [blocklistLayer, whitelistLayer];

  const threatScore = sumLayerContributions(layers);

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
