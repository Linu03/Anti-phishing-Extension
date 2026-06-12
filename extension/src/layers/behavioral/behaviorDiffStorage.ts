import {
  BEHAVIOR_POLL_INTERVAL_MS,
  BEHAVIOR_WAIT_TIMEOUT_MS,
} from "./constants";
import { readRedirectEvidence } from "./redirectEvidence";
import type { BehaviorDiff } from "./types";

export const BEHAVIOR_DIFF_STORAGE_PREFIX = "behavior_diff_";

export type StoredBehaviorDiff = {
  pageUrl: string;
  diff: BehaviorDiff;
  status: "observing" | "ready";
  updatedAt: number;
};

export function behaviorDiffKey(tabId: number): string {
  return `${BEHAVIOR_DIFF_STORAGE_PREFIX}${tabId}`;
}

export const MSG_STORE_BEHAVIOR_DIFF = "AFS_STORE_BEHAVIOR_DIFF";

function normalizePageUrl(url: string): string {
  const withoutHash = url.trim().split("#")[0];
  try {
    const parsed = new URL(withoutHash);
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
  } catch {
    return withoutHash;
  }
}

function isStoredRecord(value: unknown): value is StoredBehaviorDiff {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as StoredBehaviorDiff;
  if (typeof record.pageUrl !== "string") {
    return false;
  }
  if (record.status !== "observing" && record.status !== "ready") {
    return false;
  }
  if (typeof record.updatedAt !== "number") {
    return false;
  }
  if (record.diff === null || typeof record.diff !== "object") {
    return false;
  }
  return true;
}

export function emptyBehaviorDiff(observedMs = 0): BehaviorDiff {
  return {
    forms_appeared: false,
    password_inputs_increased: false,
    action_origin_changed: false,
    brand_hits_increased: false,
    observed_ms: observedMs,
    redirect_ms: 0,
    start_host: "",
    end_host: "",
  };
}

function mergeRedirectEvidence(
  diff: BehaviorDiff,
  pageUrl: string,
  redirect: Awaited<ReturnType<typeof readRedirectEvidence>>,
): BehaviorDiff {
  if (redirect === null) {
    return diff;
  }
  if (normalizePageUrl(redirect.pageUrl) !== normalizePageUrl(pageUrl)) {
    return diff;
  }
  if (redirect.start_host === "" || redirect.end_host === "" || redirect.redirect_ms <= 0) {
    return diff;
  }
  return {
    ...diff,
    redirect_ms: redirect.redirect_ms,
    start_host: redirect.start_host,
    end_host: redirect.end_host,
  };
}

export async function storeBehaviorDiffForTab(tabId: number, record: StoredBehaviorDiff): Promise<void> {
  try {
    await chrome.storage.session.set({ [behaviorDiffKey(tabId)]: record });
  } catch {
    // ignore
  }
}

export async function clearBehaviorDiffForTab(tabId: number): Promise<void> {
  try {
    await chrome.storage.session.remove(behaviorDiffKey(tabId));
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStoredRecord(tabId: number): Promise<StoredBehaviorDiff | null> {
  let stored: Record<string, unknown>;
  try {
    stored = await chrome.storage.session.get(behaviorDiffKey(tabId));
  } catch {
    return null;
  }
  const record = stored[behaviorDiffKey(tabId)];
  return isStoredRecord(record) ? record : null;
}

async function buildMergedDiff(tabId: number, pageUrl: string, base: BehaviorDiff): Promise<BehaviorDiff> {
  const redirect = await readRedirectEvidence(tabId);
  return mergeRedirectEvidence(base, pageUrl, redirect);
}

export async function getBehaviorDiffForTab(tabId: number, pageUrl: string): Promise<BehaviorDiff | null> {
  const expected = normalizePageUrl(pageUrl);
  if (expected === "") {
    return null;
  }

  const deadline = Date.now() + BEHAVIOR_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const record = await readStoredRecord(tabId);

    if (record !== null) {
      const actual = normalizePageUrl(record.pageUrl);
      if (actual === expected && record.status === "ready") {
        return buildMergedDiff(tabId, pageUrl, record.diff);
      }
    }

    await sleep(BEHAVIOR_POLL_INTERVAL_MS);
  }

  const redirect = await readRedirectEvidence(tabId);
  if (redirect !== null && normalizePageUrl(redirect.pageUrl) === expected) {
    return buildMergedDiff(tabId, pageUrl, emptyBehaviorDiff());
  }

  return null;
}
