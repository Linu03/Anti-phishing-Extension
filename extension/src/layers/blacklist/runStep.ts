import { getApiBaseUrl } from "../apiBase";
import { isRestrictedPageUrl } from "../restrictedPageUrl";
import { fetchBlocklistCheck } from "./api";
import type { BlocklistStepResult } from "./types";

export async function runBlocklistStep(pageUrl: string): Promise<BlocklistStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return {
      status: "skipped",
      reason: "No API call (browser page or bad url).",
    };
  }

  const baseUrl = getApiBaseUrl();

  try {
    const serverData = await fetchBlocklistCheck(baseUrl, pageUrl);
    if (serverData.listed === true) {
      return { status: "listed", sources: serverData.sources };
    }
    return { status: "clear" };
  } catch (e) {
    let msg = "Unknown error";
    if (e instanceof Error) {
      msg = e.message;
    }
    return { status: "failed", errorMessage: msg };
  }
}
