/** Strip URL to scheme + host (no path, query, hash). Invalid URLs return "". */
export function safeOrigin(href: string, base?: string): string {
  const text = href.trim();
  if (text === "") {
    return "";
  }

  try {
    const parsed = new URL(text, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

export function safeHostname(href: string, base?: string): string {
  const text = href.trim();
  if (text === "") {
    return "";
  }

  try {
    const parsed = new URL(text, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** For form actions: keep relative paths; absolute URLs become origin-only. */
export function sanitizeFormAction(action: string, pageHref: string): string {
  const text = action.trim();
  if (text === "") {
    return "";
  }

  const lower = text.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return text;
  }

  if (!text.includes("://") && !text.startsWith("//")) {
    if (text.startsWith("/") || text.startsWith("./") || text.startsWith("../")) {
      return text;
    }
    return text;
  }

  const origin = safeOrigin(text, pageHref);
  return origin !== "" ? origin : "";
}

export function sanitizedTabUrl(tabUrl: string): string {
  const origin = safeOrigin(tabUrl);
  if (origin !== "") {
    return origin;
  }
  return tabUrl.trim().slice(0, 8192);
}
