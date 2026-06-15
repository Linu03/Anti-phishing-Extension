import type { Verdict } from "../layers/types";
import { verdictLabel } from "../layers/verdict";

function shouldAlertForVerdict(verdict: Verdict): boolean {
  return verdict === "caution" || verdict === "high_risk";
}

export async function clearTabScanBadge(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
  } catch {
    // tab may be gone
  }
}

async function setTabScanBadge(tabId: number, verdict: Verdict): Promise<void> {
  if (!shouldAlertForVerdict(verdict)) {
    await clearTabScanBadge(tabId);
    return;
  }

  const color = verdict === "high_risk" ? "#991b1b" : "#b45309";
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text: "!" });
  } catch {
    // tab may be gone
  }
}

async function injectScanResultToast(tabId: number, verdict: Verdict): Promise<void> {
  if (!shouldAlertForVerdict(verdict)) {
    return;
  }

  const label = verdictLabel(verdict);
  const toastPayload = {
    verdict: verdict as "caution" | "high_risk",
    label,
  };

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (payload: { verdict: "caution" | "high_risk"; label: string }) => {
        (globalThis as unknown as { __AFS_SCAN_TOAST?: typeof payload }).__AFS_SCAN_TOAST = payload;
      },
      args: [toastPayload],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["scanResultToast.js"],
    });
  } catch {
    // restricted page or tab closed
  }
}

export async function showScanResultAlert(tabId: number, verdict: Verdict): Promise<void> {
  await setTabScanBadge(tabId, verdict);
  await injectScanResultToast(tabId, verdict);
}
