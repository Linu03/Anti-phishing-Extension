export type ScanMode = "manual" | "auto_when_ready";

export type ExplanationMode = "off" | "technical" | "plain";

export type UserSettings = {
  scanMode: ScanMode;
  explanationMode: ExplanationMode;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  scanMode: "manual",
  explanationMode: "off",
};
