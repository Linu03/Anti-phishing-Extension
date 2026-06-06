import type { BlocklistStepResult } from "../blacklist/types";
import type { PriorLayersContextPayload } from "../page-template/types";
import type { TlsStepResult } from "../tls/types";
import type { UrlAnalyzerStepResult } from "../url-analyzer/types";
import type { WhitelistStepResult } from "../whitelist/types";

export function buildPriorLayersContext(
  blocklistStep: BlocklistStepResult,
  whitelistStep: WhitelistStepResult,
  urlAnalyzerStep: UrlAnalyzerStepResult,
  tlsStep: TlsStepResult,
): PriorLayersContextPayload {
  let blocklistListed = false;
  const blocklistSources: string[] = [];
  if (blocklistStep.status === "listed") {
    blocklistListed = true;
    for (let i = 0; i < blocklistStep.sources.length; i++) {
      blocklistSources.push(blocklistStep.sources[i]);
    }
  }

  let whitelistTrusted = false;
  if (whitelistStep.status === "trusted") {
    whitelistTrusted = true;
  }

  let urlAnalyzerScore: number | null = null;
  const urlAnalyzerRules: string[] = [];
  if (urlAnalyzerStep.status === "ok") {
    urlAnalyzerScore = urlAnalyzerStep.score;
    for (let i = 0; i < urlAnalyzerStep.findings.length; i++) {
      urlAnalyzerRules.push(urlAnalyzerStep.findings[i].rule);
    }
  }

  let tlsScore: number | null = null;
  const tlsRules: string[] = [];
  if (tlsStep.status === "ok") {
    tlsScore = tlsStep.score;
    for (let i = 0; i < tlsStep.findings.length; i++) {
      tlsRules.push(tlsStep.findings[i].rule);
    }
  }

  return {
    blocklist_listed: blocklistListed,
    blocklist_sources: blocklistSources,
    whitelist_trusted: whitelistTrusted,
    url_analyzer_score: urlAnalyzerScore,
    url_analyzer_rules: urlAnalyzerRules,
    tls_score: tlsScore,
    tls_rules: tlsRules,
  };
}
