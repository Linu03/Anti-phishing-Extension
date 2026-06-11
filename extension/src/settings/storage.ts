import { DEFAULT_USER_SETTINGS, type ScanMode, type UserSettings } from "./types";

const STORAGE_KEY = "userSettings";

function isScanMode(value: unknown): value is ScanMode {
  return value === "manual" || value === "auto_when_ready";
}

export async function getUserSettings(): Promise<UserSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const raw = data[STORAGE_KEY];
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return { ...DEFAULT_USER_SETTINGS };
  }
  const scanMode = (raw as UserSettings).scanMode;
  if (!isScanMode(scanMode)) {
    return { ...DEFAULT_USER_SETTINGS };
  }
  return { scanMode };
}

export async function updateUserSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings();
  const next: UserSettings = { ...current, ...partial };
  const bag: Record<string, UserSettings> = {};
  bag[STORAGE_KEY] = next;
  await chrome.storage.local.set(bag);
  return next;
}
