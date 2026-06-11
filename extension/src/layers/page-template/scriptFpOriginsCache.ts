import { fetchScriptFpOrigins } from "./api";

const CACHE_KEY = "page_template_script_fp_origins";
const TTL_MS = 60 * 60 * 1000;

type ScriptFpOriginsCacheEntry = {
  script_fp_origins: string[];
  version: string;
  fetched_at: number;
};

function isCacheEntry(value: unknown): value is ScriptFpOriginsCacheEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const entry = value as ScriptFpOriginsCacheEntry;
  if (!Array.isArray(entry.script_fp_origins)) {
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

export async function getCachedScriptFpOrigins(apiBaseUrl: string): Promise<string[]> {
  try {
    const stored = await chrome.storage.session.get(CACHE_KEY);
    const cached = stored[CACHE_KEY];
    if (isCacheEntry(cached) && Date.now() - cached.fetched_at < TTL_MS) {
      return cached.script_fp_origins;
    }
  } catch {
    // ignore cache read errors
  }

  try {
    const fresh = await fetchScriptFpOrigins(apiBaseUrl);
    const entry: ScriptFpOriginsCacheEntry = {
      script_fp_origins: fresh.script_fp_origins,
      version: fresh.version,
      fetched_at: Date.now(),
    };
    try {
      await chrome.storage.session.set({ [CACHE_KEY]: entry });
    } catch {
      // ignore cache write errors
    }
    return fresh.script_fp_origins;
  } catch {
    return [];
  }
}
