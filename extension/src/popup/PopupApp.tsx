import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Layers,
  ShieldCheck,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import { loadActiveTabPhishingAnalysis } from "../lib/loadActiveTabAnalysis";
import { scoreHue, verdictFromScore, verdictLabel } from "../lib/verdict";
import type { AnalysisSnapshot, LayerSignal, Verdict } from "../lib/types";

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "safe") {
    return <ShieldCheck className="h-5 w-5 text-accent-safe" strokeWidth={2} />;
  }
  if (verdict === "caution") {
    return <AlertTriangle className="h-5 w-5 text-accent-warn" strokeWidth={2} />;
  }
  return <ShieldOff className="h-5 w-5 text-accent-danger" strokeWidth={2} />;
}

function ScoreRing({ score }: { score: number }) {
  const hue = scoreHue(score);
  let pct = score;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#243044"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={hue}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 264} 264`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="relative text-center">
        <p
          className="font-display text-3xl font-semibold tabular-nums tracking-tight"
          style={{ color: hue }}
        >
          {score}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
          score
        </p>
      </div>
    </div>
  );
}

function LayerRow({ layer, max }: { layer: LayerSignal; max: number }) {
  let width = 0;
  if (max > 0) {
    width = Math.round((layer.contribution / max) * 100);
  }
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span className="truncate text-sm font-medium text-slate-200">
            {layer.label}
          </span>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">
          +{layer.contribution}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500/80 to-cyan-400/90 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{layer.detail}</p>
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
      <div className="flex w-[400px] items-center justify-center bg-surface py-16 text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  const verdict = verdictFromScore(snapshot.threatScore);

  let maxContribution = 1;
  for (let i = 0; i < snapshot.layers.length; i++) {
    const c = snapshot.layers[i].contribution;
    if (c > maxContribution) {
      maxContribution = c;
    }
  }

  return (
    <div className="w-[400px] bg-surface pb-4 pt-3">
      <header className="flex items-center gap-2.5 border-b border-surface-border px-4 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-cyan-400/10 ring-1 ring-sky-500/30">
          <Sparkles className="h-4 w-4 text-accent-info" />
        </div>
        <div>
          <h1 className="font-display text-sm font-semibold leading-tight text-white">
            Anti-Phishing Shield
          </h1>
          <p className="text-[11px] text-slate-500">Simple multi-layer view</p>
        </div>
      </header>

      <section className="mt-4 px-4">
        <div className="flex gap-4 rounded-xl border border-surface-border bg-surface-elevated/40 p-4 shadow-glow">
          <ScoreRing score={snapshot.threatScore} />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              <VerdictIcon verdict={verdict} />
              <span className="font-display text-lg font-semibold text-white">
                {verdictLabel(verdict)}
              </span>
            </div>
            <p className="truncate text-xs text-slate-400" title={snapshot.pageUrl}>
              {snapshot.pageUrl}
            </p>
            <p className="text-[11px] text-slate-500">Updated: {snapshot.lastChecked}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 px-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Layers
        </h2>
        <ul className="flex flex-col gap-2">
          {snapshot.layers.map((layer) => (
            <li key={layer.id}>
              <LayerRow layer={layer} max={maxContribution} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-4 flex gap-2 border-t border-surface-border px-4 pt-3">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-accent-safe ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Trust domain
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Report
        </button>
      </footer>

      <p className="mt-3 px-4 text-center text-[10px] leading-relaxed text-slate-600">
        Only OpenPhish is real. Other rows are demo numbers.
      </p>
    </div>
  );
}
