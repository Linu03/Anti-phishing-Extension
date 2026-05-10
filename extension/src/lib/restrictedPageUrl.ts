const BLOCKED_SCHEMES = [
  "chrome",
  "chrome-extension",
  "edge",
  "about",
  "moz-extension",
  "devtools",
  "file",
];

export function isRestrictedPageUrl(pageUrl: string): boolean {
  const trimmed = pageUrl.trim();
  if (trimmed === "") {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return true;
  }

  let scheme = parsed.protocol;
  if (scheme.endsWith(":")) {
    scheme = scheme.slice(0, -1);
  }
  scheme = scheme.toLowerCase();

  for (let i = 0; i < BLOCKED_SCHEMES.length; i++) {
    if (scheme === BLOCKED_SCHEMES[i]) {
      return true;
    }
  }
  return false;
}
