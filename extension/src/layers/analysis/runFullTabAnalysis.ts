import { runBlocklistStep } from "../blacklist/runStep";
import { runPageTemplateStep } from "../page-template/runStep";
import { runTlsStep } from "../tls/runStep";
import type { AnalysisSnapshot } from "../types";
import { runUrlAnalyzerStep } from "../url-analyzer/runStep";
import { runWhitelistStep } from "../whitelist/runStep";
import { composePhishingAnalysis } from "./composePhishingAnalysis";
import { buildPriorLayersContext } from "./priorLayersContext";

export async function runFullTabAnalysis(
  pageUrl: string,
  pageTitle: string,
): Promise<AnalysisSnapshot> {
  const whitelistStep = await runWhitelistStep(pageUrl);
  const blocklistStep = await runBlocklistStep(pageUrl);
  const urlAnalyzerStep = await runUrlAnalyzerStep(pageUrl);
  const tlsStep = await runTlsStep(pageUrl);

  const priorContext = buildPriorLayersContext(
    blocklistStep,
    whitelistStep,
    urlAnalyzerStep,
    tlsStep,
  );

  const pageTemplateStep = await runPageTemplateStep(pageUrl, priorContext);

  let urlForUi = pageUrl.trim();
  if (urlForUi === "") {
    urlForUi = "(no url)";
  }

  return composePhishingAnalysis(
    urlForUi,
    pageTitle,
    blocklistStep,
    whitelistStep,
    urlAnalyzerStep,
    tlsStep,
    pageTemplateStep,
  );
}
