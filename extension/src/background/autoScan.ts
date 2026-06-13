import { runFullTabAnalysis } from "../layers/analysis/runFullTabAnalysis";
import { getTabScanCache } from "../layers/analysis/tabScanCache";
import {
  clearTabScanCache,
  markTabScanError,
  markTabScanning,
  saveTabScanResult,
} from "../layers/analysis/tabScanCache";
import { startBehaviorObserverForTab } from "../layers/behavioral/startObserverForTab";
import { isRestrictedPageUrl } from "../layers/restrictedPageUrl";
import type { Verdict } from "../layers/types";
import { verdictFromScore } from "../layers/verdict";
import { getUserSettings } from "../settings/storage";
import { isUrlWhitelisted } from "../layers/whitelist/storage";
import { clearTabScanBadge, showScanResultAlert } from "./scanResultAlert";

export const MSG_REQUEST_TAB_RESCAN = "AFS_REQUEST_TAB_RESCAN";

const BACKGROUND_SCAN_TIMEOUT_MS = 25000;

const lastNotifiedKeyByTab = new Map<number, string>();
const scanGenerationByTab = new Map<number, number>();

function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function pathLevelKey(url: string): string {
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

function bumpScanGeneration(tabId: number): number {
  const next = (scanGenerationByTab.get(tabId) ?? 0) + 1;
  scanGenerationByTab.set(tabId, next);
  return next;
}

function isCurrentScanGeneration(tabId: number, generation: number): boolean {
  return scanGenerationByTab.get(tabId) === generation;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("background_scan_timeout"));
      }, ms);
    }),
  ]);
}

async function isAutoScanEnabled(): Promise<boolean> {
  const settings = await getUserSettings();
  return settings.scanMode === "auto_when_ready";
}

async function getTabUrl(tabId: number): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url ?? null;
  } catch {
    return null;
  }
}

async function tabUrlStillMatches(tabId: number, expectedUrl: string): Promise<boolean> {
  const currentUrl = await getTabUrl(tabId);
  if (currentUrl === null) {
    return false;
  }
  return pathLevelKey(currentUrl) === pathLevelKey(expectedUrl);
}

async function maybeAlertScanResult(tabId: number, pageUrl: string, verdict: Verdict): Promise<void> {
  const notifyKey = `${pageUrl}|${verdict}`;
  if (lastNotifiedKeyByTab.get(tabId) === notifyKey) {
    return;
  }
  lastNotifiedKeyByTab.set(tabId, notifyKey);

  if (verdict === "safe") {
    await clearTabScanBadge(tabId);
    return;
  }

  await showScanResultAlert(tabId, verdict);
}

async function clearScanningStateIfNeeded(
  tabId: number,
  pageUrl: string,
  generation: number,
  saved: boolean,
): Promise<void> {
  if (saved || !isCurrentScanGeneration(tabId, generation)) {
    return;
  }

  const cache = await getTabScanCache(tabId);
  if (cache === null || cache.status !== "scanning") {
    return;
  }

  if (pathLevelKey(cache.pageUrl) !== pathLevelKey(pageUrl)) {
    return;
  }

  await markTabScanError(tabId, pageUrl);
}

async function runBackgroundScan(
  tabId: number,
  pageUrl: string,
  pageTitle: string,
  generation: number,
): Promise<void> {
  let saved = false;

  try {
    if (!(await isAutoScanEnabled())) {
      return;
    }

    if (!isCurrentScanGeneration(tabId, generation)) {
      return;
    }

    if (!(await tabUrlStillMatches(tabId, pageUrl))) {
      return;
    }

    const snapshot = await withTimeout(
      runFullTabAnalysis(pageUrl, pageTitle, { tabId }),
      BACKGROUND_SCAN_TIMEOUT_MS,
    );

    if (!isCurrentScanGeneration(tabId, generation)) {
      return;
    }

    const currentUrl = (await getTabUrl(tabId)) ?? pageUrl;
    if (pathLevelKey(currentUrl) !== pathLevelKey(pageUrl)) {
      return;
    }

    await saveTabScanResult(tabId, currentUrl, snapshot);
    saved = true;
    await maybeAlertScanResult(tabId, currentUrl, verdictFromScore(snapshot.threatScore));
  } catch {
    // markTabScanError handled in finally when not saved
  } finally {
    await clearScanningStateIfNeeded(tabId, pageUrl, generation, saved);
  }
}

export function clearAutoScanStateForTab(tabId: number): void {
  bumpScanGeneration(tabId);
  lastNotifiedKeyByTab.delete(tabId);
  void clearTabScanBadge(tabId);
  void clearTabScanCache(tabId);
}

export async function scheduleAutoScanForTab(tabId: number, pageUrl: string, pageTitle: string): Promise<void> {
  if (!isHttpUrl(pageUrl) || isRestrictedPageUrl(pageUrl)) {
    return;
  }

  if (!(await isAutoScanEnabled())) {
    return;
  }

  let whitelisted = false;
  try {
    whitelisted = await isUrlWhitelisted(pageUrl);
  } catch {
    whitelisted = false;
  }
  if (whitelisted) {
    clearAutoScanStateForTab(tabId);
    return;
  }

  lastNotifiedKeyByTab.delete(tabId);
  const generation = bumpScanGeneration(tabId);
  await markTabScanning(tabId, pageUrl);
  await startBehaviorObserverForTab(tabId, pageUrl);

  void runBackgroundScan(tabId, pageUrl, pageTitle, generation);
}

export async function requestRescanForTab(tabId: number): Promise<void> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }

  const pageUrl = tab.url ?? "";
  if (!isHttpUrl(pageUrl) || isRestrictedPageUrl(pageUrl)) {
    return;
  }

  lastNotifiedKeyByTab.delete(tabId);
  const generation = bumpScanGeneration(tabId);
  await markTabScanning(tabId, pageUrl);
  await startBehaviorObserverForTab(tabId, pageUrl);
  void runBackgroundScan(tabId, pageUrl, tab.title ?? "", generation);
}

export async function scanActiveTabIfAuto(): Promise<void> {
  if (!(await isAutoScanEnabled())) {
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id === undefined || !tab.url) {
    return;
  }

  await scheduleAutoScanForTab(tab.id, tab.url, tab.title ?? "");
}
