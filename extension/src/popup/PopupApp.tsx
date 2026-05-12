import { useEffect, useState } from "react";
import { AlertTriangle, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { loadActiveTabPhishingAnalysis } from "../lib/loadActiveTabAnalysis";
import { scoreHue, verdictFromScore, verdictLabel } from "../lib/verdict";
import type { AnalysisSnapshot, LayerSignal, Verdict } from "../lib/types";

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const base = "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-sans text-xs font-semibold";
  if (verdict === "safe") {
    return (
      <span className={`${base} border-emerald-900/40 bg-emerald-950/30 text-accent-safe`}>
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        {verdictLabel(verdict)}
      </span>
    );
  }
  if (verdict === "caution") {
    return (
      <span className={`${base} border-amber-900/30 bg-amber-950/20 text-accent-warn`}>
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
        {verdictLabel(verdict)}
      </span>
    );
  }
  return (
    <span className={`${base} border-red-900/30 bg-red-950/20 text-accent-danger`}>
      <ShieldOff className="h-3.5 w-3.5" strokeWidth={2} />
      {verdictLabel(verdict)}
    </span>
  );
}

function ScoreMini({ score }: { score: number }) {
  const hue = scoreHue(score);
  let pct = score;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-14 w-14">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#342f2a" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={hue}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 251} 251`}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-serif text-sm font-semibold tabular-nums"
          style={{ color: hue }}
        >
          {score}
        </span>
      </div>
      <span className="mt-1 font-sans text-[9px] uppercase tracking-wider text-ink-faint">score</span>
    </div>
  );
}

function LayerCard({ layer }: { layer: LayerSignal }) {
  return (
    <div className="rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-serif text-sm font-semibold text-ink">{layer.label}</p>
        {layer.contribution > 0 ? (
          <span className="shrink-0 font-sans text-xs font-medium text-accent-danger">+{layer.contribution}</span>
        ) : (
          <span className="shrink-0 font-sans text-xs text-ink-muted">0</span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-3 font-sans text-xs leading-snug text-ink-muted">{layer.detail}</p>
    </div>
  );
}

export function PopupApp() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);

  useEffect(() => {
    let stillMounted = true;

    async function load() {
      try {
        const data = await loadActiveTabPhishingAnalysis();
        if (stillMounted) {
          setSnapshot(data);
        }
      } catch {
        if (stillMounted) {
          setSnapshot(null);
        }
      }
    }

    void load();

    return () => {
      stillMounted = false;
    };
  }, []);

  if (snapshot === null) {
    return (
      <div className="flex w-[360px] items-center gap-3 border border-surface-border bg-surface-elevated/50 px-4 py-3">
        <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
        <p className="font-sans text-sm text-ink-muted">Checking this tab…</p>
      </div>
    );
  }

  const verdict = verdictFromScore(snapshot.threatScore);
  const layer = snapshot.layers[0];

  return (
    <div className="w-[360px] border border-surface-border bg-surface shadow-sm">
      <div className="border-b border-surface-border bg-surface-elevated/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-surface-border bg-surface">
            <Shield className="h-4 w-4 text-accent-line" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-base font-semibold leading-tight text-ink">Anti-Phishing Shield</h1>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="line-clamp-2 font-serif text-sm font-medium leading-snug text-ink" title={snapshot.pageTitle || undefined}>
              {snapshot.pageTitle?.trim() || "Untitled tab"}
            </p>
            <p className="line-clamp-2 break-all font-sans text-[11px] leading-snug text-ink-muted" title={snapshot.pageUrl}>
              {snapshot.pageUrl}
            </p>
          </div>
          <ScoreMini score={snapshot.threatScore} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
          <VerdictBadge verdict={verdict} />
          <span className="font-sans text-[10px] text-ink-faint">{snapshot.lastChecked}</span>
        </div>

        {layer ? <LayerCard layer={layer} /> : null}
      </div>
    </div>
  );
}
