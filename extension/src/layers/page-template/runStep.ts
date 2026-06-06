import type { PriorLayersContextPayload } from "./types";
import type { PageTemplateStepResult } from "./types";

/**
 * Page DOM collector is added in a later step.
 * Step 0 only wires orchestration; this step stays skipped in the extension UI.
 */
export async function runPageTemplateStep(
  _pageUrl: string,
  _context: PriorLayersContextPayload,
): Promise<PageTemplateStepResult> {
  return {
    status: "skipped",
    reason: "Page collector not implemented yet (Layer 5 step 0 infrastructure only).",
  };
}
