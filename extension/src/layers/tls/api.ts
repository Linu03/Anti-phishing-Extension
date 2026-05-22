export type ServerTlsInspectResponse = {
  score: number;
  host: string;
  scheme: string;
  issuer: string | null;
  not_before: string | null;
  not_after: string | null;
  findings: Array<{
    rule: string;
    points: number;
    detail: string;
  }>;
};

export async function fetchTlsInspect(
  apiBaseUrl: string,
  pageUrl: string,
): Promise<ServerTlsInspectResponse> {
  const inspectUrl = apiBaseUrl + "/v1/tls/inspect";
  const response = await fetch(inspectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: pageUrl }),
  });

  if (!response.ok) {
    let errorText = "HTTP " + response.status;
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

  const data: ServerTlsInspectResponse = await response.json();
  return data;
}
