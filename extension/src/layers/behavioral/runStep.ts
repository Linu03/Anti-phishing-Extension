import { getApiBaseUrl } from "../apiBase";
import { isRestrictedPageUrl } from "../restrictedPageUrl";
import { fetchBehavioralAnalyze } from "./api";
import type { BehaviorDiff, BehavioralContextPayload, BehavioralStepResult } from "./types";

export async function runBehavioralStep(
  pageUrl: string,
  diff: BehaviorDiff | null,
  context: BehavioralContextPayload,
): Promise<BehavioralStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return { status: "skipped", reason: "restricted" };
  }

  if (diff === null) {
    return { status: "skipped", reason: "no_diff" };
  }

  const nothingChanged =
    !diff.forms_appeared &&
    !diff.password_inputs_increased &&
    !diff.action_origin_changed &&
    !diff.brand_hits_increased;

  if (nothingChanged) {
    return {
      status: "ok",
      score: 0,
      findings: [],
    };
  }

  const baseUrl = getApiBaseUrl();

  try {
    const result = await fetchBehavioralAnalyze(baseUrl, pageUrl, diff, context);

    return {
      status: "ok",
      score: result.score,
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
