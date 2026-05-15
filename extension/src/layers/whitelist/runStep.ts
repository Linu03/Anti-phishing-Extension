import { isRestrictedPageUrl } from "../../lib/restrictedPageUrl";
import { isUrlWhitelisted } from "./storage";
import type { WhitelistStepResult } from "./types";

export async function runWhitelistStep(pageUrl: string): Promise<WhitelistStepResult> {
  if (isRestrictedPageUrl(pageUrl)){
    return { status: "skipped", reason: "Not a normal web page."};
  }

  const trusted = await isUrlWhitelisted(pageUrl);
  
  if (trusted)
    return { status: "trusted" };
  return { status: "clear" };
}
