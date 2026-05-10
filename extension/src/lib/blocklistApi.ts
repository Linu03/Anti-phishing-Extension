export type ServerBlocklistResponse = {
  listed: boolean;
  sources: string[];
  url_normalized: string;
  host: string;
};

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_BLOCKLIST_API_BASE;
  if (typeof raw === "string" && raw.trim() !== "") {
    let base = raw.trim();
    while (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    return base;
  }
  return "http://127.0.0.1:8000";
}

export async function fetchBlocklistCheck(
  apiBaseUrl: string,
  pageUrl: string,
): Promise<ServerBlocklistResponse> {
  const checkUrl = `${apiBaseUrl}/v1/blacklist/check`;
  const response = await fetch(checkUrl, {
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
    }
    throw new Error(errorText);
  }

  const data: ServerBlocklistResponse = await response.json();
  return data;
}
