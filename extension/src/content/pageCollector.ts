import { matchBrandsFromPage } from "../layers/page-template/brandMatch";
import { emptyFieldProfile } from "../layers/page-template/emptySnapshot";
import {
  inputIsHoneypotField,
  inputIsVisuallyHidden,
  inputLooksLikePassword,
} from "../layers/page-template/passwordFieldDetect";
import {
  safeHostname,
  safeOrigin,
  sanitizeFormAction,
  sanitizedTabUrl,
} from "../layers/page-template/urlSanitize";
import type {
  FieldProfile,
  FormSnapshot,
  IframeSnapshot,
  PageSnapshot,
  ProminentImage,
  SubmitButtonSnapshot,
} from "../layers/page-template/types";

const MAX_FORMS = 40;
const MAX_IFRAMES = 20;
const MAX_IMGS = 60;
const MAX_RESOURCE_NODES = 80;
const HIDDEN_IFRAME_MAX_PX = 2;
const HIDDEN_PASSWORD_MAX_PX = 2;

const LOGO_MIN_AREA_PX = 600;
const LOGO_B64_MAX_EDGE = 512;
const LOGO_B64_QUALITY = 0.82;

const PAYMENT_NAME_HINTS = [
  "cardnumber",
  "card-number",
  "cc-number",
  "ccnumber",
  "cvv",
  "cvc",
  "cc-csc",
  "exp-date",
  "expiration",
];

const IDENTITY_NAME_HINTS = ["cnp", "ssn", "social-security", "national-id", "nin", "pesel"];

const OTP_NAME_HINTS = ["otp", "2fa", "mfa", "totp", "one-time", "verification-code", "smscode"];

function attrLower(element: Element, name: string): string {
  try {
    const value = element.getAttribute(name);
    if (value === null) {
      return "";
    }
    return value.toLowerCase();
  } catch {
    return "";
  }
}

function collectFieldProfile(): FieldProfile {
  const profile = emptyFieldProfile();

  try {
    const inputs = document.querySelectorAll("input, select, textarea");
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement) && !(el instanceof HTMLTextAreaElement)) {
        continue;
      }

      const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : "";
      const autocomplete = attrLower(el, "autocomplete");
      const name = attrLower(el, "name");
      const id = attrLower(el, "id");
      const inputmode = attrLower(el, "inputmode");
      const meta = `${name} ${id} ${autocomplete}`;

      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        inputLooksLikePassword(el)
      ) {
        profile.has_password = true;
        if (el instanceof HTMLInputElement && inputIsVisuallyHidden(el)) {
          profile.has_hidden_password = true;
        }
      }
      if (type === "email" || autocomplete.includes("email")) {
        profile.has_email = true;
      }
      if (type === "tel" || autocomplete.includes("tel")) {
        profile.has_tel = true;
      }
      if (type === "file") {
        profile.has_file = true;
      }

      const otpHoneypot = el instanceof HTMLInputElement && inputIsHoneypotField(el);
      if (!otpHoneypot) {
        if (autocomplete === "one-time-code" || OTP_NAME_HINTS.some((hint) => meta.includes(hint))) {
          profile.has_otp = true;
        } else if (
          el instanceof HTMLInputElement &&
          inputmode === "numeric" &&
          el.maxLength >= 4 &&
          el.maxLength <= 8
        ) {
          profile.has_otp = true;
        }
      }

      if (autocomplete.includes("cc-") || PAYMENT_NAME_HINTS.some((hint) => meta.includes(hint))) {
        profile.has_payment = true;
      }

      if (
        autocomplete.includes("national-id") ||
        IDENTITY_NAME_HINTS.some((hint) => meta.includes(hint))
      ) {
        profile.has_identity = true;
      }
    }
  } catch {
    // ignore
  }

  return profile;
}

function collectForms(pageHref: string, pageOrigin: string): FormSnapshot[] {
  const forms: FormSnapshot[] = [];

  try {
    const nodes = document.querySelectorAll("form");
    const limit = nodes.length < MAX_FORMS ? nodes.length : MAX_FORMS;

    for (let i = 0; i < limit; i++) {
      const form = nodes[i];
      if (!(form instanceof HTMLFormElement)) {
        continue;
      }

      try {
        const rawAction = form.getAttribute("action") ?? "";
        const action = sanitizeFormAction(rawAction, pageHref);
        const actionOrigin = safeOrigin(rawAction, pageHref);
        const sameOrigin = actionOrigin === "" || actionOrigin === pageOrigin;

        let hiddenCount = 0;
        let visibleFieldCount = 0;
        let hasPassword = false;
        try {
          hiddenCount = form.querySelectorAll('input[type="hidden"]').length;
        } catch {
          hiddenCount = 0;
        }
        try {
          const fields = form.querySelectorAll("input, select, textarea");
          for (let j = 0; j < fields.length; j++) {
            const field = fields[j];
            if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement) && !(field instanceof HTMLTextAreaElement)) {
              continue;
            }
            if (field instanceof HTMLInputElement && field.type.toLowerCase() === "hidden") {
              continue;
            }
            visibleFieldCount = visibleFieldCount + 1;
            if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && inputLooksLikePassword(field)) 
            {
              hasPassword = true;
            }
          }
        } catch {
          visibleFieldCount = 0;
          hasPassword = false;
        }

        let method = "get";
        try {
          method = (form.getAttribute("method") ?? "get").toLowerCase();
        } catch {
          method = "get";
        }

        forms.push({
          method,
          action,
          action_origin: actionOrigin,
          same_origin: sameOrigin,
          hidden_count: hiddenCount,
          has_password: hasPassword,
          visible_field_count: visibleFieldCount,
        });
      } catch {
        // skip form
      }
    }
  } catch {
    // ignore
  }

  return forms;
}

function collectSubmitButtons(pageHref: string): SubmitButtonSnapshot[] {
  const buttons: SubmitButtonSnapshot[] = [];

  try {
    const nodes = document.querySelectorAll('button[type="submit"], input[type="submit"]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      try {
        const raw = node.getAttribute("formaction") ?? "";
        if (raw.trim() === "") {
          continue;
        }
        buttons.push({
          formaction: sanitizeFormAction(raw, pageHref),
          formaction_origin: safeOrigin(raw, pageHref),
        });
      } catch {
        // skip
      }
    }
  } catch {
    // ignore
  }

  return buttons;
}

function iframeIsHidden(el: HTMLIFrameElement): boolean {
  try {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return true;
    }
    const opacity = Number.parseFloat(style.opacity);
    if (!Number.isNaN(opacity) && opacity === 0) {
      return true;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w <= HIDDEN_IFRAME_MAX_PX && h <= HIDDEN_IFRAME_MAX_PX) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function collectIframes(pageHref: string): IframeSnapshot[] {
  const iframes: IframeSnapshot[] = [];

  try {
    const nodes = document.querySelectorAll("iframe");
    const limit = nodes.length < MAX_IFRAMES ? nodes.length : MAX_IFRAMES;

    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      if (!(el instanceof HTMLIFrameElement)) {
        continue;
      }

      try {
        const src = el.getAttribute("src") ?? "";
        iframes.push({
          src_origin: safeOrigin(src, pageHref),
          width: el.offsetWidth,
          height: el.offsetHeight,
          is_hidden: iframeIsHidden(el),
        });
      } catch {
        // skip
      }
    }
  } catch {
    // ignore
  }

  return iframes;
}

function parseMetaRefresh(): { target: string; delaySec: number | null } {
  try {
    const meta = document.querySelector('meta[http-equiv="refresh" i]');
    if (meta === null) {
      return { target: "", delaySec: null };
    }

    const content = meta.getAttribute("content") ?? "";
    if (content.trim() === "") {
      return { target: "", delaySec: null };
    }

    const parts = content.split(";");
    let delaySec: number | null = null;
    let targetUrl = "";

    if (parts.length > 0) {
      const maybeDelay = Number.parseInt(parts[0].trim(), 10);
      if (!Number.isNaN(maybeDelay)) {
        delaySec = maybeDelay;
      }
    }

    for (let i = 1; i < parts.length; i++) {
      const piece = parts[i].trim();
      const match = piece.match(/^url\s*=\s*(.+)$/i);
      if (match) {
        targetUrl = match[1].trim().replace(/^['"]|['"]$/g, "");
        break;
      }
    }

    const host = safeHostname(targetUrl, window.location.href);
    return {
      target: host,
      delaySec,
    };
  } catch {
    return { target: "", delaySec: null };
  }
}

function collectBrands(brandIds: string[]): { primary_brand_hits: string[]; brand_hits: string[] } {
  return matchBrandsFromPage(
    brandIds,
    () => document.title,
    () => {
      const texts: string[] = [];
      try {
        const h1 = document.querySelector("h1");
        if (h1 !== null) {
          texts.push(h1.textContent ?? "");
        }
      } catch {
        // ignore
      }
      return texts;
    },
    () => {
      const texts: string[] = [];
      try {
        const imgs = document.querySelectorAll("img[alt]");
        const limit = imgs.length < MAX_IMGS ? imgs.length : MAX_IMGS;
        for (let i = 0; i < limit; i++) {
          texts.push(imgs[i].getAttribute("alt") ?? "");
        }
      } catch {
        // ignore
      }
      try {
        const footer = document.querySelector("footer");
        if (footer !== null) {
          texts.push(footer.textContent ?? "");
        }
      } catch {
        // ignore
      }
      return texts;
    },
  );
}

function countHiddenInputs(): number {
  try {
    return document.querySelectorAll('input[type="hidden"]').length;
  } catch {
    return 0;
  }
}

function pageIsFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

type ResourceCounts = {
  total_resource_count: number;
  external_resource_count: number;
  external_resource_ratio: number;
  external_script_origins: string[];
};

function registeredDomain(host: string): string {
  const value = host.trim().toLowerCase();
  if (value === "") {
    return "";
  }
  const parts = value.split(".").filter((part) => part.length > 0);
  if (parts.length < 2) {
    return value;
  }
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function buildScriptFpOriginSet(origins: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < origins.length; i++) {
    const value = origins[i].trim().toLowerCase();
    if (value !== "") {
      set.add(value);
    }
  }
  return set;
}

function isScriptFpOrigin(host: string, fpOrigins: Set<string>): boolean {
  const value = host.trim().toLowerCase();
  if (value === "") {
    return false;
  }
  return fpOrigins.has(value);
}

function isSameSiteHost(pageHost: string, resourceHost: string): boolean {
  if (pageHost === "" || resourceHost === "") {
    return false;
  }
  if (pageHost === resourceHost) {
    return true;
  }
  return registeredDomain(pageHost) === registeredDomain(resourceHost);
}

function collectResourceUrls(): string[] {
  const urls: string[] = [];

  try {
    const scripts = document.querySelectorAll("script[src]");
    for (let i = 0; i < scripts.length && urls.length < MAX_RESOURCE_NODES; i++) {
      const src = scripts[i].getAttribute("src");
      if (src !== null && src.trim() !== "") {
        urls.push(src);
      }
    }
  } catch {
    // ignore
  }

  try {
    const links = document.querySelectorAll('link[rel="stylesheet"][href]');
    for (let i = 0; i < links.length && urls.length < MAX_RESOURCE_NODES; i++) {
      const href = links[i].getAttribute("href");
      if (href !== null && href.trim() !== "") {
        urls.push(href);
      }
    }
  } catch {
    // ignore
  }

  try {
    const imgs = document.querySelectorAll("img[src]");
    const imgLimit = imgs.length < MAX_IMGS ? imgs.length : MAX_IMGS;
    for (let i = 0; i < imgLimit && urls.length < MAX_RESOURCE_NODES; i++) {
      const src = imgs[i].getAttribute("src");
      if (src !== null && src.trim() !== "") {
        urls.push(src);
      }
    }
  } catch {
    // ignore
  }

  return urls;
}

function emptyResourceCounts(): ResourceCounts {
  return {
    total_resource_count: 0,
    external_resource_count: 0,
    external_resource_ratio: 0,
    external_script_origins: [],
  };
}

function collectPageResources(pageHref: string, pageHost: string, scriptFpOrigins: string[]): ResourceCounts {
  if (pageHost === "") {
    return emptyResourceCounts();
  }

  const fpOrigins = buildScriptFpOriginSet(scriptFpOrigins);
  const urls = collectResourceUrls();
  let total = 0;
  let external = 0;
  const externalHosts = new Set<string>();

  for (let i = 0; i < urls.length; i++) {
    const host = safeHostname(urls[i], pageHref);
    if (host === "") {
      continue;
    }
    if (isScriptFpOrigin(host, fpOrigins)) {
      continue;
    }

    total = total + 1;
    if (!isSameSiteHost(pageHost, host)) {
      external = external + 1;
      externalHosts.add(host);
    }
  }

  let ratio = 0;
  if (total > 0) {
    ratio = external / total;
  }

  return {
    total_resource_count: total,
    external_resource_count: external,
    external_resource_ratio: ratio,
    external_script_origins: Array.from(externalHosts),
  };
}

function absoluteUrl(rawUrl: string, pageHref: string): string {
  const value = rawUrl.trim();
  if (value === "") {
    return "";
  }
  try {
    return new URL(value, pageHref).href;
  } catch {
    return "";
  }
}

function scoreLogoCandidate(img: HTMLImageElement): number {
  let rect: DOMRect;
  try {
    rect = img.getBoundingClientRect();
  } catch {
    return -1;
  }

  const width = rect.width;
  const height = rect.height;
  const area = width * height;
  if (area < LOGO_MIN_AREA_PX) {
    return -1;
  }

  // Logos/headers sit near the top; reward upper placement, penalize huge banners.
  const viewportH = window.innerHeight > 0 ? window.innerHeight : 800;
  const topBias = rect.top <= viewportH * 0.35 ? 1.6 : 1.0;
  const aspect = width > 0 && height > 0 ? width / height : 0;
  const aspectBias = aspect >= 0.5 && aspect <= 6 ? 1.2 : 1.0;

  return area * topBias * aspectBias;
}

function pickProminentImageElement(): HTMLImageElement | null {
  let best: HTMLImageElement | null = null;
  let bestScore = 0;

  try {
    const imgs = document.querySelectorAll("img");
    const limit = imgs.length < MAX_IMGS ? imgs.length : MAX_IMGS;
    for (let i = 0; i < limit; i++) {
      const el = imgs[i];
      if (!(el instanceof HTMLImageElement)) {
        continue;
      }
      if (el.naturalWidth === 0 || el.naturalHeight === 0) {
        continue;
      }
      const score = scoreLogoCandidate(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
  } catch {
    return null;
  }

  return best;
}

function tryEncodeImageB64(img: HTMLImageElement): { b64: string; mime: string } {
  try {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (naturalW === 0 || naturalH === 0) {
      return { b64: "", mime: "" };
    }

    const scale = Math.min(1, LOGO_B64_MAX_EDGE / Math.max(naturalW, naturalH));
    const canvasW = Math.max(1, Math.round(naturalW * scale));
    const canvasH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return { b64: "", mime: "" };
    }
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // toDataURL throws/taints for cross-origin images without CORS — caught below.
    const dataUrl = canvas.toDataURL("image/jpeg", LOGO_B64_QUALITY);
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      return { b64: "", mime: "" };
    }
    return { b64: dataUrl.slice(commaIndex + 1), mime: "image/jpeg" };
  } catch {
    return { b64: "", mime: "" };
  }
}

function collectProminentImage(pageHref: string): ProminentImage | null {
  const img = pickProminentImageElement();
  if (img === null) {
    return null;
  }

  const url = absoluteUrl(img.currentSrc || img.src || "", pageHref);
  if (url === "") {
    return null;
  }

  const encoded = tryEncodeImageB64(img);

  return {
    url,
    b64: encoded.b64,
    mime: encoded.mime,
    width: Math.round(img.naturalWidth),
    height: Math.round(img.naturalHeight),
  };
}

export function collectPageSnapshot(brandIds: string[], scriptFpOrigins: string[]): PageSnapshot {
  const pageHref = window.location.href;
  const pageOrigin = sanitizedTabUrl(pageHref);
  const pageHost = safeHostname(pageHref);

  let forms: FormSnapshot[] = [];
  let submitButtons: SubmitButtonSnapshot[] = [];
  let fieldProfile = emptyFieldProfile();
  let iframes: IframeSnapshot[] = [];
  let metaTarget = "";
  let metaDelay: number | null = null;
  let baseOrigin = "";
  let canonicalHost = "";
  let brandPrimary: string[] = [];
  let brandAll: string[] = [];
  let hiddenInputCount = 0;
  let resourceCounts = emptyResourceCounts();

  try {
    forms = collectForms(pageHref, pageOrigin);
  } catch {
    // ignore
  }

  try {
    submitButtons = collectSubmitButtons(pageHref);
  } catch {
    // ignore
  }

  try {
    fieldProfile = collectFieldProfile();
  } catch {
    // ignore
  }

  try {
    iframes = collectIframes(pageHref);
  } catch {
    // non-fatal
  }

  try {
    const meta = parseMetaRefresh();
    metaTarget = meta.target;
    metaDelay = meta.delaySec;
  } catch {
    // non-fatal
  }

  try {
    const base = document.querySelector("base[href]");
    if (base !== null) {
      baseOrigin = safeOrigin(base.getAttribute("href") ?? "", pageHref);
    }
  } catch {
    // non-fatal
  }

  try {
    const canonical = document.querySelector('link[rel="canonical" i]');
    if (canonical !== null) {
      canonicalHost = safeHostname(canonical.getAttribute("href") ?? "", pageHref);
    }
  } catch {
    // non-fatal
  }

  try {
    const brands = collectBrands(brandIds);
    brandPrimary = brands.primary_brand_hits;
    brandAll = brands.brand_hits;
  } catch {
    // non-fatal
  }

  try {
    hiddenInputCount = countHiddenInputs();
  } catch {
    hiddenInputCount = 0;
  }

  try {
    resourceCounts = collectPageResources(pageHref, pageHost, scriptFpOrigins);
  } catch {
    resourceCounts = emptyResourceCounts();
  }

  const hasCredentialForm =
    fieldProfile.has_password || fieldProfile.has_otp;
  const hasSensitiveForm =
    hasCredentialForm || fieldProfile.has_payment || fieldProfile.has_identity;

  let prominentImage: ProminentImage | null = null;
  if (hasSensitiveForm) {
    try {
      prominentImage = collectProminentImage(pageHref);
    } catch {
      prominentImage = null;
    }
  }

  return {
    page_url: pageOrigin !== "" ? pageOrigin : pageHref.slice(0, 8192),
    page_host: pageHost,
    page_origin: pageOrigin,
    collection_ok: true,
    collection_error: "",
    has_credential_form: hasCredentialForm,
    forms,
    submit_buttons: submitButtons,
    iframes,
    meta_refresh_target: metaTarget,
    meta_refresh_delay_sec: metaDelay,
    base_href_origin: baseOrigin,
    canonical_host: canonicalHost,
    external_script_origins: resourceCounts.external_script_origins,
    total_resource_count: resourceCounts.total_resource_count,
    external_resource_count: resourceCounts.external_resource_count,
    external_resource_ratio: resourceCounts.external_resource_ratio,
    brand_hits: brandAll,
    primary_brand_hits: brandPrimary,
    hidden_input_count: hiddenInputCount,
    is_framed: pageIsFramed(),
    field_profile: fieldProfile,
    prominent_image: prominentImage,
  };
}

type CollectorGlobal = {
  __AFS_COLLECT_PAGE_SNAPSHOT__?: (brandIds: string[], scriptFpOrigins: string[]) => PageSnapshot;
};

(globalThis as CollectorGlobal).__AFS_COLLECT_PAGE_SNAPSHOT__ = collectPageSnapshot;
