import { fetchBrandIds } from "./api";

const CACHE_KEY = "page_template_brand_ids";
const TTL_MS = 60 * 60 * 1000;

type BrandIdsCacheEntry = {
  brand_ids: string[];
  version: string;
  fetched_at: number;
};

function isCacheEntry(value: unknown): value is BrandIdsCacheEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const entry = value as BrandIdsCacheEntry;
  if (!Array.isArray(entry.brand_ids)) {
    return false;
  }
  if (typeof entry.version !== "string") {
    return false;
  }
  if (typeof entry.fetched_at !== "number") {
    return false;
  }
  return true;
}

/**
 * Brand IDs for local page scanning. Source of truth is backend registry;
 * cached in session storage with a 1-hour TTL.
 */
export async function getCachedBrandIds(apiBaseUrl: string): Promise<string[]> {
  try {
    const stored = await chrome.storage.session.get(CACHE_KEY);
    const cached = stored[CACHE_KEY];
    if (isCacheEntry(cached) && Date.now() - cached.fetched_at < TTL_MS) {
      return cached.brand_ids;
    }
  } catch {
    // ignore cache read errors
  }

  try {
    const fresh = await fetchBrandIds(apiBaseUrl);
    const entry: BrandIdsCacheEntry = {
      brand_ids: fresh.brand_ids,
      version: fresh.version,
      fetched_at: Date.now(),
    };
    try {
      await chrome.storage.session.set({ [CACHE_KEY]: entry });
    } catch {
      // ignore cache write errors
    }
    return fresh.brand_ids;
  } catch {
    return [];
  }
}
