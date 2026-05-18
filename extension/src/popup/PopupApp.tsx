import { useEffect, useState } from "react";
import { AlertTriangle, ListPlus, Shield, ShieldCheck, ShieldOff, ShieldPlus } from "lucide-react";
import { loadActiveTabPhishingAnalysis } from "../layers/analysis/loadActiveTabAnalysis";
import { isRestrictedPageUrl } from "../layers/restrictedPageUrl";
import type { AnalysisSnapshot, LayerSignal, Verdict } from "../layers/types";
import { scoreHue, verdictFromScore, verdictLabel } from "../layers/verdict";
import { addWhitelist, isUrlWhitelisted, removeWhitelist } from "../layers/whitelist/storage";
import { addPersonalBlock, isUrlPersonallyBlocked } from "../user-lists/personalBlocklist";

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
      <div className="relative h-12 w-12">
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
    <div className="rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-serif text-sm font-semibold text-ink">{layer.label}</p>
        {layer.contribution > 0 ? (
          <span className="shrink-0 font-sans text-xs font-medium text-accent-danger">+{layer.contribution}</span>
        ) : null}
        {layer.contribution < 0 ? (
          <span className="shrink-0 font-sans text-xs font-medium text-accent-safe">{layer.contribution}</span>
        ) : null}
        {layer.contribution === 0 ? (
          <span className="shrink-0 font-sans text-xs text-ink-muted">0</span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 font-sans text-xs leading-snug text-ink-muted">{layer.detail}</p>
    </div>
  );
}

export function PopupApp() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [onPersonalList, setOnPersonalList] = useState(false);
  const [onWhitelist, setOnWhitelist] = useState(false);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [whitelistBusy, setWhitelistBusy] = useState(false);
  const [personalHint, setPersonalHint] = useState<string | null>(null);
  const [whitelistHint, setWhitelistHint] = useState<string | null>(null);

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

  useEffect(() => {
    if (snapshot === null) {
      return;
    }
    const pageUrl = snapshot.pageUrl;
    let cancelled = false;

    async function checkLists() {
      if (isRestrictedPageUrl(pageUrl)) {
        if (!cancelled) {
          setOnPersonalList(false);
          setOnWhitelist(false);
        }
        return;
      }
      try {
        const blocked = await isUrlPersonallyBlocked(pageUrl);
        const trusted = await isUrlWhitelisted(pageUrl);
        if (!cancelled) {
          setOnPersonalList(blocked);
          setOnWhitelist(trusted);
        }
      } catch {
        if (!cancelled) {
          setOnPersonalList(false);
          setOnWhitelist(false);
        }
      }
    }

    void checkLists();

    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  async function handleTrustCurrentSite() {
    setWhitelistHint(null);
    setWhitelistBusy(true);
    try {
      const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabList[0];
      let url = "";
      if (tab && tab.url) {
        url = tab.url.trim();
      }
      if (url === "" || isRestrictedPageUrl(url)) {
        setWhitelistHint("This tab cannot be added (not a normal web page).");
        return;
      }
      if (await isUrlPersonallyBlocked(url)) {
        setWhitelistHint("Remove from blocklist first.");
        return;
      }
      if (await isUrlWhitelisted(url)) {
        setWhitelistHint("Already on your trusted list.");
        setOnWhitelist(true);
        return;
      }
      const ok = await addWhitelist(url);
      if (!ok) {
        setWhitelistHint("Could not add (maybe on blocklist).");
        return;
      }
      setOnWhitelist(true);
      setWhitelistHint("Saved. This host is on your trusted list.");
      const fresh = await loadActiveTabPhishingAnalysis();
      setSnapshot(fresh);
    } catch {
      setWhitelistHint("Could not save. Try again.");
    } finally {
      setWhitelistBusy(false);
    }
  }

  async function handleRemoveTrustCurrentSite() {
    setWhitelistHint(null);
    setWhitelistBusy(true);
    try {
      const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabList[0];
      let url = "";
      if (tab && tab.url) {
        url = tab.url.trim();
      }
      if (url === "" || isRestrictedPageUrl(url)) {
        return;
      }
      await removeWhitelist(url);
      setOnWhitelist(false);
      setWhitelistHint("Removed from trusted list.");
      const fresh = await loadActiveTabPhishingAnalysis();
      setSnapshot(fresh);
    } catch {
      setWhitelistHint("Could not remove. Try again.");
    } finally {
      setWhitelistBusy(false);
    }
  }

  async function handleAddCurrentSiteToPersonalList() {
    setPersonalHint(null);
    setPersonalBusy(true);
    try {
      const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabList[0];
      let url = "";
      if (tab && tab.url) {
        url = tab.url.trim();
      }
      if (url === "" || isRestrictedPageUrl(url)) {
        setPersonalHint("This tab cannot be added (not a normal web page).");
        return;
      }
      if (await isUrlWhitelisted(url)) {
        setPersonalHint("Remove from trusted list first.");
        return;
      }
      if (await isUrlPersonallyBlocked(url)) {
        setPersonalHint("Already on your blocklist.");
        setOnPersonalList(true);
        return;
      }
      const ok = await addPersonalBlock(url);
      if (!ok) {
        setPersonalHint("Could not add.");
        return;
      }
      setOnPersonalList(true);
      setPersonalHint("Saved. Reload the tab — the whole site host is blocked.");
    } catch {
      setPersonalHint("Could not save. Try again.");
    } finally {
      setPersonalBusy(false);
    }
  }

  if (snapshot === null) {
    return (
      <div className="flex w-[360px] items-center gap-3 border border-surface-border bg-surface-elevated/50 px-4 py-3">
        <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
        <p className="font-sans text-sm text-ink-muted">Checking this tab…</p>
      </div>
    );
  }

  const verdict = verdictFromScore(snapshot.threatScore);
  const pageOk = !isRestrictedPageUrl(snapshot.pageUrl);
  const showPersonalBlockSection = pageOk && !onPersonalList && !onWhitelist;
  const showTrustSection = pageOk && !onWhitelist && !onPersonalList;
  const showRemoveTrustSection = pageOk && onWhitelist;
  const personalBlockDisabled = personalBusy;
  const whitelistDisabled = whitelistBusy;

  return (
    <div className="w-[360px] border border-surface-border bg-surface shadow-sm">
      <div className="border-b border-surface-border bg-surface-elevated/60 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-surface-border bg-surface">
            <Shield className="h-4 w-4 text-accent-line" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-base font-semibold leading-tight text-ink">Anti-Phishing Shield</h1>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4 py-2.5">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="line-clamp-2 font-serif text-sm font-medium leading-snug text-ink" title={snapshot.pageTitle || undefined}>
              {snapshot.pageTitle?.trim() || "Untitled tab"}
            </p>
            <p className="line-clamp-2 break-all font-sans text-[11px] leading-snug text-ink-muted" title={snapshot.pageUrl}>
              {snapshot.pageUrl}
            </p>
          </div>
          <ScoreMini score={snapshot.threatScore} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-2">
          <VerdictBadge verdict={verdict} />
          <span className="font-sans text-[10px] text-ink-faint">{snapshot.lastChecked}</span>
        </div>

        {snapshot.layers.map((layer) => (
          <LayerCard key={layer.id} layer={layer} />
        ))}

        {personalHint ? (
          <p className="font-sans text-[11px] leading-snug text-ink-muted">{personalHint}</p>
        ) : null}
        {whitelistHint ? (
          <p className="font-sans text-[11px] leading-snug text-ink-muted">{whitelistHint}</p>
        ) : null}

        {showTrustSection || showRemoveTrustSection || showPersonalBlockSection ? (
          <div className="space-y-2 border-t border-surface-border pt-2">
        {showTrustSection ? (
          <div>
            <p className="mb-1 font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">Trusted sites</p>
            <button
              type="button"
              disabled={whitelistDisabled}
              onClick={() => {
                void handleTrustCurrentSite();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-1.5 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Trust this site
            </button>
          </div>
        ) : null}

        {showRemoveTrustSection ? (
          <div className="pt-1">
            <p className="mb-1 font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">Trusted sites</p>
            <button
              type="button"
              disabled={whitelistDisabled}
              onClick={() => {
                void handleRemoveTrustCurrentSite();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-1.5 font-sans text-xs font-semibold text-accent-safe transition hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove from trusted list
            </button>
          </div>
        ) : null}

        {showPersonalBlockSection ? (
          <div className="pt-1">
            <p className="mb-1 font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">My blocklist</p>
            <button
              type="button"
              disabled={personalBlockDisabled}
              onClick={() => {
                void handleAddCurrentSiteToPersonalList();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-1.5 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ListPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Block this site (my list)
            </button>
          </div>
        ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
