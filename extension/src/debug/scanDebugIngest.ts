/** TEMPORARY — remove this file and all imports after debug session. */
export const DEBUG_SCAN_REPORT_ENABLED = true;

import { getApiBaseUrl } from "../layers/apiBase";
import type { AnalysisSnapshot } from "../layers/types";
import type { BlocklistStepResult } from "../layers/blacklist/types";
import type { WhitelistStepResult } from "../layers/whitelist/types";
import type { UrlAnalyzerStepResult } from "../layers/url-analyzer/types";
import type { TlsStepResult } from "../layers/tls/types";
import type {
  PageSnapshot,
  PageTemplateStepResult,
  PriorLayersContextPayload,
} from "../layers/page-template/types";
import type { BehaviorDiff, BehavioralContextPayload, BehavioralStepResult } from "../layers/behavioral/types";
import type { RedirectEvidence } from "../layers/behavioral/redirectEvidence";

export type ScanDebugBundle = {
  scanned_at: string;
  page_url: string;
  page_title: string;
  tab_id: number | null;
  page_snapshot: PageSnapshot | null;
  snapshot_inject_failed: boolean;
  prior_context: PriorLayersContextPayload;
  behavioral_context: BehavioralContextPayload;
  behavior_diff: BehaviorDiff | null;
  redirect_evidence: RedirectEvidence | null;
  steps: {
    blocklist: BlocklistStepResult;
    whitelist: WhitelistStepResult;
    url_analyzer: UrlAnalyzerStepResult;
    tls: TlsStepResult;
    page_template: PageTemplateStepResult;
    behavioral: BehavioralStepResult;
  };
  composed: AnalysisSnapshot;
  issues: string[];
};

function pushStepIssues(issues: string[], bundle: ScanDebugBundle): void {
  const { steps, page_snapshot: snapshot } = bundle;

  if (snapshot === null) {
    issues.push("page_collector: inject failed — no DOM snapshot returned");
  } else if (!snapshot.collection_ok) {
    const err = snapshot.collection_error.trim();
    issues.push(err !== "" ? `page_collector: ${err}` : "page_collector: collection_ok is false");
  }

  if (steps.blocklist.status === "failed") {
    issues.push(`blocklist: ${steps.blocklist.errorMessage}`);
  }
  if (steps.url_analyzer.status === "failed") {
    issues.push(`url_analyzer: ${steps.url_analyzer.errorMessage}`);
  }
  if (steps.tls.status === "failed") {
    issues.push(`tls: ${steps.tls.errorMessage}`);
  }

  if (steps.page_template.status === "failed") {
    issues.push(`page_template API: ${steps.page_template.errorMessage}`);
  } else if (steps.page_template.status === "collection_failed") {
    issues.push(`page_template: collection_failed (${steps.page_template.kind})`);
  } else if (steps.page_template.status === "skipped") {
    issues.push(`page_template: skipped (${steps.page_template.kind})`);
  }

  if (steps.behavioral.status === "failed") {
    issues.push(`behavioral API: ${steps.behavioral.errorMessage}`);
  } else if (steps.behavioral.status === "skipped") {
    issues.push(`behavioral: skipped (${steps.behavioral.reason})`);
  }

  if (bundle.behavior_diff === null && steps.behavioral.status !== "skipped") {
    issues.push("behavioral: no behavior diff (observer timeout or tab mismatch)");
  }
}

export function buildScanDebugBundle(
  partial: Omit<ScanDebugBundle, "issues">,
): ScanDebugBundle {
  const issues: string[] = [];
  const bundle: ScanDebugBundle = { ...partial, issues };
  pushStepIssues(issues, bundle);
  return bundle;
}

export async function persistScanDebugReport(bundle: ScanDebugBundle): Promise<string | null> {
  if (!DEBUG_SCAN_REPORT_ENABLED) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/v1/debug/scan-report`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: bundle }),
    });

    if (!response.ok) {
      console.warn("[AFS debug] scan-report HTTP", response.status);
      return null;
    }

    const data: unknown = await response.json();
    if (data !== null && typeof data === "object" && "path" in data && typeof (data as { path: unknown }).path === "string") {
      console.info("[AFS debug] report written:", (data as { path: string }).path);
      return (data as { path: string }).path;
    }

    return null;
  } catch (error) {
    console.warn("[AFS debug] scan-report failed", error);
    return null;
  }
}
