import { runBlocklistStep } from "../blacklist/runStep";
import type { AnalysisSnapshot } from "../types";
import { runTlsStep } from "../tls/runStep";
import { runUrlAnalyzerStep } from "../url-analyzer/runStep";
import { runWhitelistStep } from "../whitelist/runStep";
import { composePhishingAnalysis } from "./composePhishingAnalysis";

export async function loadActiveTabPhishingAnalysis(): Promise<AnalysisSnapshot> {
  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabList[0];

  let url = "";
  if (currentTab && currentTab.url) {
    url = currentTab.url;
  }

  let title = "";
  if (currentTab && currentTab.title) {
    title = currentTab.title;
  }

  const whitelistStep = await runWhitelistStep(url);
  const blocklistStep = await runBlocklistStep(url);
  const urlAnalyzerStep = await runUrlAnalyzerStep(url);
  const tlsStep = await runTlsStep(url);

  let urlForUi = url.trim();
  if (urlForUi === "") {
    urlForUi = "(no url)";
  }

  return composePhishingAnalysis(
    urlForUi,
    title,
    blocklistStep,
    whitelistStep,
    urlAnalyzerStep,
    tlsStep,
  );
}
