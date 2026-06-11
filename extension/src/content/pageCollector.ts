import { matchBrandsFromPage } from "../layers/page-template/brandMatch";
import { emptyFieldProfile } from "../layers/page-template/emptySnapshot";
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
  SubmitButtonSnapshot,
} from "../layers/page-template/types";

const MAX_FORMS = 40;
const MAX_IFRAMES = 20;
const MAX_IMGS = 60;
const HIDDEN_IFRAME_MAX_PX = 2;
const HIDDEN_PASSWORD_MAX_PX = 2;

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

function passwordInputIsVisuallyHidden(input: HTMLInputElement): boolean {
  try {
    const style = window.getComputedStyle(input);
    if (style.display === "none" || style.visibility === "hidden") {
      return true;
    }

    const opacity = Number.parseFloat(style.opacity);
    if (!Number.isNaN(opacity) && opacity === 0) {
      return true;
    }

    const width = input.offsetWidth;
    const height = input.offsetHeight;
    if (width <= HIDDEN_PASSWORD_MAX_PX && height <= HIDDEN_PASSWORD_MAX_PX) {
      return true;
    }

    const rect = input.getBoundingClientRect();
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    if (rect.right < 0 || rect.bottom < 0 || rect.left > viewWidth || rect.top > viewHeight) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
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

      if (type === "password") {
        profile.has_password = true;
        if (el instanceof HTMLInputElement && passwordInputIsVisuallyHidden(el)) {
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
            if (field instanceof HTMLInputElement && field.type.toLowerCase() === "password") {
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

function collectBrands(
  brandIds: string[],
): { primary_brand_hits: string[]; brand_hits: string[] } {
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

export function collectPageSnapshot(brandIds: string[]): PageSnapshot {
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

  const hasCredentialForm =
    fieldProfile.has_password || fieldProfile.has_otp;

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
    external_script_origins: [],
    brand_hits: brandAll,
    primary_brand_hits: brandPrimary,
    hidden_input_count: hiddenInputCount,
    is_framed: pageIsFramed(),
    field_profile: fieldProfile,
  };
}

type CollectorGlobal = {
  __AFS_COLLECT_PAGE_SNAPSHOT__?: (brandIds: string[]) => PageSnapshot;
};

(globalThis as CollectorGlobal).__AFS_COLLECT_PAGE_SNAPSHOT__ = collectPageSnapshot;
