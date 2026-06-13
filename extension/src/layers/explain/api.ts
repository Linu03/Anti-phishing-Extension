import type { ExplainRequest, ExplainResponse } from "./types";

export async function fetchExplain(
  apiBaseUrl: string,
  payload: ExplainRequest,
): Promise<ExplainResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

  const data: ExplainResponse = await response.json();
  return data;
}
