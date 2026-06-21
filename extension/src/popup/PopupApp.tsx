import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, ChevronRight, Layers, MessageCircle, ScanLine, Shield, ShieldCheck } from "lucide-react";
import { loadActiveTabPhishingAnalysis } from "../layers/analysis/loadActiveTabAnalysis";
import {
  isTabScanCacheStorageKey,
  loadActiveTabScanState,
  requestBackgroundRescan,
  snapshotFromScanState,
} from "../layers/analysis/loadActiveTabScanState";
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

function verdictPillClass(verdict: Verdict): string {
  if (verdict === "safe") {
    return "border-accent-safe/40 bg-accent-safe/10 text-accent-safe";
  }
  if (verdict === "caution") {
    return "border-accent-warn/40 bg-accent-warn/10 text-accent-warn";
  }
  return "border-accent-danger/40 bg-accent-danger/10 text-accent-danger";
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "safe") {
    return <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />;
  }
  return <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />;
}

function VerdictRiskPanel({
  verdict,
  score,
  lastChecked,
}: {
  verdict: Verdict;
  score: number;
  lastChecked: string;
}) {
  const [showScore, setShowScore] = useState(false);
  const hue = scoreHue(score);
  let pct = score;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  return (
    <div className="space-y-2 border-t border-surface-border pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={showScore}
          onClick={() => {
            setShowScore((open) => !open);
          }}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-xs transition hover:brightness-110 ${verdictPillClass(verdict)}`}
        >
          <VerdictIcon verdict={verdict} />
          <span className="shrink-0 font-semibold">{verdictLabel(verdict)}</span>
          <span className="truncate font-normal text-ink-faint">
            {showScore ? "tap to hide" : "tap for details"}
          </span>
        </button>
        <span className="shrink-0 font-sans text-[10px] text-ink-faint">{lastChecked}</span>
      </div>

      {showScore ? (
        <div className="rounded-lg border border-surface-border bg-surface-elevated/80 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-sans text-xs text-ink-muted">Risk score</span>
            <span className="font-sans text-sm font-semibold tabular-nums" style={{ color: hue }}>
              {score} / 100
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-border" aria-hidden>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hue }} />
          </div>
        </div>
      ) : null}
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

const SCAN_TIMEOUT_MS = 60_000;
const INIT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(message));
      }, ms);
    }),
  ]);
}

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

function ManualScanPrompt({
  tabPreview,
  busy,
  scanHint,
  onScan,
}: {
  tabPreview: TabPreview | null;
  busy: boolean;
  scanHint: string | null;
  onScan: () => void;
}) {
  return (
    <div className="space-y-3 px-4 py-2.5">
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
      <button
        type="button"
        disabled={busy}
        onClick={onScan}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border bg-surface-elevated/80 px-3 py-2 font-sans text-xs font-semibold text-ink transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {busy ? "Scanning…" : "Scan this page"}
      </button>
      {scanHint ? <p className="font-sans text-[11px] leading-snug text-accent-danger">{scanHint}</p> : null}
    </div>
  );
}

function TrustedSitePanel({
  busy,
  hint,
  onRemove,
}: {
  busy: boolean;
  hint: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 px-4 py-2.5">
      <div className="flex items-start gap-2.5 rounded-lg border border-accent-safe/40 bg-accent-safe/10 px-3 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-safe" strokeWidth={2} aria-hidden />
        <p className="font-sans text-sm leading-snug text-ink-muted">
          This site is on your trusted list. The extension skips scanning for this host.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-elevated/80 px-3 py-2.5 font-sans text-sm font-medium text-ink-muted transition hover:bg-surface-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
        {busy ? "Removing…" : "Remove from trusted list"}
      </button>
      {hint ? <p className="font-sans text-[11px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}

async function getActiveTabUrl(): Promise<string> {
  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabList[0];
  if (tab && tab.url) {
    return tab.url.trim();
  }
  return "";
}

export function PopupApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>("off");
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [tabPreview, setTabPreview] = useState<TabPreview | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [onPersonalList, setOnPersonalList] = useState(false);
  const [onWhitelist, setOnWhitelist] = useState(false);
  const [trustedSite, setTrustedSite] = useState(false);
  const [listCheckDone, setListCheckDone] = useState(false);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [whitelistBusy, setWhitelistBusy] = useState(false);
  const [personalHint, setPersonalHint] = useState<string | null>(null);
  const [whitelistHint, setWhitelistHint] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainForKey, setExplainForKey] = useState<string | null>(null);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);

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
    clearExplain();
    resetLayerExpansion();
    setScanHint(null);
    setScanPhase("loading");

    if (scanMode === "auto_when_ready" && activeTabId !== null) {
      try {
        await requestBackgroundRescan(activeTabId);
      } catch {
        setSnapshot(null);
        setScanPhase("idle");
      }
      return;
    }

    try {
      const data = await withTimeout(
        loadActiveTabPhishingAnalysis(),
        SCAN_TIMEOUT_MS,
        "Scan timed out. Is the backend running on port 8000?",
      );
      setSnapshot(data);
      setScanPhase("ready");
    } catch {
      setSnapshot(null);
      const preview = await loadActiveTabPreview();
      setTabPreview(preview);
      setScanHint("Scan failed or timed out. Check that the backend is running, then try again.");
      setScanPhase("idle");
    }
  }, [activeTabId, clearExplain, resetLayerExpansion, scanMode]);

  const applyAutoScanState = useCallback((state: Awaited<ReturnType<typeof loadActiveTabScanState>>) => {
    setTabPreview(state.preview);
    setActiveTabId(state.tabId);
    const cached = snapshotFromScanState(state);
    if (cached !== null) {
      setSnapshot(cached);
      setScanPhase("ready");
      return;
    }
    if (state.cacheMatchesTab && state.cache?.status === "scanning") {
      setSnapshot(null);
      setScanPhase("loading");
      return;
    }
    if (state.cacheMatchesTab && state.cache?.status === "error") {
      setSnapshot(null);
      setScanPhase("idle");
      return;
    }
    setSnapshot(null);
    if (state.tabId !== null) {
      setScanPhase("loading");
      void requestBackgroundRescan(state.tabId);
    } else {
      setScanPhase("idle");
    }
  }, []);

  useEffect(() => {
    let stillMounted = true;

    async function init() {
      try {
        await withTimeout(
          (async () => {
            const settings = await getUserSettings();
            if (!stillMounted) {
              return;
            }
            setScanMode(settings.scanMode);
            setExplanationMode(settings.explanationMode);

            const preview = await loadActiveTabPreview();
            if (!stillMounted) {
              return;
            }
            setTabPreview(preview);

            let trusted = false;
            if (preview.url !== "" && !isRestrictedPageUrl(preview.url)) {
              try {
                trusted = await isUrlWhitelisted(preview.url);
              } catch {
                trusted = false;
              }
            }
            if (!stillMounted) {
              return;
            }
            setTrustedSite(trusted);
            setOnWhitelist(trusted);
            setListCheckDone(true);

            if (trusted) {
              setSnapshot(null);
              setScanPhase("ready");
              return;
            }

            if (settings.scanMode === "auto_when_ready") {
              const scanState = await loadActiveTabScanState();
              if (stillMounted) {
                applyAutoScanState(scanState);
              }
              return;
            }
            setScanPhase("idle");
          })(),
          INIT_TIMEOUT_MS,
          "Popup init timed out",
        );
      } catch {
        if (!stillMounted) {
          return;
        }
        setListCheckDone(true);
        setScanPhase("idle");
        setScanHint("Could not initialize. Reload the extension popup and try again.");
      }
    }

    void init();

    return () => {
      stillMounted = false;
    };
  }, [applyAutoScanState]);

  useEffect(() => {
    if (scanMode !== "auto_when_ready" || activeTabId === null) {
      return;
    }

    function onSessionStorageChange(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) {
      if (areaName !== "session") {
        return;
      }
      const cacheKey = `afsTabScan_${activeTabId}`;
      if (changes[cacheKey] === undefined && !Object.keys(changes).some(isTabScanCacheStorageKey)) {
        return;
      }
      void loadActiveTabScanState().then((state) => {
        if (state.tabId === activeTabId) {
          applyAutoScanState(state);
        }
      });
    }

    chrome.storage.onChanged.addListener(onSessionStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(onSessionStorageChange);
    };
  }, [activeTabId, applyAutoScanState, scanMode]);

  useEffect(() => {
    if (scanMode !== "auto_when_ready" || scanPhase !== "loading" || activeTabId === null) {
      return;
    }

    const poll = window.setInterval(() => {
      void loadActiveTabScanState().then((state) => {
        if (state.tabId === activeTabId) {
          applyAutoScanState(state);
        }
      });
    }, 1500);

    return () => {
      window.clearInterval(poll);
    };
  }, [activeTabId, applyAutoScanState, scanMode, scanPhase]);

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
          void loadActiveTabScanState().then(applyAutoScanState);
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
  }, [applyAutoScanState, clearExplain]);

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
        setTrustedSite(true);
        setSnapshot(null);
        setScanPhase("ready");
        return;
      }
      const ok = await addWhitelist(url);
      if (!ok) {
        setWhitelistHint("Could not add (maybe on blocklist).");
        return;
      }
      setOnWhitelist(true);
      setTrustedSite(true);
      setWhitelistHint("Saved. This host is on your trusted list.");
      setSnapshot(null);
      setScanPhase("ready");
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
      const url = await getActiveTabUrl();
      if (url === "" || isRestrictedPageUrl(url)) {
        return;
      }
      await removeWhitelist(url);
      setOnWhitelist(false);
      setTrustedSite(false);
      setWhitelistHint("Removed from trusted list.");
      clearExplain();
      resetLayerExpansion();
      if (scanMode === "auto_when_ready" && activeTabId !== null) {
        void requestBackgroundRescan(activeTabId);
      } else {
        setSnapshot(null);
        setScanPhase("idle");
      }
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

  if (!listCheckDone) {
    return (
      <PopupSlideShell {...shellProps}>
        <div className="flex items-center gap-3 bg-surface-elevated/50 px-4 py-3">
          <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
          <p className="font-sans text-sm text-ink-muted">Checking this tab…</p>
        </div>
      </PopupSlideShell>
    );
  }

  if (trustedSite) {
    return (
      <PopupSlideShell {...shellProps}>
        <TrustedSitePanel
          busy={whitelistBusy}
          hint={whitelistHint}
          onRemove={() => {
            void handleRemoveTrustCurrentSite();
          }}
        />
      </PopupSlideShell>
    );
  }

  if (scanPhase === "loading") {
    return (
      <PopupSlideShell {...shellProps}>
        <div className="flex items-center gap-3 bg-surface-elevated/50 px-4 py-3">
          <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
          <p className="font-sans text-sm text-ink-muted">
            {scanMode === "auto_when_ready" ? "Scanning in background…" : "Checking this tab…"}
          </p>
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
          scanHint={scanHint}
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
        <div className="space-y-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
            <p className="font-sans text-sm text-ink-muted">Could not load analysis.</p>
          </div>
          {scanHint ? (
            <p className="font-sans text-[11px] leading-snug text-accent-danger">{scanHint}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void runScan();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-elevated/80 px-3 py-2.5 font-sans text-sm font-medium text-ink-muted transition hover:bg-surface-elevated hover:text-ink"
          >
            <ScanLine className="h-4 w-4 shrink-0" strokeWidth={2} />
            Scan again
          </button>
        </div>
      </PopupSlideShell>
    );
  }

  const verdict = verdictFromScore(snapshot.threatScore);
  const pageOk = !isRestrictedPageUrl(snapshot.pageUrl);
  const showPersonalBlockSection = pageOk && !onPersonalList && !onWhitelist;
  const showTrustSection = pageOk && !onWhitelist && !onPersonalList;
  const personalBlockDisabled = personalBusy;
  const whitelistDisabled = whitelistBusy;
  const visibleLayers = layersForDisplay(snapshot.layers, explanationMode);
  const layerExpandable = explanationMode === "technical";
  const showFindingsSection = explanationMode === "technical";
  const showExplainSection = explanationMode === "plain" || explanationMode === "technical";

  const showActionBar =
    scanMode === "manual" || scanMode === "auto_when_ready" || showTrustSection || showPersonalBlockSection;

  function toggleLayerExpanded(layerId: string) {
    setExpandedLayerId((current) => (current === layerId ? null : layerId));
  }

  return (
    <PopupSlideShell {...shellProps}>
      <div className="space-y-2 px-4 py-2.5">
        <div className="space-y-1">
          <p className="line-clamp-2 font-serif text-sm font-medium leading-snug text-ink" title={snapshot.pageTitle || undefined}>
            {snapshot.pageTitle?.trim() || "Untitled tab"}
          </p>
          <p className="line-clamp-2 break-all font-sans text-[11px] leading-snug text-ink-muted" title={snapshot.pageUrl}>
            {snapshot.pageUrl}
          </p>
        </div>

        <VerdictRiskPanel
          key={`${snapshot.pageUrl}|${snapshot.lastChecked}|${snapshot.threatScore}`}
          verdict={verdict}
          score={snapshot.threatScore}
          lastChecked={snapshot.lastChecked}
        />

        {showFindingsSection ? (
          <div className="space-y-2 border-t border-surface-border pt-2">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">Findings</p>
            {visibleLayers.length === 0 ? (
              <p className="font-sans text-xs leading-snug text-ink-muted">
                No layer contributed points to the score.
              </p>
            ) : (
              visibleLayers.map((layer) => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  compact={expandedLayerId !== layer.id}
                  expandable={layerExpandable}
                  expanded={expandedLayerId === layer.id}
                  onToggle={() => {
                    toggleLayerExpanded(layer.id);
                  }}
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

        {showActionBar ? (
          <div className="space-y-2 border-t border-surface-border pt-2">
            {showPersonalBlockSection || showTrustSection ? (
              <div
                className={
                  showPersonalBlockSection && showTrustSection ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"
                }
              >
                {showPersonalBlockSection ? (
                  <button
                    type="button"
                    disabled={personalBlockDisabled}
                    onClick={() => {
                      void handleAddCurrentSiteToPersonalList();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-accent-danger/50 bg-accent-danger/10 px-3 py-2.5 font-sans text-sm font-medium text-accent-danger transition hover:bg-accent-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4 shrink-0" strokeWidth={2} />
                    Block site
                  </button>
                ) : null}

                {showTrustSection ? (
                  <button
                    type="button"
                    disabled={whitelistDisabled}
                    onClick={() => {
                      void handleTrustCurrentSite();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-elevated/80 px-3 py-2.5 font-sans text-sm font-medium text-ink-muted transition hover:bg-surface-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
                    Trust site
                  </button>
                ) : null}
              </div>
            ) : null}

            {(scanMode === "manual" || scanMode === "auto_when_ready") ? (
              <button
                type="button"
                onClick={() => {
                  void runScan();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-elevated/80 px-3 py-2.5 font-sans text-sm font-medium text-ink-muted transition hover:bg-surface-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ScanLine className="h-4 w-4 shrink-0" strokeWidth={2} />
                Scan again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </PopupSlideShell>
  );
}
