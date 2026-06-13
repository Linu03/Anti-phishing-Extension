import type { FaviconImage, PageSnapshot } from "./types";

type CollectorGlobal = {
  __AFS_COLLECT_PAGE_SNAPSHOT__?: (brandIds: string[], scriptFpOrigins: string[]) => PageSnapshot;
  __AFS_COLLECT_FAVICON__?: (pageHref: string) => Promise<FaviconImage | null>;
};

function snapshotHasSensitiveForm(snapshot: PageSnapshot): boolean {
  const profile = snapshot.field_profile;
  return (
    snapshot.has_credential_form ||
    profile.has_payment ||
    profile.has_identity
  );
}

export async function collectPageSnapshotFromTab(tabId: number, brandIds: string[], scriptFpOrigins: string[]): Promise<PageSnapshot | null> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["pageCollector.js"],
    });
  } catch {
    return null;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (ids: string[], fpOrigins: string[]) => {
        const globalRef = globalThis as CollectorGlobal;
        if (!globalRef.__AFS_COLLECT_PAGE_SNAPSHOT__) {
          return null;
        }
        return globalRef.__AFS_COLLECT_PAGE_SNAPSHOT__(ids, fpOrigins);
      },
      args: [brandIds, scriptFpOrigins],
    });

    if (!results || results.length === 0) {
      return null;
    }

    const snapshot = results[0].result;
    if (snapshot === null || snapshot === undefined || typeof snapshot !== "object") {
      return null;
    }

    const typedSnapshot = snapshot as PageSnapshot;
    if (!snapshotHasSensitiveForm(typedSnapshot)) {
      return typedSnapshot;
    }

    try {
      const faviconResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (pageHref: string) => {
          const globalRef = globalThis as CollectorGlobal;
          if (!globalRef.__AFS_COLLECT_FAVICON__) {
            return null;
          }
          return globalRef.__AFS_COLLECT_FAVICON__(pageHref);
        },
        args: [typedSnapshot.page_url],
      });

      if (faviconResults && faviconResults.length > 0) {
        const favicon = faviconResults[0].result;
        if (favicon !== null && favicon !== undefined && typeof favicon === "object") {
          typedSnapshot.favicon = favicon as FaviconImage;
        }
      }
    } catch {
      // non-fatal
    }

    return typedSnapshot;
  } catch {
    return null;
  }
}
