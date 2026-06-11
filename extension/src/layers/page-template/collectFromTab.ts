import type { PageSnapshot } from "./types";

type CollectorGlobal = {
  __AFS_COLLECT_PAGE_SNAPSHOT__?: (
    brandIds: string[],
    scriptFpOrigins: string[],
  ) => PageSnapshot;
};

export async function collectPageSnapshotFromTab(
  tabId: number,
  brandIds: string[],
  scriptFpOrigins: string[],
): Promise<PageSnapshot | null> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["pageCollector.js"],
    });
  } catch {
    return null;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (ids: string[], fpOrigins: string[]) => {
        const globalRef = globalThis as CollectorGlobal;
        if (!globalRef.__AFS_COLLECT_PAGE_SNAPSHOT__) {
          return null;
        }
        return globalRef.__AFS_COLLECT_PAGE_SNAPSHOT__(ids, fpOrigins);
      },
      args: [brandIds, scriptFpOrigins],
    });

    if (!results || results.length === 0) {
      return null;
    }

    const snapshot = results[0].result;
    if (snapshot === null || snapshot === undefined || typeof snapshot !== "object") {
      return null;
    }

    return snapshot as PageSnapshot;
  } catch {
    return null;
  }
}
