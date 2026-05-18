import { buildBlocklistLayer } from "../blacklist/layer";
import type { BlocklistStepResult } from "../blacklist/types";
import { sumLayerContributions } from "../sumContributions";
import type { AnalysisSnapshot } from "../types";
import { verdictFromScore } from "../verdict";
import { buildWhitelistLayer } from "../whitelist/layer";
import type { WhitelistStepResult } from "../whitelist/types";

export function composePhishingAnalysis(
  pageUrl: string,
  pageTitle: string,
  blocklistStep: BlocklistStepResult,
  whitelistStep: WhitelistStepResult,
): AnalysisSnapshot {
  const blocklistLayer = buildBlocklistLayer(blocklistStep);
  const whitelistLayer = buildWhitelistLayer(whitelistStep);
  const layers = [blocklistLayer, whitelistLayer];

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
