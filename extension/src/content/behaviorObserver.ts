import { BEHAVIOR_OBSERVE_WINDOW_MS } from "../layers/behavioral/constants";
import { MSG_STORE_REDIRECT_EVIDENCE } from "../layers/behavioral/redirectEvidence";
import { matchBrandsFromPage } from "../layers/page-template/brandMatch";
import { countPasswordLikeInputs } from "../layers/page-template/passwordFieldDetect";
import { safeOrigin } from "../layers/page-template/urlSanitize";
import type { BehaviorDiff } from "../layers/behavioral/types";
import { MSG_STORE_BEHAVIOR_DIFF, type StoredBehaviorDiff } from "../layers/behavioral/behaviorDiffStorage";
import { getClipboardShellWritesSnapshot, installClickfixClipboardCapture } from "./clickfixClipboardCapture";
import { getJsExfilAttemptsSnapshot, installJsExfilCapture } from "./jsExfilCapture";

const DEBOUNCE_MS = 400;
const LOCATION_POLL_MS = 250;
const GUARD_KEY = "__afs_behavior_observer_active__";

type BehaviorSnapshot = {
  formCount: number;
  passwordCount: number;
  actionOrigin: string;
  brandHits: string[];
};

type RedirectTracker = {
  startHost: string;
  endHost: string;
  redirectMs: number;
};

function captureSnapshot(pageHref: string, brandIds: string[]): BehaviorSnapshot {
  let formCount = 0;
  let passwordCount = 0;
  let actionOrigin = "";
  let brandHits: string[] = [];

  try {
    formCount = document.querySelectorAll("form").length;
  } catch {
    formCount = 0;
  }

  try {
    passwordCount = countPasswordLikeInputs(document);
  } catch {
    passwordCount = 0;
  }

  try {
    const form = document.querySelector("form");
    if (form instanceof HTMLFormElement) {
      actionOrigin = safeOrigin(form.getAttribute("action") ?? "", pageHref);
    }
  } catch {
    actionOrigin = "";
  }

  try {
    const brands = matchBrandsFromPage(
      brandIds,
      () => document.title,
      () => {
        const texts: string[] = [];
        const h1 = document.querySelector("h1");
        if (h1 !== null) {
          texts.push(h1.textContent ?? "");
        }
        return texts;
      },
      () => [],
    );
    brandHits = brands.brand_hits;
  } catch {
    brandHits = [];
  }

  return { formCount, passwordCount, actionOrigin, brandHits };
}

function brandHitsIncreased(before: string[], after: string[]): boolean {
  for (let i = 0; i < after.length; i++) {
    if (!before.includes(after[i])) {
      return true;
    }
  }
  return false;
}

function buildDiff(
  before: BehaviorSnapshot,
  after: BehaviorSnapshot,
  observedMs: number,
  redirect: RedirectTracker,
): BehaviorDiff {
  const formsAppeared =
    (before.formCount === 0 && after.formCount > 0) || after.formCount > before.formCount;

  return {
    forms_appeared: formsAppeared,
    password_inputs_increased: after.passwordCount > before.passwordCount,
    action_origin_changed:
      before.actionOrigin !== after.actionOrigin &&
      (before.actionOrigin !== "" || after.actionOrigin !== ""),
    brand_hits_increased: brandHitsIncreased(before.brandHits, after.brandHits),
    observed_ms: observedMs,
    redirect_ms: redirect.redirectMs,
    start_host: redirect.startHost,
    end_host: redirect.endHost,
    js_exfil_attempts: getJsExfilAttemptsSnapshot(),
    clipboard_shell_writes: getClipboardShellWritesSnapshot(),
  };
}

async function saveBehaviorDiff(tabId: number, pageUrl: string, diff: BehaviorDiff, status: StoredBehaviorDiff["status"]): Promise<void> {
  const record: StoredBehaviorDiff = {
    pageUrl,
    diff,
    status,
    updatedAt: Date.now(),
  };

  try {
    await chrome.runtime.sendMessage({
      type: MSG_STORE_BEHAVIOR_DIFF,
      tabId,
      record,
    });
  } catch {
    // ignore
  }
}

async function saveRedirectEvidence(
  tabId: number,
  pageUrl: string,
  redirect: RedirectTracker,
): Promise<void> {
  if (redirect.redirectMs <= 0 || redirect.startHost === "" || redirect.endHost === "") {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: MSG_STORE_REDIRECT_EVIDENCE,
      tabId,
      evidence: {
        pageUrl,
        start_host: redirect.startHost,
        end_host: redirect.endHost,
        redirect_ms: redirect.redirectMs,
        updatedAt: Date.now(),
      },
    });
  } catch {
    // ignore
  }
}

function normalizeObserverPageUrl(url: string): string {
  const withoutHash = url.trim().split("#")[0];
  try {
    const parsed = new URL(withoutHash);
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
  } catch {
    return withoutHash;
  }
}

function currentPageUrl(): string {
  try {
    return normalizeObserverPageUrl(window.location.href);
  } catch {
    return "";
  }
}

export function startBehaviorObserver(brandIds: string[], tabId: number, pageUrl: string): void {
  const guard = globalThis as unknown as Record<string, string | undefined>;
  const pageKey = normalizeObserverPageUrl(pageUrl);
  if (guard[GUARD_KEY] === pageKey) {
    return;
  }
  guard[GUARD_KEY] = pageKey;

  const pageHref = window.location.href;
  installJsExfilCapture(pageHref);
  installClickfixClipboardCapture();
  const startedAt = Date.now();
  const before = captureSnapshot(pageHref, brandIds);

  const redirect: RedirectTracker = {
    startHost: window.location.hostname.toLowerCase(),
    endHost: window.location.hostname.toLowerCase(),
    redirectMs: 0,
  };

  const noteHostChange = (): void => {
    let currentHost = "";
    try {
      currentHost = window.location.hostname.toLowerCase();
    } catch {
      return;
    }

    if (currentHost === "" || currentHost === redirect.startHost) {
      return;
    }

    if (redirect.redirectMs === 0) {
      redirect.redirectMs = Date.now() - startedAt;
      redirect.endHost = currentHost;
      void saveRedirectEvidence(tabId, currentPageUrl() || pageUrl, redirect);
    }
  };

  void saveBehaviorDiff(tabId, pageUrl, buildDiff(before, before, 0, redirect), "observing");

  let latest = before;
  let finished = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const finalize = (): void => {
    if (finished) {
      return;
    }
    finished = true;

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    observer.disconnect();
    window.clearTimeout(windowTimer);
    window.clearInterval(locationPoll);

    noteHostChange();

    const observedMs = Date.now() - startedAt;
    const diff = buildDiff(before, latest, observedMs, redirect);
    void saveBehaviorDiff(tabId, pageUrl, diff, "ready");
  };

  const refreshLatest = (): void => {
    latest = captureSnapshot(pageHref, brandIds);
  };

  const scheduleRefresh = (): void => {
    if (finished) {
      return;
    }
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      refreshLatest();
    }, DEBOUNCE_MS);
  };

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  const locationPoll = window.setInterval(() => {
    noteHostChange();
  }, LOCATION_POLL_MS);

  window.addEventListener("pagehide", () => {
    noteHostChange();
    if (!finished && redirect.redirectMs > 0) {
      const observedMs = Date.now() - startedAt;
      void saveBehaviorDiff(tabId, pageUrl, buildDiff(before, latest, observedMs, redirect), "ready");
    }
  });

  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["action", "src", "href", "type"],
    });
  } catch {
    void saveBehaviorDiff(
      tabId,
      pageUrl,
      buildDiff(before, before, Date.now() - startedAt, redirect),
      "ready",
    );
    return;
  }

  const windowTimer = window.setTimeout(() => {
    refreshLatest();
    finalize();
  }, BEHAVIOR_OBSERVE_WINDOW_MS);
}

type ObserverGlobal = {
  __AFS_START_BEHAVIOR_OBSERVER__?: (brandIds: string[], tabId: number, pageUrl: string) => void;
};

(globalThis as ObserverGlobal).__AFS_START_BEHAVIOR_OBSERVER__ = startBehaviorObserver;
