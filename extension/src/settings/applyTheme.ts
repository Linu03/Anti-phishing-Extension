import { getUserSettings } from "./storage";
import type { Theme } from "./types";

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}


export function initTheme(): void {
  void getUserSettings().then((settings) => {
    applyTheme(settings.theme);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.userSettings) {
      return;
    }
    const next = changes.userSettings.newValue as { theme?: unknown } | undefined;
    if (next && (next.theme === "dark" || next.theme === "light")) {
      applyTheme(next.theme);
    }
  });
}
