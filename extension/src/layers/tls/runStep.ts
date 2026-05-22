import { getApiBaseUrl } from "../apiBase";
import { isRestrictedPageUrl } from "../restrictedPageUrl";
import { fetchTlsInspect } from "./api";
import type { TlsStepResult } from "./types";

export async function runTlsStep(pageUrl: string): Promise<TlsStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return {
      status: "skipped",
      reason: "No API call (browser page or bad url).",
    };
  }

  const baseUrl = getApiBaseUrl();

  try {
    const serverData = await fetchTlsInspect(baseUrl, pageUrl);
    return {
      status: "ok",
      score: serverData.score,
      findings: serverData.findings,
    };
  } catch (e) {
    let msg = "Unknown error";
    if (e instanceof Error) {
      msg = e.message;
    }
    return { status: "failed", errorMessage: msg };
  }
}
