import type { AnalysisSnapshot, LayerSignal } from "./types";
import { verdictFromScore } from "./verdict";

const POINTS_IF_ON_BLOCKLIST = 72;

const placeholderLayers: LayerSignal[] = [
  {
    id: "url",
    label: "URL heuristics (demo)",
    contribution: 18,
    detail: "Fake demo text for school project.",
  },
  {
    id: "tls",
    label: "TLS (demo)",
    contribution: 6,
    detail: "Fake demo text.",
  },
  {
    id: "dom",
    label: "Page template (demo)",
    contribution: 5,
    detail: "Fake demo text.",
  },
];

export type BlocklistStepResult =
  | { status: "listed"; sources: string[] }
  | { status: "clear" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };

function buildOpenPhishLayer(step: BlocklistStepResult): LayerSignal {
  if (step.status === "listed") {
    const joined = step.sources.join(", ");
    return {
      id: "openphish",
      label: "OpenPhish list",
      contribution: POINTS_IF_ON_BLOCKLIST,
      detail: `Listed. Sources: ${joined}.`,
    };
  }

  if (step.status === "clear") {
    return {
      id: "openphish",
      label: "OpenPhish list",
      contribution: 0,
      detail: "Not on list.",
    };
  }

  if (step.status === "skipped") {
    return {
      id: "openphish",
      label: "OpenPhish list",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "openphish",
    label: "OpenPhish list",
    contribution: 0,
    detail: `API error: ${step.errorMessage}`,
  };
}

export function composePhishingAnalysis(pageUrl: string, pageTitle: string, blocklistStep: BlocklistStepResult): AnalysisSnapshot {
  const openPhishLayer = buildOpenPhishLayer(blocklistStep);

  const allLayers: LayerSignal[] = [openPhishLayer];
  for (let i = 0; i < placeholderLayers.length; i++) {
    allLayers.push(placeholderLayers[i]);
  }

  let totalScore = 0;
  for (let i = 0; i < allLayers.length; i++) {
    totalScore = totalScore + allLayers[i].contribution;
  }
  if (totalScore > 100) {
    totalScore = 100;
  }

  const timeText = new Date().toLocaleString("en-GB");

  return {
    threatScore: totalScore,
    verdict: verdictFromScore(totalScore),
    pageUrl,
    pageTitle,
    lastChecked: timeText,
    layers: allLayers,
  };
}
