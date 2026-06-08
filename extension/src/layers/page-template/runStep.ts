import { isRestrictedPageUrl } from "../restrictedPageUrl";
import type { PriorLayersContextPayload } from "./types";
import type { PageTemplateStepResult } from "./types";


export async function runPageTemplateStep(
  pageUrl: string,
  _context: PriorLayersContextPayload,
): Promise<PageTemplateStepResult> {
  if (isRestrictedPageUrl(pageUrl)) {
    return { status: "skipped", kind: "restricted" };
  }

  return { status: "skipped", kind: "not_active" };
}
