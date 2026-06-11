import { ArrowLeft, Settings, Shield } from "lucide-react";

type PopupHeaderProps = {
  variant: "main" | "settings";
  onSettingsClick?: () => void;
  onBackClick?: () => void;
};

export function PopupHeader({ variant, onSettingsClick, onBackClick }: PopupHeaderProps) {
  if (variant === "settings") {
    return (
      <div className="border-b border-surface-border bg-surface-elevated/60 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackClick}
            aria-label="Back to analysis"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-surface-border bg-surface text-ink-muted transition hover:bg-surface-elevated hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-base font-semibold leading-tight text-ink">Settings</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-surface-border bg-surface-elevated/60 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-surface-border bg-surface">
          <Shield className="h-4 w-4 text-accent-line" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-base font-semibold leading-tight text-ink">Anti-Phishing Shield</h1>
        </div>
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Open settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-surface-border bg-surface text-ink-muted transition hover:bg-surface-elevated hover:text-ink"
        >
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
