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

export async function runFullTabAnalysis(pageUrl: string, pageTitle: string): Promise<AnalysisSnapshot> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = tabs[0]?.id;

  if (activeTabId !== undefined) {
    void startBehaviorObserverForTab(activeTabId, pageUrl);
  }

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

  const behavioralContext: BehavioralContextPayload = {
    page_host: hostFromInput(pageUrl),
    has_credential_form: false,
    whitelist_trusted: priorContext.whitelist_trusted,
    blocklist_listed: priorContext.blocklist_listed,
    url_analyzer_score: priorContext.url_analyzer_score,
    tls_score: priorContext.tls_score,
    page_template_score: null,
    page_template_rules: [],
  };

  if (pageTemplateStep.status === "ok") {
    behavioralContext.has_credential_form = pageTemplateStep.credential_context;
    behavioralContext.page_template_score = pageTemplateStep.score;
    behavioralContext.page_template_rules = pageTemplateStep.findings.map((f) => f.rule);
  }

  let behaviorDiff = null;
  if (activeTabId !== undefined) {
    behaviorDiff = await getBehaviorDiffForTab(activeTabId, pageUrl);
  }

  const behavioralStep = await runBehavioralStep(pageUrl, behaviorDiff, behavioralContext);

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
    behavioralStep,
  );
}
