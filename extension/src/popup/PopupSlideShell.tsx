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
    <div className="w-[360px] border border-surface-border bg-surface shadow-sm">
      {showSettings ? (
        <>
          <PopupHeader variant="settings" onBackClick={onCloseSettings} />
          <SettingsPanel />
        </>
      ) : (
        <>
          <PopupHeader variant="main" onSettingsClick={onOpenSettings} />
          {children}
        </>
      )}
    </div>
  );
}
