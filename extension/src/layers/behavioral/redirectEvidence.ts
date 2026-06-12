export const REDIRECT_EVIDENCE_PREFIX = "behavior_redirect_";

export type RedirectEvidence = {
  pageUrl: string;
  start_host: string;
  end_host: string;
  redirect_ms: number;
  updatedAt: number;
};

export const MSG_STORE_REDIRECT_EVIDENCE = "AFS_STORE_REDIRECT_EVIDENCE";

export function redirectEvidenceKey(tabId: number): string {
  return `${REDIRECT_EVIDENCE_PREFIX}${tabId}`;
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

export async function storeRedirectEvidence(tabId: number, evidence: RedirectEvidence): Promise<void> {
  try {
    await chrome.storage.session.set({ [redirectEvidenceKey(tabId)]: evidence });
  } catch {
    // ignore
  }
}

export async function clearRedirectEvidenceForTab(tabId: number): Promise<void> {
  try {
    await chrome.storage.session.remove(redirectEvidenceKey(tabId));
  } catch {
    // ignore
  }
}

export async function readRedirectEvidence(tabId: number): Promise<RedirectEvidence | null> {
  let stored: Record<string, unknown>;
  try {
    stored = await chrome.storage.session.get(redirectEvidenceKey(tabId));
  } catch {
    return null;
  }
  const record = stored[redirectEvidenceKey(tabId)];
  return isRedirectEvidence(record) ? record : null;
}
