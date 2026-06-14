import { getApiBaseUrl } from "../apiBase";
import { fetchWithTimeout } from "../fetchWithTimeout";
import type { Verdict } from "../types";

export type StatsPeriod = "day" | "week" | "month" | "year";

export type StatsSummary = {
  period: StatsPeriod;
  interval: string;
  since: string;
  total_scans: number;
  by_verdict: Record<Verdict, number>;
  top_hosts: Array<{ page_host: string; count: number }>;
};

export type ScanSummary = {
  id: number;
  scanned_at: string;
  page_url: string;
  page_host: string;
  page_title: string;
  threat_score: number;
  verdict: Verdict;
  layer_scores: Record<string, number>;
};

export type RuleHit = {
  layer_id: string;
  rule: string;
  points: number;
  tier: string;
  detail: string;
};

export type ScanDetail = ScanSummary & {
  rule_hits: RuleHit[];
};

export type ScanListResponse = {
  items: ScanSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type ScanListFilters = {
  limit?: number;
  offset?: number;
  verdict?: Verdict;
  host?: string;
  period?: StatsPeriod;
};

async function parseError(response: Response): Promise<string> {
  let message = `HTTP ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string") {
        message = detail;
      }
    }
  } catch {
    // ignore
  }
  return message;
}

export async function fetchStatsSummary(period: StatsPeriod): Promise<StatsSummary> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/v1/stats/summary?period=${encodeURIComponent(period)}`;
  const response = await fetchWithTimeout(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as StatsSummary;
}

export async function fetchScanList(filters: ScanListFilters = {}): Promise<ScanListResponse> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset !== undefined) {
    params.set("offset", String(filters.offset));
  }
  if (filters.verdict !== undefined) {
    params.set("verdict", filters.verdict);
  }
  if (filters.host !== undefined && filters.host.trim() !== "") {
    params.set("host", filters.host.trim());
  }
  if (filters.period !== undefined) {
    params.set("period", filters.period);
  }

  const query = params.toString();
  const url = query === "" ? `${baseUrl}/v1/scans` : `${baseUrl}/v1/scans?${query}`;
  const response = await fetchWithTimeout(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as ScanListResponse;
}

export async function fetchScanDetail(scanId: number): Promise<ScanDetail> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/v1/scans/${scanId}`;
  const response = await fetchWithTimeout(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as ScanDetail;
}

export function statsExportCsvUrl(period?: StatsPeriod): string {
  const baseUrl = getApiBaseUrl();
  if (period === undefined) {
    return `${baseUrl}/v1/stats/export.csv`;
  }
  return `${baseUrl}/v1/stats/export.csv?period=${encodeURIComponent(period)}`;
}
