import { getApiBaseUrl } from "../apiBase";
import { fetchWithTimeout } from "../fetchWithTimeout";
import type { AnalysisSnapshot } from "../types";

export async function persistScanRecord(snapshot: AnalysisSnapshot): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/v1/scans/ingest`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      console.warn("[AFS] scan ingest HTTP", response.status);
    }
  } catch (error) {
    console.warn("[AFS] scan ingest failed", error);
  }
}
