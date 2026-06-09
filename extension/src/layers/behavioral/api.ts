import type { BehaviorDiff, BehavioralContextPayload } from "./types";

export type ServerBehavioralResponse = {
  score: number;
  gate: "BLOCK" | "REVIEW" | "SAFE";
  findings: Array<{
    rule: string;
    points: number;
    detail: string;
    tier?: string;
  }>;
};

export async function fetchBehavioralAnalyze(
  apiBaseUrl: string,
  pageUrl: string,
  diff: BehaviorDiff,
  context: BehavioralContextPayload,
): Promise<ServerBehavioralResponse> {
  const url = `${apiBaseUrl}/v1/behavioral/analyze`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page_url: pageUrl,
      diff,
      context,
    }),
  });

  if (!response.ok) {
    let errorText = `HTTP ${response.status}`;
    try {
      const errJson: unknown = await response.json();
      if (
        errJson !== null &&
        typeof errJson === "object" &&
        "detail" in errJson &&
        typeof (errJson as { detail: unknown }).detail === "string"
      ) {
        errorText = (errJson as { detail: string }).detail;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorText);
  }

  const data: ServerBehavioralResponse = await response.json();
  return data;
}
