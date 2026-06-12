import { fetchBlocklistCheck } from "../layers/blacklist/api";
import { getApiBaseUrl } from "../layers/apiBase";
import {
  clearBehaviorDiffForTab,
  MSG_STORE_BEHAVIOR_DIFF,
  storeBehaviorDiffForTab,
  type StoredBehaviorDiff,
} from "../layers/behavioral/behaviorDiffStorage";
import { RAPID_REDIRECT_MS } from "../layers/behavioral/constants";
import {
  clearRedirectEvidenceForTab,
  MSG_STORE_REDIRECT_EVIDENCE,
  storeRedirectEvidence,
  type RedirectEvidence,
} from "../layers/behavioral/redirectEvidence";
import { startBehaviorObserverForTab } from "../layers/behavioral/startObserverForTab";
import { isRestrictedPageUrl } from "../layers/restrictedPageUrl";
import { isUrlPersonallyBlocked, normalizeUrlForPersonalBlock, removePersonalBlock } from "../user-lists/personalBlocklist";

const MSG_GO_BACK = "AFS_GO_BACK";
const MSG_REMOVE_PERSONAL = "AFS_REMOVE_PERSONAL";

const warnedUrlByTabId = new Map<number, string>();

type TabLoadMeta = {
  url: string;
  host: string;
  loadedAt: number;
};

const tabLoadMeta = new Map<number, TabLoadMeta>();

function hostFromHttpUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isRedirectEvidence(value: unknown): value is RedirectEvidence {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as RedirectEvidence;
  return (
    typeof record.pageUrl === "string" &&
    typeof record.start_host === "string" &&
    typeof record.end_host === "string" &&
    typeof record.redirect_ms === "number" &&
    typeof record.updatedAt === "number"
  );
}

void chrome.storage.session
  .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
  .catch(() => {
    // ignore — observer uses runtime messaging as fallback
  });

function isStoredBehaviorDiff(value: unknown): value is StoredBehaviorDiff {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as StoredBehaviorDiff;
  return (
    typeof record.pageUrl === "string" &&
    (record.status === "observing" || record.status === "ready") &&
    typeof record.updatedAt === "number" &&
    record.diff !== null &&
    typeof record.diff === "object"
  );
}

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
  if (msg?.type === MSG_STORE_REDIRECT_EVIDENCE) {
    const tabId = msg.tabId;
    const evidence = msg.evidence;
    if (typeof tabId !== "number" || !isRedirectEvidence(evidence)) {
      sendResponse({ ok: false });
      return false;
    }
    void (async () => {
      await storeRedirectEvidence(tabId, evidence);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg?.type === MSG_STORE_BEHAVIOR_DIFF) {
    const tabId = msg.tabId;
    const record = msg.record;
    if (typeof tabId !== "number" || !isStoredBehaviorDiff(record)) {
      sendResponse({ ok: false });
      return false;
    }
    void (async () => {
      await storeBehaviorDiffForTab(tabId, record);
      sendResponse({ ok: true });
    })();
    return true;
  }

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
  tabLoadMeta.delete(tabId);
  void clearRedirectEvidenceForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    const pageUrl = tab.url;
    if (pageUrl && (pageUrl.startsWith("http://") || pageUrl.startsWith("https://"))) {
      const prev = tabLoadMeta.get(tabId);
      const newHost = hostFromHttpUrl(pageUrl);
      if (prev && newHost !== "" && prev.host !== newHost) {
        const elapsed = Date.now() - prev.loadedAt;
        if (elapsed > 0 && elapsed <= RAPID_REDIRECT_MS) {
          void storeRedirectEvidence(tabId, {
            pageUrl,
            start_host: prev.host,
            end_host: newHost,
            redirect_ms: elapsed,
            updatedAt: Date.now(),
          });
        }
      }
    }

    warnedUrlByTabId.delete(tabId);
    void clearBehaviorDiffForTab(tabId);
    return;
  }

  if (changeInfo.status === "complete") {
    const pageUrl = tab.url;
    if (!pageUrl || (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://"))) {
      return;
    }
    tabLoadMeta.set(tabId, {
      url: pageUrl,
      host: hostFromHttpUrl(pageUrl),
      loadedAt: Date.now(),
    });
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
