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

function normalizePageUrl(url: string): string {
  return url.trim().split("#")[0];
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

export async function clearBehaviorDiffForTab(tabId: number): Promise<void> {
  try {
    await chrome.storage.session.remove(behaviorDiffKey(tabId));
  } catch {
    // ignore
  }
}

export async function getBehaviorDiffForTab(tabId: number, pageUrl: string): Promise<BehaviorDiff | null> {
  let stored: Record<string, unknown>;
  try {
    stored = await chrome.storage.session.get(behaviorDiffKey(tabId));
  } catch {
    return null;
  }

  const record = stored[behaviorDiffKey(tabId)];
  if (!isStoredRecord(record)) {
    return null;
  }

  if (record.status !== "ready") {
    return null;
  }

  const expected = normalizePageUrl(pageUrl);
  const actual = normalizePageUrl(record.pageUrl);
  if (expected === "" || actual === "" || expected !== actual) {
    return null;
  }

  return record.diff;
}
