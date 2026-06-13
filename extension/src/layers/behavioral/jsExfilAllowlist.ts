// domains commonly use for oauth, captcha, payments, and analytics on login pages
export const TRUSTED_EXFIL_PLDS: ReadonlySet<string> = new Set([
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "googleusercontent.com",
  "youtube.com",
  "microsoft.com",
  "microsoftonline.com",
  "live.com",
  "office.com",
  "apple.com",
  "icloud.com",
  "facebook.com",
  "fbcdn.net",
  "cloudflare.com",
  "challenges.cloudflare.com",
  "stripe.com",
  "stripe.network",
  "paypal.com",
  "hcaptcha.com",
  "recaptcha.net",
  "gstatic.com",
  "doubleclick.net",
  "googletagmanager.com",
  "google-analytics.com",
  "hotjar.com",
  "clarity.ms",
  "jquery.com",
  "jsdelivr.net",
  "cloudfront.net",
  "akamaized.net",
]);

const MULTI_PART_SUFFIXES = ["co.uk", "com.au", "co.ro", "org.uk", "com.br"] as const;

export function registeredDomainFromHost(host: string): string {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (normalized === "") {
    return "";
  }

  for (let i = 0; i < MULTI_PART_SUFFIXES.length; i++) {
    const suffix = MULTI_PART_SUFFIXES[i];
    const needle = `.${suffix}`;
    if (normalized.endsWith(needle)) {
      const prefix = normalized.slice(0, -needle.length);
      const labels = prefix.split(".").filter((part) => part !== "");
      if (labels.length === 0) {
        return suffix;
      }
      return `${labels[labels.length - 1]}.${suffix}`;
    }
  }

  const parts = normalized.split(".").filter((part) => part !== "");
  if (parts.length < 2) {
    return normalized;
  }
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

export function isTrustedExfilPld(pld: string): boolean {
  if (pld === "") {
    return true;
  }
  if (TRUSTED_EXFIL_PLDS.has(pld)) {
    return true;
  }
  for (const trusted of TRUSTED_EXFIL_PLDS) {
    if (pld.endsWith(`.${trusted}`)) {
      return true;
    }
  }
  return false;
}

export function isPostLikeMethod(method: string): boolean {
  const upper = method.trim().toUpperCase();
  return upper === "POST" || upper === "PUT" || upper === "PATCH";
}
