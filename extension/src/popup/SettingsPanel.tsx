import { useEffect, useState, type ReactNode } from "react";
import { Check, Layers, MessageCircle, ScanLine, ShieldCheck, Timer } from "lucide-react";
import { getUserSettings, updateUserSettings } from "../settings/storage";
import type { ExplanationMode, ScanMode } from "../settings/types";

function ScanModeOption({
  mode,
  selected,
  title,
  description,
  icon,
  onSelect,
}: {
  mode: ScanMode;
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: (mode: ScanMode) => void;
}) {
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

function ExplanationModeOption({
  mode,
  selected,
  title,
  description,
  icon,
  onSelect,
}: {
  mode: ExplanationMode;
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: (mode: ExplanationMode) => void;
}) {
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
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>("off");

  useEffect(() => {
    let stillMounted = true;
    void getUserSettings().then((settings) => {
      if (stillMounted) {
        setScanMode(settings.scanMode);
        setExplanationMode(settings.explanationMode);
      }
    });
    return () => {
      stillMounted = false;
    };
  }, []);

  async function handleSelectScanMode(mode: ScanMode) {
    setScanMode(mode);
    await updateUserSettings({ scanMode: mode });
  }

  async function handleSelectExplanationMode(mode: ExplanationMode) {
    setExplanationMode(mode);
    await updateUserSettings({ explanationMode: mode });
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
              void handleSelectScanMode(mode);
            }}
          />
          <ScanModeOption
            mode="auto_when_ready"
            selected={scanMode === "auto_when_ready"}
            title="Automatic when ready"
            description="Scan this tab automatically when you open the popup."
            icon={<Timer className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelectScanMode(mode);
            }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">Explanation</p>
        <div className="space-y-2">
          <ExplanationModeOption
            mode="off"
            selected={explanationMode === "off"}
            title="Score only"
            description="Show only the risk score and verdict. No breakdown or extra explanation."
            icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelectExplanationMode(mode);
            }}
          />
          <ExplanationModeOption
            mode="technical"
            selected={explanationMode === "technical"}
            title="Technical details"
            description="Show the full scan breakdown and a button to generate an AI-written technical summary."
            icon={<Layers className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelectExplanationMode(mode);
            }}
          />
          <ExplanationModeOption
            mode="plain"
            selected={explanationMode === "plain"}
            title="Plain English"
            description="Show score contributions per check and a button for an easy-to-read summary (local Ollama)."
            icon={<MessageCircle className="h-4 w-4" strokeWidth={1.5} />}
            onSelect={(mode) => {
              void handleSelectExplanationMode(mode);
            }}
          />
        </div>
      </div>
    </div>
  );
}
