import type { AnalysisSnapshot } from "../types";

export type TabScanStatus = "scanning" | "ready" | "error";

export type TabScanCacheEntry = {
  pageUrl: string;
  status: TabScanStatus;
  snapshot: AnalysisSnapshot | null;
  updatedAt: number;
};

const CACHE_PREFIX = "afsTabScan_";

export function isTabScanCacheStorageKey(key: string): boolean {
  return key.startsWith(CACHE_PREFIX);
}

export function tabScanCacheKey(tabId: number): string {
  return `${CACHE_PREFIX}${tabId}`;
}

export async function getTabScanCache(tabId: number): Promise<TabScanCacheEntry | null> {
  const key = tabScanCacheKey(tabId);
  const data = await chrome.storage.session.get(key);
  const raw = data[key];
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return null;
  }
  const entry = raw as TabScanCacheEntry;
  if (typeof entry.pageUrl !== "string" || typeof entry.status !== "string" || typeof entry.updatedAt !== "number") {
    return null;
  }
  return entry;
}

export async function setTabScanCache(tabId: number, entry: TabScanCacheEntry): Promise<void> {
  const key = tabScanCacheKey(tabId);
  const bag: Record<string, TabScanCacheEntry> = {};
  bag[key] = entry;
  await chrome.storage.session.set(bag);
}

export async function clearTabScanCache(tabId: number): Promise<void> {
  const key = tabScanCacheKey(tabId);
  await chrome.storage.session.remove(key);
}

export async function markTabScanning(tabId: number, pageUrl: string): Promise<void> {
  await setTabScanCache(tabId, {
    pageUrl,
    status: "scanning",
    snapshot: null,
    updatedAt: Date.now(),
  });
}

export async function saveTabScanResult(tabId: number, pageUrl: string, snapshot: AnalysisSnapshot): Promise<void> {
  await setTabScanCache(tabId, {
    pageUrl,
    status: "ready",
    snapshot,
    updatedAt: Date.now(),
  });
}

export async function markTabScanError(tabId: number, pageUrl: string): Promise<void> {
  await setTabScanCache(tabId, {
    pageUrl,
    status: "error",
    snapshot: null,
    updatedAt: Date.now(),
  });
}
