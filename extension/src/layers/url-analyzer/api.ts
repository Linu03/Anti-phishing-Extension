export type ServerUrlAnalyzerResponse = {
  score: number;
  risk: "low" | "medium" | "high";
  risk_label: string;
  host: string;
  url_normalized: string;
  findings: Array<{
    rule: string;
    points: number;
    detail: string;
  }>;
};

export async function fetchUrlAnalyzer(
  apiBaseUrl: string,
  pageUrl: string,
): Promise<ServerUrlAnalyzerResponse> {
  const analyzeUrl = `${apiBaseUrl}/v1/url-analyzer/analyze`;
  const response = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: pageUrl }),
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

  const data: ServerUrlAnalyzerResponse = await response.json();
  return data;
}
