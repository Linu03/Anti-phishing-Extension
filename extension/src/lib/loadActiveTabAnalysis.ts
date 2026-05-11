import { fetchBlocklistCheck, getApiBaseUrl } from "./blocklistApi";
import { composePhishingAnalysis, type BlocklistStepResult } from "./composePhishingAnalysis";
import type { AnalysisSnapshot } from "./types";
import { isRestrictedPageUrl } from "./restrictedPageUrl";

async function runBlocklistStep(pageUrl: string): Promise<BlocklistStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return {
      status: "skipped",
      reason: "No API call (browser page or bad url).",
    };
  }

  const baseUrl = getApiBaseUrl();

  try {
    const serverData = await fetchBlocklistCheck(baseUrl, pageUrl);
    if (serverData.listed === true) {
      return { status: "listed", sources: serverData.sources };
    }
    return { status: "clear" };
  } catch (e) {
    let msg = "Unknown error";
    if (e instanceof Error) {
      msg = e.message;
    }
    return { status: "failed", errorMessage: msg };
  }
}

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

  const blocklistStep = await runBlocklistStep(url);

  let urlForUi = url.trim();
  if (urlForUi === "") {
    urlForUi = "(no url)";
  }

  return composePhishingAnalysis(urlForUi, title, blocklistStep);
}
