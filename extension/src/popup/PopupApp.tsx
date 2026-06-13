import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Layers, ListPlus, MessageCircle, ScanLine, Shield, ShieldCheck, ShieldOff, ShieldPlus } from "lucide-react";
import { loadActiveTabPhishingAnalysis } from "../layers/analysis/loadActiveTabAnalysis";
import { loadActiveTabPreview, type TabPreview } from "../layers/analysis/loadActiveTabPreview";
import { getApiBaseUrl } from "../layers/apiBase";
import { fetchExplain } from "../layers/explain/api";
import { buildExplainPayload } from "../layers/explain/buildPayload";
import { isRestrictedPageUrl } from "../layers/restrictedPageUrl";
import type { AnalysisSnapshot, LayerSignal, Verdict } from "../layers/types";
import { scoreHue, verdictFromScore, verdictLabel } from "../layers/verdict";
import { getUserSettings } from "../settings/storage";
import type { ExplanationMode, ScanMode } from "../settings/types";
import { addWhitelist, isUrlWhitelisted, removeWhitelist } from "../layers/whitelist/storage";
import { addPersonalBlock, isUrlPersonallyBlocked } from "../user-lists/personalBlocklist";
import { PopupSlideShell } from "./PopupSlideShell";

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

function ContributionBadge({ contribution }: { contribution: number }) {
  if (contribution > 0) {
    return <span className="shrink-0 font-sans text-xs font-medium text-accent-danger">+{contribution}</span>;
  }
  if (contribution < 0) {
    return <span className="shrink-0 font-sans text-xs font-medium text-accent-safe">{contribution}</span>;
  }
  return <span className="shrink-0 font-sans text-xs text-ink-muted">0</span>;
}

function LayerCard({
  layer,
  compact,
  expandable = false,
  expanded = false,
  onToggle,
}: {
  layer: LayerSignal;
  compact: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const showDetail = !compact && layer.detail.trim() !== "";

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {expandable ? (
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
          <p className="font-serif text-sm font-semibold text-ink">{layer.label}</p>
        </div>
        <ContributionBadge contribution={layer.contribution} />
      </div>
      {showDetail ? (
        <p className="mt-1 font-sans text-xs leading-snug text-ink-muted">{layer.detail}</p>
      ) : null}
    </>
  );

  const cardClass =
    "w-full rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-2 text-left transition";

  if (expandable && onToggle) {
    return (
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`${cardClass} hover:bg-surface-elevated`}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

function layersForDisplay(layers: LayerSignal[], mode: ExplanationMode): LayerSignal[] {
  if (mode === "off") {
    return [];
  }
  return layers.filter((layer) => layer.contribution !== 0);
}

type ScanPhase = "idle" | "loading" | "ready";

function explainCacheKey(snapshot: AnalysisSnapshot, mode: ExplanationMode): string {
  return `${mode}|${snapshot.pageUrl}|${snapshot.lastChecked}|${snapshot.threatScore}`;
}

function explainAudienceForMode(mode: ExplanationMode): "plain" | "technical" | null {
  if (mode === "plain") {
    return "plain";
  }
  if (mode === "technical") {
    return "technical";
  }
  return null;
}

function ManualScanPrompt({ tabPreview, busy, onScan }: { tabPreview: TabPreview | null; busy: boolean; onScan: () => void }) {
  return (
    <div className="space-y-3 px-4 py-4">
      {tabPreview ? (
        <div className="space-y-1">
          <p className="line-clamp-2 font-serif text-sm font-medium leading-snug text-ink" title={tabPreview.title || undefined}>
            {tabPreview.title.trim() || "Untitled tab"}
          </p>
          <p className="line-clamp-2 break-all font-sans text-[11px] leading-snug text-ink-muted" title={tabPreview.url}>
            {tabPreview.url}
          </p>
        </div>
      ) : null}
      <p className="font-sans text-xs leading-snug text-ink-muted">Manual scan is on. Press the button below to analyze this tab.</p>
      <button
        type="button"
        disabled={busy}
        onClick={onScan}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-2 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {busy ? "Scanning…" : "Scan this page"}
      </button>
    </div>
  );
}

export function PopupApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>("off");
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [tabPreview, setTabPreview] = useState<TabPreview | null>(null);
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [onPersonalList, setOnPersonalList] = useState(false);
  const [onWhitelist, setOnWhitelist] = useState(false);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [whitelistBusy, setWhitelistBusy] = useState(false);
  const [personalHint, setPersonalHint] = useState<string | null>(null);
  const [whitelistHint, setWhitelistHint] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainForKey, setExplainForKey] = useState<string | null>(null);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);

  const clearExplain = useCallback(() => {
    setExplainBusy(false);
    setExplainText(null);
    setExplainError(null);
    setExplainForKey(null);
  }, []);

  const resetLayerExpansion = useCallback(() => {
    setExpandedLayerId(null);
  }, []);

  const runScan = useCallback(async () => {
    setScanPhase("loading");
    clearExplain();
    resetLayerExpansion();
    try {
      const data = await loadActiveTabPhishingAnalysis();
      setSnapshot(data);
      setScanPhase("ready");
    } catch {
      setSnapshot(null);
      const preview = await loadActiveTabPreview();
      setTabPreview(preview);
      setScanPhase("idle");
    }
  }, [clearExplain, resetLayerExpansion]);

  useEffect(() => {
    let stillMounted = true;

    async function init() {
      const settings = await getUserSettings();
      if (!stillMounted) {
        return;
      }
      setScanMode(settings.scanMode);
      setExplanationMode(settings.explanationMode);
      if (settings.scanMode === "auto_when_ready") {
        setScanPhase("loading");
        try {
          const data = await loadActiveTabPhishingAnalysis();
          if (stillMounted) {
            setSnapshot(data);
            setScanPhase("ready");
          }
        } catch {
          if (stillMounted) {
            setSnapshot(null);
            const preview = await loadActiveTabPreview();
            setTabPreview(preview);
            setScanPhase("idle");
          }
        }
        return;
      }
      const preview = await loadActiveTabPreview();
      if (stillMounted) {
        setTabPreview(preview);
        setScanPhase("idle");
      }
    }

    void init();

    return () => {
      stillMounted = false;
    };
  }, []);

  useEffect(() => {
    function onStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
      if (areaName !== "local" || !changes.userSettings) {
        return;
      }
      const raw = changes.userSettings.newValue;
      if (raw === undefined || raw === null || typeof raw !== "object") {
        return;
      }
      const next = raw as {
        scanMode?: ScanMode;
        explanationMode?: ExplanationMode;
        explainEnabled?: boolean;
      };
      const nextMode = next.scanMode;
      if (nextMode === "manual" || nextMode === "auto_when_ready") {
        setScanMode(nextMode);
        if (nextMode === "auto_when_ready") {
          void runScan();
        } else {
          setSnapshot(null);
          setScanPhase("idle");
          void loadActiveTabPreview().then((preview) => {
            setTabPreview(preview);
          });
        }
      }
      if (
        next.explanationMode === "off" ||
        next.explanationMode === "technical" ||
        next.explanationMode === "plain"
      ) {
        setExplanationMode(next.explanationMode);
        clearExplain();
      } else if (typeof next.explainEnabled === "boolean") {
        const migrated = next.explainEnabled ? "plain" : "off";
        setExplanationMode(migrated);
        clearExplain();
      }
    }
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [runScan, clearExplain]);

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

  useEffect(() => {
    if (snapshot === null) {
      return;
    }
    setExpandedLayerId(null);
    const key = explainCacheKey(snapshot, explanationMode);
    if (explainForKey !== null && explainForKey !== key) {
      setExplainText(null);
      setExplainForKey(null);
      setExplainError(null);
    }
  }, [snapshot, explainForKey, explanationMode]);

  async function handleExplain(snapshotForExplain: AnalysisSnapshot) {
    const audience = explainAudienceForMode(explanationMode);
    if (audience === null) {
      return;
    }

    const cacheKey = explainCacheKey(snapshotForExplain, explanationMode);
    if (explainForKey === cacheKey && explainText !== null) {
      return;
    }

    setExplainBusy(true);
    setExplainError(null);

    try {
      const payload = buildExplainPayload(snapshotForExplain, audience);
      const response = await fetchExplain(getApiBaseUrl(), payload);
      setExplainText(response.explanation);
      setExplainForKey(cacheKey);
    } catch {
      setExplainText(null);
      setExplainForKey(null);
      setExplainError("Could not generate an explanation. Is the backend running?");
    } finally {
      setExplainBusy(false);
    }
  }

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

  const shellProps = {
    showSettings,
    onOpenSettings: () => {
      setShowSettings(true);
    },
    onCloseSettings: () => {
      setShowSettings(false);
    },
  };

  if (scanPhase === "loading") {
    return (
      <PopupSlideShell {...shellProps}>
        <div className="flex items-center gap-3 bg-surface-elevated/50 px-4 py-3">
          <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
          <p className="font-sans text-sm text-ink-muted">Checking this tab…</p>
        </div>
      </PopupSlideShell>
    );
  }

  if (scanMode === "manual" && scanPhase === "idle" && snapshot === null) {
    return (
      <PopupSlideShell {...shellProps}>
        <ManualScanPrompt
          tabPreview={tabPreview}
          busy={false}
          onScan={() => {
            void runScan();
          }}
        />
      </PopupSlideShell>
    );
  }

  if (snapshot === null) {
    return (
      <PopupSlideShell {...shellProps}>
        <div className="flex items-center gap-3 bg-surface-elevated/50 px-4 py-3">
          <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
          <p className="font-sans text-sm text-ink-muted">Could not load analysis.</p>
        </div>
      </PopupSlideShell>
    );
  }

  const verdict = verdictFromScore(snapshot.threatScore);
  const pageOk = !isRestrictedPageUrl(snapshot.pageUrl);
  const showPersonalBlockSection = pageOk && !onPersonalList && !onWhitelist;
  const showTrustSection = pageOk && !onWhitelist && !onPersonalList;
  const showRemoveTrustSection = pageOk && onWhitelist;
  const personalBlockDisabled = personalBusy;
  const whitelistDisabled = whitelistBusy;
  const visibleLayers = layersForDisplay(snapshot.layers, explanationMode);
  const layerCompact = explanationMode === "plain" || explanationMode === "technical";
  const layerExpandable = explanationMode === "technical";
  const showExplainSection = explanationMode === "plain" || explanationMode === "technical";
  const findingsSectionTitle =
    explanationMode === "technical" ? "Findings" : explanationMode === "plain" ? "Score breakdown" : "";

  function toggleLayerExpanded(layerId: string) {
    setExpandedLayerId((current) => (current === layerId ? null : layerId));
  }

  return (
    <PopupSlideShell {...shellProps}>
      <div className="space-y-2 px-4 py-2.5">
        {scanMode === "manual" ? (
          <button
            type="button"
            onClick={() => {
              void runScan();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-1.5 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ScanLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Scan again
          </button>
        ) : null}

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

        {explanationMode !== "off" ? (
          <div className="space-y-2 border-t border-surface-border pt-2">
            {findingsSectionTitle !== "" ? (
              <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                {findingsSectionTitle}
              </p>
            ) : null}
            {visibleLayers.length === 0 ? (
              <p className="font-sans text-xs leading-snug text-ink-muted">
                No layer contributed points to the score.
              </p>
            ) : (
              visibleLayers.map((layer) => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  compact={layerExpandable ? expandedLayerId !== layer.id : layerCompact}
                  expandable={layerExpandable}
                  expanded={expandedLayerId === layer.id}
                  onToggle={
                    layerExpandable
                      ? () => {
                          toggleLayerExpanded(layer.id);
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {showExplainSection ? (
          <div className="space-y-2 border-t border-surface-border pt-2">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              {explanationMode === "plain" ? "Plain English" : "Summary"}
            </p>
            <button
              type="button"
              disabled={explainBusy}
              onClick={() => {
                void handleExplain(snapshot);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-1.5 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              {explanationMode === "plain" ? (
                <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              ) : (
                <Layers className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              )}
              {explainBusy
                ? "Generating…"
                : explanationMode === "plain"
                  ? "Explain in plain English"
                  : "Summarize findings"}
            </button>
            {explainError ? (
              <p className="font-sans text-[11px] leading-snug text-accent-danger">{explainError}</p>
            ) : null}
            {explainText ? (
              <p className="rounded-md border border-surface-border bg-surface-elevated/60 px-3 py-2 font-sans text-xs leading-relaxed text-ink-muted">
                {explainText}
              </p>
            ) : null}
          </div>
        ) : null}

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
    </PopupSlideShell>
  );
}
