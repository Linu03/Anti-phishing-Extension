import { fetchBlocklistCheck } from "../layers/blacklist/api";
import { getApiBaseUrl } from "../layers/apiBase";
import { clearBehaviorDiffForTab } from "../layers/behavioral/behaviorDiffStorage";
import { startBehaviorObserverForTab } from "../layers/behavioral/startObserverForTab";
import { isRestrictedPageUrl } from "../layers/restrictedPageUrl";
import { isUrlPersonallyBlocked, normalizeUrlForPersonalBlock, removePersonalBlock } from "../user-lists/personalBlocklist";

const MSG_GO_BACK = "AFS_GO_BACK";
const MSG_REMOVE_PERSONAL = "AFS_REMOVE_PERSONAL";

const warnedUrlByTabId = new Map<number, string>();

async function leaveBlockedPage(tabId: number): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { url: "chrome://newtab" });
  } catch {
    try {
      await chrome.tabs.update(tabId, { url: "about:blank" });
    } catch {
      // nimic
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === MSG_REMOVE_PERSONAL) {
    const tabId = sender.tab?.id;
    const url = sender.tab?.url;
    if (tabId === undefined || url === undefined) {
      sendResponse({ removed: false });
      return false;
    }
    void (async () => {
      let blocked = false;
      try {
        blocked = await isUrlPersonallyBlocked(url);
      } catch {
        sendResponse({ removed: false });
        return;
      }
      if (!blocked) {
        sendResponse({ removed: false });
        return;
      }
      try {
        await removePersonalBlock(url);
        warnedUrlByTabId.delete(tabId);
        sendResponse({ removed: true });
      } catch {
        sendResponse({ removed: false });
      }
    })();
    return true;
  }

  if (msg?.type !== MSG_GO_BACK) {
    return false;
  }
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    sendResponse({ ok: false });
    return false;
  }

  void (async () => {
    try {
      await leaveBlockedPage(tabId);
      sendResponse({ ok: true });
    } catch {
      sendResponse({ ok: false });
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  warnedUrlByTabId.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    warnedUrlByTabId.delete(tabId);
    void clearBehaviorDiffForTab(tabId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  const pageUrl = tab.url;
  if (!pageUrl) {
    return;
  }

  if (isRestrictedPageUrl(pageUrl)) {
    return;
  }

  if (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
    return;
  }

  void maybeShowWarningForTab(tabId, pageUrl);
  void startBehaviorObserverForTab(tabId, pageUrl);
});

async function maybeShowWarningForTab(tabId: number, pageUrl: string) {
  const pageKey = normalizeUrlForPersonalBlock(pageUrl);
  if (pageKey === "") {
    return;
  }

  const alreadyWarnedForUrl = warnedUrlByTabId.get(tabId);
  if (alreadyWarnedForUrl === pageKey) {
    return;
  }

  let personalListed = false;
  try {
    personalListed = await isUrlPersonallyBlocked(pageUrl);
  } catch {
    personalListed = false;
  }

  let listed = personalListed;

  if (!listed) {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const result = await fetchBlocklistCheck(apiBaseUrl, pageUrl);
      listed = result.listed === true;
    } catch {
      return;
    }
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

  const latestUrl = latest.url;
  if (!latestUrl) {
    return;
  }

  const latestKey = normalizeUrlForPersonalBlock(latestUrl);
  if (latestKey !== pageKey) {
    return;
  }

  warnedUrlByTabId.set(tabId, pageKey);

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (isPersonal: boolean) => {
        (globalThis as unknown as { __AFS_PERSONAL?: boolean }).__AFS_PERSONAL = isPersonal;
      },
      args: [personalListed],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["phishingOverlay.js"],
    });
  } catch {
    warnedUrlByTabId.delete(tabId);
  }
}
