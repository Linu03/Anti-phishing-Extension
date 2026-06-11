import type { ReactNode } from "react";
import { PopupHeader } from "./PopupHeader";
import { SettingsPanel } from "./SettingsPanel";

type PopupSlideShellProps = {
  showSettings: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  children: ReactNode;
};

export function PopupSlideShell({ showSettings, onOpenSettings, onCloseSettings, children }: PopupSlideShellProps) {
  return (
    <div className="w-[360px] overflow-hidden border border-surface-border bg-surface shadow-sm">
      <div
        className="flex w-[200%] transition-transform duration-300 ease-out"
        style={{ transform: showSettings ? "translateX(-50%)" : "translateX(0)" }}
      >
        <div className="w-1/2 shrink-0">
          <PopupHeader variant="main" onSettingsClick={onOpenSettings} />
          {children}
        </div>
        <div className="w-1/2 shrink-0">
          <PopupHeader variant="settings" onBackClick={onCloseSettings} />
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}
