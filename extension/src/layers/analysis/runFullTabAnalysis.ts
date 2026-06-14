import { runBlocklistStep } from "../blacklist/runStep";
import { getBehaviorDiffForTab } from "../behavioral/behaviorDiffStorage";
import { readRedirectEvidence } from "../behavioral/redirectEvidence";
import { runBehavioralStep } from "../behavioral/runStep";
import { startBehaviorObserverForTab } from "../behavioral/startObserverForTab";
import type { BehavioralContextPayload } from "../behavioral/types";
import { getApiBaseUrl } from "../apiBase";
import { hostFromInput } from "../urlHost";
import { getCachedBrandIds } from "../page-template/brandIdsCache";
import { collectPageSnapshotFromTab } from "../page-template/collectFromTab";
import { getCachedScriptFpOrigins } from "../page-template/scriptFpOriginsCache";
import type { PageSnapshot } from "../page-template/types";
import { runPageTemplateStep } from "../page-template/runStep";
import { runTlsStep } from "../tls/runStep";
import type { AnalysisSnapshot } from "../types";
import { runUrlAnalyzerStep } from "../url-analyzer/runStep";
import { runWhitelistStep } from "../whitelist/runStep";
import {
  buildScanDebugBundle,
  DEBUG_SCAN_REPORT_ENABLED,
  persistScanDebugReport,
} from "../../debug/scanDebugIngest";
import { composePhishingAnalysis } from "./composePhishingAnalysis";
import { buildPriorLayersContext } from "./priorLayersContext";
import { persistScanRecord } from "./persistScanRecord";

export type RunFullTabAnalysisOptions = {
  tabId?: number;
};

async function waitForDomMaturity(
  tabId: number | undefined,
  pageUrl: string,
): Promise<{ behaviorDiff: Awaited<ReturnType<typeof getBehaviorDiffForTab>>; redirectEvidence: Awaited<ReturnType<typeof readRedirectEvidence>> }> {
  if (tabId === undefined) {
    return { behaviorDiff: null, redirectEvidence: null };
  }

  const [behaviorDiff, redirectEvidence] = await Promise.all([
    getBehaviorDiffForTab(tabId, pageUrl),
    readRedirectEvidence(tabId),
  ]);

  return { behaviorDiff, redirectEvidence };
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

  const [urlAnalyzerStep, tlsStep, domMaturity] = await Promise.all([
    runUrlAnalyzerStep(pageUrl, whitelistTrusted),
    runTlsStep(pageUrl),
    waitForDomMaturity(activeTabId, pageUrl),
  ]);

  const { behaviorDiff, redirectEvidence } = domMaturity;

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

  if (DEBUG_SCAN_REPORT_ENABLED) {
    let pageSnapshot: PageSnapshot | null = null;
    let snapshotInjectFailed = false;
    if (activeTabId !== undefined) {
      try {
        const baseUrl = getApiBaseUrl();
        const brandIds = await getCachedBrandIds(baseUrl);
        const scriptFpOrigins = await getCachedScriptFpOrigins(baseUrl);
        pageSnapshot = await collectPageSnapshotFromTab(activeTabId, brandIds, scriptFpOrigins);
        snapshotInjectFailed = pageSnapshot === null;
      } catch {
        pageSnapshot = null;
        snapshotInjectFailed = true;
      }
    }

    const bundle = buildScanDebugBundle({
      scanned_at: new Date().toISOString(),
      page_url: urlForUi,
      page_title: pageTitle,
      tab_id: activeTabId ?? null,
      page_snapshot: pageSnapshot,
      snapshot_inject_failed: snapshotInjectFailed,
      prior_context: priorContext,
      behavioral_context: behavioralContext,
      behavior_diff: behaviorDiff,
      redirect_evidence: redirectEvidence,
      steps: {
        blocklist: blocklistStep,
        whitelist: whitelistStep,
        url_analyzer: urlAnalyzerStep,
        tls: tlsStep,
        page_template: pageTemplateStep,
        behavioral: behavioralStep,
      },
      composed: analysis,
    });
    void persistScanDebugReport(bundle);
  }

  void persistScanRecord(analysis);

  return analysis;
}
