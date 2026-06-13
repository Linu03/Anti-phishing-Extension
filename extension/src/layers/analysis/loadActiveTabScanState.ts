import type { AnalysisSnapshot } from "../types";
import { loadActiveTabPreview, type TabPreview } from "./loadActiveTabPreview";

function cacheMatchUrl(url: string): string {
  const trimmed = url.trim().split("#")[0].split("?")[0];
  try {
    const parsed = new URL(trimmed);
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed;
  }
}
import { getTabScanCache, isTabScanCacheStorageKey, type TabScanCacheEntry } from "./tabScanCache";

export type ActiveTabScanState = {
  tabId: number | null;
  preview: TabPreview;
  cache: TabScanCacheEntry | null;
  cacheMatchesTab: boolean;
};

export const MSG_REQUEST_TAB_RESCAN = "AFS_REQUEST_TAB_RESCAN";

export async function loadActiveTabScanState(): Promise<ActiveTabScanState> {
  const preview = await loadActiveTabPreview();
  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabList[0];
  const tabId = tab?.id ?? null;

  if (tabId === null) {
    return { tabId: null, preview, cache: null, cacheMatchesTab: false };
  }

  const cache = await getTabScanCache(tabId);
  const cacheMatchesTab =
    cache !== null && cacheMatchUrl(cache.pageUrl) === cacheMatchUrl(preview.url);

  return { tabId, preview, cache, cacheMatchesTab };
}

export function snapshotFromScanState(state: ActiveTabScanState): AnalysisSnapshot | null {
  if (!state.cacheMatchesTab || state.cache?.status !== "ready" || state.cache.snapshot === null) {
    return null;
  }
  return state.cache.snapshot;
}

export async function requestBackgroundRescan(tabId: number): Promise<void> {
  await chrome.runtime.sendMessage({ type: MSG_REQUEST_TAB_RESCAN, tabId });
}

export { isTabScanCacheStorageKey };
