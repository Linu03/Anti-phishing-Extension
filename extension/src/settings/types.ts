export type ScanMode = "manual" | "auto_when_ready";

export type UserSettings = {
  scanMode: ScanMode;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  scanMode: "manual",
};
