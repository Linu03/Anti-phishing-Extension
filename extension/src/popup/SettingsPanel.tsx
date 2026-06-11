import { useEffect, useState, type ReactNode } from "react";
import { Check, ScanLine, Timer } from "lucide-react";
import { getUserSettings, updateUserSettings } from "../settings/storage";
import type { ScanMode } from "../settings/types";

function ScanModeOption({ mode, selected, title, description, icon, onSelect }: { mode: ScanMode; selected: boolean; title: string; description: string; icon: ReactNode; onSelect: (mode: ScanMode) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(mode);
      }}
      className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
        selected
          ? "border-accent-line/50 bg-surface-elevated"
          : "border-surface-border bg-surface-elevated/80 hover:bg-surface-elevated"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 shrink-0 ${selected ? "text-accent-line" : "text-ink-faint"}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-serif text-sm font-semibold text-ink">{title}</p>
            {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent-line" strokeWidth={2} /> : null}
          </div>
          <p className="mt-1 font-sans text-xs leading-snug text-ink-muted">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function SettingsPanel() {
  const [scanMode, setScanMode] = useState<ScanMode>("manual");

  useEffect(() => {
    let stillMounted = true;
    void getUserSettings().then((settings) => {
      if (stillMounted) {
        setScanMode(settings.scanMode);
      }
    });
    return () => {
      stillMounted = false;
    };
  }, []);

  async function handleSelect(mode: ScanMode) {
    setScanMode(mode);
    await updateUserSettings({ scanMode: mode });
  }

  return (
    <div className="space-y-3 px-4 py-2.5">
      <div>
        <p className="mb-2 font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">When to scan</p>
        <div className="space-y-2">
          <ScanModeOption
            mode="manual"
            selected={scanMode === "manual"}
            title="Manual scan"
            description="Scan only when you press the button in the popup."
            icon={<ScanLine className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelect(mode);
            }}
          />
          <ScanModeOption
            mode="auto_when_ready"
            selected={scanMode === "auto_when_ready"}
            title="Automatic when ready"
            description="Scan this tab automatically when you open the popup."
            icon={<Timer className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelect(mode);
            }}
          />
        </div>
      </div>

      <p className="border-t border-surface-border pt-2 font-sans text-[11px] leading-snug text-ink-faint">
        More options will appear here later.
      </p>
    </div>
  );
}
