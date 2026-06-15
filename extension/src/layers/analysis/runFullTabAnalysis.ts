import { runBlocklistStep } from "../blacklist/runStep";
import { getBehaviorDiffForTab } from "../behavioral/behaviorDiffStorage";
import { runBehavioralStep } from "../behavioral/runStep";
import { startBehaviorObserverForTab } from "../behavioral/startObserverForTab";
import type { BehavioralContextPayload } from "../behavioral/types";
import { hostFromInput } from "../urlHost";
import { runPageTemplateStep } from "../page-template/runStep";
import { runTlsStep } from "../tls/runStep";
import type { AnalysisSnapshot } from "../types";
import { runUrlAnalyzerStep } from "../url-analyzer/runStep";
import { runWhitelistStep } from "../whitelist/runStep";
import { composePhishingAnalysis } from "./composePhishingAnalysis";
import { buildPriorLayersContext } from "./priorLayersContext";
import { persistScanRecord } from "./persistScanRecord";

type RunFullTabAnalysisOptions = {
  tabId?: number;
};

async function waitForDomMaturity(
  tabId: number | undefined,
  pageUrl: string,
): Promise<Awaited<ReturnType<typeof getBehaviorDiffForTab>>> {
  if (tabId === undefined) {
    return null;
  }

  return getBehaviorDiffForTab(tabId, pageUrl);
}

export async function runFullTabAnalysis(
  pageUrl: string,
  pageTitle: string,
  options?: RunFullTabAnalysisOptions,
): Promise<AnalysisSnapshot> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = options?.tabId ?? tabs[0]?.id;

  if (activeTabId !== undefined) {
    void startBehaviorObserverForTab(activeTabId, pageUrl);
  }

  const whitelistStep = await runWhitelistStep(pageUrl);
  const blocklistStep = await runBlocklistStep(pageUrl);
  const whitelistTrusted = whitelistStep.status === "trusted";

  const [urlAnalyzerStep, tlsStep, behaviorDiff] = await Promise.all([
    runUrlAnalyzerStep(pageUrl, whitelistTrusted),
    runTlsStep(pageUrl),
    waitForDomMaturity(activeTabId, pageUrl),
  ]);

  const priorContext = buildPriorLayersContext(
    blocklistStep,
    whitelistStep,
    urlAnalyzerStep,
    tlsStep,
  );

  const pageTemplateStep = await runPageTemplateStep(pageUrl, priorContext, activeTabId);

  const behavioralContext: BehavioralContextPayload = {
    page_host: hostFromInput(pageUrl),
    has_credential_form: false,
    has_sensitive_form: false,
    whitelist_trusted: priorContext.whitelist_trusted,
    blocklist_listed: priorContext.blocklist_listed,
    url_analyzer_score: priorContext.url_analyzer_score,
    tls_score: priorContext.tls_score,
    page_template_score: null,
    page_template_rules: [],
  };

  if (pageTemplateStep.status === "ok") {
    behavioralContext.has_sensitive_form = pageTemplateStep.credential_context;
    behavioralContext.has_credential_form = pageTemplateStep.credential_context;
    behavioralContext.page_template_score = pageTemplateStep.score;
    behavioralContext.page_template_rules = pageTemplateStep.findings.map((f) => f.rule);
  }

  const behavioralStep = await runBehavioralStep(pageUrl, behaviorDiff, behavioralContext);

  let urlForUi = pageUrl.trim();
  if (urlForUi === "") {
    urlForUi = "(no url)";
  }

  const analysis = composePhishingAnalysis(
    urlForUi,
    pageTitle,
    blocklistStep,
    whitelistStep,
    urlAnalyzerStep,
    tlsStep,
    pageTemplateStep,
    behavioralStep,
  );

  void persistScanRecord(analysis);

  return analysis;
}
