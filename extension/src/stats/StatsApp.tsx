import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  fetchScanDetail,
  fetchScanList,
  fetchStatsSummary,
  statsExportCsvUrl,
  type ScanDetail,
  type ScanSummary,
  type StatsPeriod,
  type StatsSummary,
} from "../layers/stats/api";
import type { Verdict } from "../layers/types";
import { verdictLabel } from "../layers/verdict";
import { listWhitelistHosts, removeWhitelist } from "../layers/whitelist/storage";
import { listPersonalBlocklistHosts, removePersonalBlock } from "../user-lists/personalBlocklist";

type TabId = "overview" | "history" | "lists";

const PERIOD_OPTIONS: Array<{ id: StatsPeriod; label: string }> = [
  { id: "day", label: "Last 24 hours" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "year", label: "Last year" },
];

const VERDICT_OPTIONS: Array<{ id: Verdict | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "high_risk", label: "High risk" },
  { id: "caution", label: "Medium risk" },
  { id: "safe", label: "Low risk" },
];

const PAGE_SIZE = 20;

function verdictBadgeClass(verdict: Verdict): string {
  if (verdict === "safe") {
    return "border-emerald-900/40 bg-emerald-950/30 text-accent-safe";
  }
  if (verdict === "caution") {
    return "border-amber-900/30 bg-amber-950/20 text-accent-warn";
  }
  return "border-red-900/40 bg-red-950/35 text-red-300";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

function periodLabel(period: StatsPeriod): string {
  for (const option of PERIOD_OPTIONS) {
    if (option.id === period) {
      return option.label;
    }
  }
  return period;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" | "safe" | "neutral" }) {
  let valueClass = "text-ink";
  if (tone === "danger") valueClass = "text-red-300";
  if (tone === "warn") valueClass = "text-accent-warn";
  if (tone === "safe") valueClass = "text-accent-safe";

  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated/80 px-4 py-3">
      <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-sans text-sm transition ${
        active
          ? "bg-surface-elevated text-ink border border-surface-border"
          : "text-ink-muted hover:text-ink hover:bg-surface-elevated/60"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewTab({ period }: { period: StatsPeriod }) {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStatsSummary(period);
      setSummary(data);
    } catch (e) {
      setSummary(null);
      setError(e instanceof Error ? e.message : "Could not load stats");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 font-sans text-xs text-ink-muted hover:text-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        <a
          href={statsExportCsvUrl(period)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 font-sans text-xs text-ink-muted hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      {loading ? <p className="font-sans text-sm text-ink-muted">Loading…</p> : null}
      {error ? (
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 font-sans text-sm text-red-300">
          {error}
          {error.includes("database") || error.includes("503") ? (
            <p className="mt-2 text-xs text-ink-muted">Make sure PostgreSQL and the backend are running (`/health` → database ok).</p>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={`Total scans (${periodLabel(summary.period)})`} value={summary.total_scans} />
            <StatCard label="High risk" value={summary.by_verdict.high_risk} tone="danger" />
            <StatCard label="Medium risk" value={summary.by_verdict.caution} tone="warn" />
            <StatCard label="Low risk" value={summary.by_verdict.safe} tone="safe" />
          </div>

          <div className="rounded-lg border border-surface-border bg-surface-elevated/60 px-4 py-3">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-ink-faint">Top scanned hosts</p>
            {summary.top_hosts.length === 0 ? (
              <p className="mt-2 font-sans text-sm text-ink-muted">No scans in the selected period.</p>
            ) : (
              <ul className="mt-2 divide-y divide-surface-border">
                {summary.top_hosts.map((item) => (
                  <li key={item.page_host} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate font-sans text-sm text-ink">{item.page_host}</span>
                    <span className="shrink-0 font-sans text-xs tabular-nums text-ink-muted">{item.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="font-sans text-xs text-ink-faint">Since {formatWhen(summary.since)}</p>
        </>
      ) : null}
    </div>
  );
}

function ScanDetailPanel({ scanId, onClose }: { scanId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void fetchScanDetail(scanId)
      .then((data) => {
        if (mounted) {
          setDetail(data);
        }
      })
      .catch((e) => {
        if (mounted) {
          setDetail(null);
          setError(e instanceof Error ? e.message : "Could not load scan");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [scanId]);

  return (
    <div className="rounded-lg border border-surface-border bg-surface-paper p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-ink">Scan detail #{scanId}</h3>
        <button type="button" onClick={onClose} className="font-sans text-xs text-ink-muted hover:text-ink">
          Close
        </button>
      </div>
      {loading ? <p className="font-sans text-sm text-ink-muted">Loading…</p> : null}
      {error ? <p className="font-sans text-sm text-red-300">{error}</p> : null}
      {detail ? (
        <div className="space-y-3">
          <div>
            <p className="font-serif text-sm font-semibold text-ink">{detail.page_title || detail.page_host}</p>
            <p className="mt-0.5 truncate font-sans text-xs text-ink-muted">{detail.page_url}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 font-sans text-xs ${verdictBadgeClass(detail.verdict)}`}>
                {verdictLabel(detail.verdict)}
              </span>
              <span className="font-sans text-xs text-ink-muted">{detail.threat_score} / 100</span>
              <span className="font-sans text-xs text-ink-faint">{formatWhen(detail.scanned_at)}</span>
            </div>
          </div>
          {detail.rule_hits.length > 0 ? (
            <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
              {detail.rule_hits.map((hit, index) => (
                <li key={`${hit.layer_id}-${hit.rule}-${index}`} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-medium text-ink">
                        {hit.layer_id} · {hit.rule}
                      </p>
                      <p className="mt-0.5 font-sans text-xs leading-snug text-ink-muted">{hit.detail}</p>
                    </div>
                    <span className="shrink-0 font-sans text-xs font-medium text-accent-danger">+{hit.points}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-sm text-ink-muted">No rules recorded.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function HistoryTab({ period }: { period: StatsPeriod }) {
  const [items, setItems] = useState<ScanSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hostFilter, setHostFilter] = useState("");
  const [hostQuery, setHostQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScanList({
        limit: PAGE_SIZE,
        offset,
        period,
        host: hostQuery || undefined,
        verdict: verdictFilter === "all" ? undefined : verdictFilter,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }, [hostQuery, offset, period, verdictFilter]);

  useEffect(() => {
    setOffset(0);
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={hostFilter}
          onChange={(e) => {
            setHostFilter(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setOffset(0);
              setHostQuery(hostFilter.trim());
            }
          }}
          placeholder="Filter by host (e.g. emag)"
          className="min-w-[200px] flex-1 rounded-md border border-surface-border bg-surface-elevated px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint"
        />
        <select
          value={verdictFilter}
          onChange={(e) => {
            setOffset(0);
            setVerdictFilter(e.target.value as Verdict | "all");
          }}
          className="rounded-md border border-surface-border bg-surface-elevated px-3 py-2 font-sans text-sm text-ink"
        >
          {VERDICT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            setHostQuery(hostFilter.trim());
          }}
          className="rounded-md border border-surface-border px-3 py-2 font-sans text-sm text-ink-muted hover:text-ink"
        >
          Search
        </button>
      </div>

      {loading ? <p className="font-sans text-sm text-ink-muted">Loading…</p> : null}
      {error ? <p className="font-sans text-sm text-red-300">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <p className="font-sans text-sm text-ink-muted">No scans found.</p>
      ) : null}

      <ul className="divide-y divide-surface-border rounded-lg border border-surface-border bg-surface-elevated/40">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(item.id);
              }}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-surface-elevated/80"
            >
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-medium text-ink">{item.page_host}</p>
                <p className="truncate font-sans text-xs text-ink-muted">{item.page_title || item.page_url}</p>
                <p className="mt-1 font-sans text-[10px] text-ink-faint">{formatWhen(item.scanned_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`inline-block rounded-full border px-2 py-0.5 font-sans text-[10px] ${verdictBadgeClass(item.verdict)}`}>
                  {verdictLabel(item.verdict)}
                </span>
                <p className="mt-1 font-sans text-xs tabular-nums text-ink-muted">{item.threat_score}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - PAGE_SIZE));
            }}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border px-3 py-1.5 font-sans text-xs text-ink-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="font-sans text-xs text-ink-muted">
            Page {page} / {totalPages} ({total} total)
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => {
              setOffset(offset + PAGE_SIZE);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border px-3 py-1.5 font-sans text-xs text-ink-muted disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {selectedId !== null ? (
        <ScanDetailPanel
          scanId={selectedId}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ListsTab() {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [allowed, blocked] = await Promise.all([listWhitelistHosts(), listPersonalBlocklistHosts()]);
    setWhitelist(allowed);
    setBlocklist(blocked);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleRemoveWhitelist(host: string) {
    await removeWhitelist(host);
    await reload();
  }

  async function handleRemoveBlock(host: string) {
    await removePersonalBlock(host);
    await reload();
  }

  function HostList({
    title,
    hosts,
    emptyLabel,
    icon,
    onRemove,
  }: {
    title: string;
    hosts: string[];
    emptyLabel: string;
    icon: ReactNode;
    onRemove: (host: string) => void;
  }) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-elevated/40">
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          {icon}
          <h3 className="font-serif text-sm font-semibold text-ink">{title}</h3>
          <span className="ml-auto font-sans text-xs text-ink-faint">{hosts.length}</span>
        </div>
        {hosts.length === 0 ? (
          <p className="px-4 py-3 font-sans text-sm text-ink-muted">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {hosts.map((host) => (
              <li key={host} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate font-sans text-sm text-ink">{host}</span>
                <button
                  type="button"
                  onClick={() => {
                    void onRemove(host);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border px-2 py-1 font-sans text-[10px] text-ink-muted hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="font-sans text-sm text-ink-muted">Loading…</p> : null}
      <p className="font-sans text-xs text-ink-muted">
        Personal lists are stored locally in the extension (chrome.storage), not in PostgreSQL.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <HostList
          title="Whitelist (Trust site)"
          hosts={whitelist}
          emptyLabel="No hosts on the whitelist."
          icon={<ShieldCheck className="h-4 w-4 text-accent-safe" strokeWidth={1.5} />}
          onRemove={(host) => {
            void handleRemoveWhitelist(host);
          }}
        />
        <HostList
          title="Personal blocklist"
          hosts={blocklist}
          emptyLabel="No personally blocked hosts."
          icon={<Ban className="h-4 w-4 text-accent-danger" strokeWidth={1.5} />}
          onRemove={(host) => {
            void handleRemoveBlock(host);
          }}
        />
      </div>
    </div>
  );
}

export function StatsApp() {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<StatsPeriod>("week");

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-surface-border bg-surface-elevated/80">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Shield className="h-6 w-6 text-accent-line" strokeWidth={1.5} />
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight">Anti-Phishing Shield</h1>
            <p className="font-sans text-xs text-ink-muted">Scan statistics and history</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            History
          </TabButton>
          <TabButton active={tab === "lists"} onClick={() => setTab("lists")}>
            Lists
          </TabButton>
        </div>

        {tab === "overview" || tab === "history" ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                className={`rounded-full border px-3 py-1 font-sans text-xs transition ${
                  period === option.id
                    ? "border-accent-line/50 bg-surface-elevated text-ink"
                    : "border-surface-border text-ink-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {tab === "overview" ? <OverviewTab period={period} /> : null}
        {tab === "history" ? <HistoryTab period={period} /> : null}
        {tab === "lists" ? <ListsTab /> : null}
      </main>
    </div>
  );
}
