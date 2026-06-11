import { getApiBaseUrl } from "../apiBase";
import { isRestrictedPageUrl } from "../restrictedPageUrl";
import { getCachedBrandIds } from "../page-template/brandIdsCache";

export async function startBehaviorObserverForTab(tabId: number, pageUrl: string): Promise<void> {
  if (isRestrictedPageUrl(pageUrl)) {
    return;
  }

  if (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
    return;
  }

  const brandIds = await getCachedBrandIds(getApiBaseUrl());

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["behaviorObserver.js"],
    });
  } catch {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (ids: string[], tid: number, url: string) => {
        const g = globalThis as {
          __AFS_START_BEHAVIOR_OBSERVER__?: (brandIds: string[], tabId: number, pageUrl: string) => void;
        };
        g.__AFS_START_BEHAVIOR_OBSERVER__?.(ids, tid, url);
      },
      args: [brandIds, tabId, pageUrl],
    });
  } catch {
    // ignore
  }
}
