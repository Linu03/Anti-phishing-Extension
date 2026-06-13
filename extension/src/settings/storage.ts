import {
  DEFAULT_USER_SETTINGS,
  type ExplanationMode,
  type ScanMode,
  type UserSettings,
} from "./types";

const STORAGE_KEY = "userSettings";

function isScanMode(value: unknown): value is ScanMode {
  return value === "manual" || value === "auto_when_ready";
}

function isExplanationMode(value: unknown): value is ExplanationMode {
  return value === "off" || value === "technical" || value === "plain";
}

function parseExplanationMode(raw: Record<string, unknown>): ExplanationMode {
  if (isExplanationMode(raw.explanationMode)) {
    return raw.explanationMode;
  }

  // Legacy: explainEnabled boolean → plain / off
  if (typeof raw.explainEnabled === "boolean") {
    return raw.explainEnabled ? "plain" : "off";
  }

  return DEFAULT_USER_SETTINGS.explanationMode;
}

export async function getUserSettings(): Promise<UserSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const raw = data[STORAGE_KEY];
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return { ...DEFAULT_USER_SETTINGS };
  }

  const obj = raw as Record<string, unknown>;
  const scanMode = obj.scanMode;
  if (!isScanMode(scanMode)) {
    return { ...DEFAULT_USER_SETTINGS };
  }

  return {
    scanMode,
    explanationMode: parseExplanationMode(obj),
  };
}

export async function updateUserSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings();
  const next: UserSettings = { ...current, ...partial };
  const bag: Record<string, UserSettings> = {};
  bag[STORAGE_KEY] = next;
  await chrome.storage.local.set(bag);
  return next;
}
