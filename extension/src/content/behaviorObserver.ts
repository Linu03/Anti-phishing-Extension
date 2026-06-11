import { matchBrandsFromPage } from "../layers/page-template/brandMatch";
import { safeOrigin } from "../layers/page-template/urlSanitize";
import type { BehaviorDiff } from "../layers/behavioral/types";
import { behaviorDiffKey, type StoredBehaviorDiff } from "../layers/behavioral/behaviorDiffStorage";

const OBSERVE_WINDOW_MS = 5000;
const DEBOUNCE_MS = 400;
const GUARD_KEY = "__afs_behavior_observer_active__";

type BehaviorSnapshot = {
  formCount: number;
  passwordCount: number;
  actionOrigin: string;
  brandHits: string[];
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
    passwordCount = document.querySelectorAll('input[type="password"]').length;
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

function buildDiff(before: BehaviorSnapshot, after: BehaviorSnapshot, observedMs: number): BehaviorDiff {
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
    await chrome.storage.session.set({ [behaviorDiffKey(tabId)]: record });
  } catch {
    // ignore
  }
}

export function startBehaviorObserver(brandIds: string[], tabId: number, pageUrl: string): void {
  const guard = globalThis as unknown as Record<string, boolean>;
  if (guard[GUARD_KEY] === true) {
    return;
  }
  guard[GUARD_KEY] = true;

  const pageHref = window.location.href;
  const startedAt = Date.now();
  const before = captureSnapshot(pageHref, brandIds);

  void saveBehaviorDiff(tabId, pageUrl, buildDiff(before, before, 0), "observing");

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

    const observedMs = Date.now() - startedAt;
    const diff = buildDiff(before, latest, observedMs);
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

  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["action", "src", "href", "type"],
    });
  } catch {
    void saveBehaviorDiff(tabId, pageUrl, buildDiff(before, before, Date.now() - startedAt), "ready");
    return;
  }

  const windowTimer = window.setTimeout(() => {
    refreshLatest();
    finalize();
  }, OBSERVE_WINDOW_MS);
}

type ObserverGlobal = {
  __AFS_START_BEHAVIOR_OBSERVER__?: (brandIds: string[], tabId: number, pageUrl: string) => void;
};

(globalThis as ObserverGlobal).__AFS_START_BEHAVIOR_OBSERVER__ = startBehaviorObserver;
