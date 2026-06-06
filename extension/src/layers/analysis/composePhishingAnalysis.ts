import { buildBlocklistLayer } from "../blacklist/layer";
import type { BlocklistStepResult } from "../blacklist/types";
import { sumLayerContributions } from "../sumContributions";
import type { AnalysisSnapshot } from "../types";
import { buildTlsLayer } from "../tls/layer";
import type { TlsStepResult } from "../tls/types";
import { buildUrlAnalyzerLayer } from "../url-analyzer/layer";
import type { UrlAnalyzerStepResult } from "../url-analyzer/types";
import { verdictFromScore } from "../verdict";
import { buildPageTemplateLayer } from "../page-template/layer";
import type { PageTemplateStepResult } from "../page-template/types";
import { buildWhitelistLayer } from "../whitelist/layer";
import type { WhitelistStepResult } from "../whitelist/types";

export function composePhishingAnalysis(
  pageUrl: string,
  pageTitle: string,
  blocklistStep: BlocklistStepResult,
  whitelistStep: WhitelistStepResult,
  urlAnalyzerStep: UrlAnalyzerStepResult,
  tlsStep: TlsStepResult,
  pageTemplateStep: PageTemplateStepResult,
): AnalysisSnapshot {
  const blocklistLayer = buildBlocklistLayer(blocklistStep);
  const whitelistLayer = buildWhitelistLayer(whitelistStep);
  const urlAnalyzerLayer = buildUrlAnalyzerLayer(urlAnalyzerStep);
  const tlsLayer = buildTlsLayer(tlsStep);
  const pageTemplateLayer = buildPageTemplateLayer(pageTemplateStep);
  const layers = [
    blocklistLayer,
    whitelistLayer,
    urlAnalyzerLayer,
    tlsLayer,
    pageTemplateLayer,
  ];

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
