import {
  BEHAVIOR_POLL_INTERVAL_MS,
  BEHAVIOR_WAIT_TIMEOUT_MS,
} from "./constants";
import { readRedirectEvidence } from "./redirectEvidence";
import type { BehaviorDiff, ClipboardShellWrite, JsExfilAttempt } from "./types";

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

export function normalizeScanPageUrl(url: string): string {
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

function isJsExfilAttempt(value: unknown): value is JsExfilAttempt {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const item = value as JsExfilAttempt;
  return (
    typeof item.dest_host === "string" &&
    typeof item.dest_origin === "string" &&
    typeof item.method === "string" &&
    (item.via === "fetch" || item.via === "xhr" || item.via === "sendBeacon")
  );
}

function isClipboardShellWrite(value: unknown): value is ClipboardShellWrite {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const item = value as ClipboardShellWrite;
  return typeof item.snippet === "string" && typeof item.looks_shell === "boolean";
}

function normalizeBehaviorDiff(raw: BehaviorDiff): BehaviorDiff {
  const attempts = Array.isArray(raw.js_exfil_attempts) ? raw.js_exfil_attempts : [];
  const js_exfil_attempts = attempts.filter((item) => isJsExfilAttempt(item));
  const writes = Array.isArray(raw.clipboard_shell_writes) ? raw.clipboard_shell_writes : [];
  const clipboard_shell_writes = writes.filter((item) => isClipboardShellWrite(item));
  return {
    ...raw,
    js_exfil_attempts,
    clipboard_shell_writes,
  };
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
    js_exfil_attempts: [],
    clipboard_shell_writes: [],
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
  if (normalizeScanPageUrl(redirect.pageUrl) !== normalizeScanPageUrl(pageUrl)) {
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
  const merged = mergeRedirectEvidence(base, pageUrl, redirect);
  return normalizeBehaviorDiff(merged);
}

export async function getBehaviorDiffForTab(tabId: number, pageUrl: string): Promise<BehaviorDiff | null> {
  const expected = normalizeScanPageUrl(pageUrl);
  if (expected === "") {
    return null;
  }

  const deadline = Date.now() + BEHAVIOR_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const record = await readStoredRecord(tabId);

    if (record !== null) {
      const actual = normalizeScanPageUrl(record.pageUrl);
      if (actual === expected && record.status === "ready") {
        return buildMergedDiff(tabId, pageUrl, normalizeBehaviorDiff(record.diff));
      }
    }

    await sleep(BEHAVIOR_POLL_INTERVAL_MS);
  }

  const redirect = await readRedirectEvidence(tabId);
  if (redirect !== null && normalizeScanPageUrl(redirect.pageUrl) === expected) {
    return buildMergedDiff(tabId, pageUrl, emptyBehaviorDiff());
  }

  return null;
}
