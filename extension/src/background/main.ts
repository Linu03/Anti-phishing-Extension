import { fetchBlocklistCheck, getApiBaseUrl } from "./api";
import { shouldSkipBlocklistCheck } from "./urlAllow";

const warnedUrlByTabId = new Map<number, string>();

chrome.tabs.onRemoved.addListener((tabId) => {
  warnedUrlByTabId.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  const pageUrl = tab.url;
  if (!pageUrl) {
    return;
  }

  if (shouldSkipBlocklistCheck(pageUrl)) {
    return;
  }

  if (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
    return;
  }

  void maybeShowWarningForTab(tabId, pageUrl);
});

async function maybeShowWarningForTab(tabId: number, pageUrl: string) {
  const alreadyWarnedForUrl = warnedUrlByTabId.get(tabId);
  if (alreadyWarnedForUrl === pageUrl) {
    return;
  }

  let listed = false;
  try {
    const apiBaseUrl = getApiBaseUrl();
    const result = await fetchBlocklistCheck(apiBaseUrl, pageUrl);
    listed = result.listed === true;
  } catch {
    return;
  }

  if (!listed) {
    return;
  }

  let latest: chrome.tabs.Tab;
  try {
    latest = await chrome.tabs.get(tabId);
  } catch {
    return;
  }

  if (latest.url !== pageUrl) {
    return;
  }

  warnedUrlByTabId.set(tabId, pageUrl);

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["phishingOverlay.js"],
    });
  } catch {
    warnedUrlByTabId.delete(tabId);
  }
}
