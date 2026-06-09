import type { PageSnapshot, PriorLayersContextPayload } from "./types";

export type ServerBrandIdsResponse = {
  brand_ids: string[];
  version: string;
};

export type ServerPageTemplateResponse = {
  score: number;
  gate: "BLOCK" | "REVIEW" | "SAFE" | "INFO";
  page_safe: boolean;
  credential_context: boolean;
  findings: Array<{
    rule: string;
    points: number;
    detail: string;
    tier?: string;
  }>;
};

export async function fetchBrandIds(apiBaseUrl: string): Promise<ServerBrandIdsResponse> {
  const url = `${apiBaseUrl}/v1/page-template/brand-ids`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data: ServerBrandIdsResponse = await response.json();
  return data;
}

export async function fetchPageTemplateAnalyze(
  apiBaseUrl: string,
  pageUrl: string,
  snapshot: PageSnapshot,
  context: PriorLayersContextPayload,
): Promise<ServerPageTemplateResponse> {
  const analyzeUrl = `${apiBaseUrl}/v1/page-template/analyze`;
  const response = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page_url: pageUrl,
      snapshot,
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

  const data: ServerPageTemplateResponse = await response.json();
  return data;
}
