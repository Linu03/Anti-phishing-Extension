import { getApiBaseUrl } from "../apiBase";
import { isRestrictedPageUrl } from "../restrictedPageUrl";
import { fetchPageTemplateAnalyze } from "./api";
import { getCachedBrandIds } from "./brandIdsCache";
import { collectPageSnapshotFromTab } from "./collectFromTab";
import { buildEmptySnapshot } from "./emptySnapshot";
import { sanitizedTabUrl } from "./urlSanitize";
import type { PriorLayersContextPayload } from "./types";
import type { PageTemplateStepResult } from "./types";

export async function runPageTemplateStep(
  pageUrl: string,
  context: PriorLayersContextPayload,
): Promise<PageTemplateStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return { status: "skipped", kind: "restricted" };
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    return {
      status: "collection_failed",
      kind: context.whitelist_trusted ? "trusted" : "untrusted",
    };
  }

  const baseUrl = getApiBaseUrl();
  const brandIds = await getCachedBrandIds(baseUrl);

  let snapshot = await collectPageSnapshotFromTab(tabId, brandIds);
  if (snapshot === null) {
    snapshot = buildEmptySnapshot(pageUrl, "inject_failed");
  }

  const apiPageUrl = sanitizedTabUrl(pageUrl);

  try {
    const result = await fetchPageTemplateAnalyze(
      baseUrl,
      apiPageUrl !== "" ? apiPageUrl : pageUrl,
      snapshot,
      context,
    );

    return {
      status: "ok",
      score: result.score,
      gate: result.gate,
      page_safe: result.page_safe,
      credential_context: result.credential_context,
      findings: result.findings,
    };
  } catch (e) {
    let msg = "Unknown error";
    if (e instanceof Error) {
      msg = e.message;
    }
    return { status: "failed", errorMessage: msg };
  }
}
