export type ManipulationSurfaceHints = {
  has_urgency_fear_pressure: boolean;
  has_fake_social_proof_numeric: boolean;
  has_false_authority_language: boolean;
};

const URGENCY_FEAR_PHRASES = [
  "contul va fi suspendat",
  "cont suspendat",
  "account suspended",
  "account will be suspended",
  "acțiune necesară imediat",
  "action required immediately",
  "action required",
  "expiră în",
  "expires in",
  "ultima șansă",
  "last chance",
  "verifică acum",
  "verify now",
  "cont compromis",
  "account compromised",
  "activitate suspectă",
  "suspicious activity",
  "evita blocarea",
  "avoid being locked",
  "în 24 de ore",
  "within 24 hours",
  "plata va fi anulată",
  "payment will be cancelled",
  "datele vor fi șterse",
  "data will be deleted",
] as const;

const URGENCY_FEAR_REGEXES = [
  /\b(expir|expire)[a-zăâîșț]*\b.{0,40}\b\d{1,3}\s*(minute|min|ore|hour|hours|zile|days)\b/i,
  /\b(cont|contul|account)\b.{0,40}\bsuspend(at|ed|are|area)?\b/i,
  /\b(compromis|compromised)\b/i,
] as const;

const SOCIAL_PROOF_REGEXES = [
  /\b\d{2,}[\d.,\s]*\s*(persoane|people|users|utilizatori)\b/i,
  /\bultimele\s+\d{1,3}\s+(locuri|places|spots)\b/i,
  /\b\d+\s+de\s+persoane\b/i,
  /\b\d{2,}\s+(persoane|utilizatori).{0,50}(verific|confirm|completeaz|checking|viewing)/i,
  /\b(verific|confirm)[a-zăâîșț]*\b.{0,40}\b(acum|now|astăzi|today)\b/i,
] as const;

const AUTHORITY_PHRASES = [
  "verificat de",
  "aprobat de",
  "partener oficial",
  "official partner",
  "certificat de",
  "certified by",
  "autoritățile financiare",
  "financial authorities",
  "departamentul de securitate",
  "security department",
  "validat de",
  "validated by",
  "notificare oficială",
  "official notice",
  "banca națională",
  "national bank",
] as const;

const MAX_SURFACE_CHARS = 6000;
const EXCLUDED_TAGS = new Set(["NAV", "HEADER", "FOOTER", "SCRIPT", "STYLE", "NOSCRIPT"]);

function safeText(node: Element | null): string {
  if (node === null) {
    return "";
  }
  try {
    return node.textContent ?? "";
  } catch {
    return "";
  }
}

// Container around the auth form: climb a few levels so pressure text rendered
// next to the form is captured, but stop before swallowing whole-page chrome.
function authFormContainer(): Element | null {
  let form: Element | null = null;
  try {
    const pwd = document.querySelector('input[type="password"]');
    form = pwd !== null ? pwd.closest("form") : null;
    if (form === null) {
      form = document.querySelector("form");
    }
  } catch {
    return null;
  }

  if (form === null) {
    return null;
  }

  let node: Element = form;
  for (let i = 0; i < 3; i++) {
    const parent = node.parentElement;
    if (parent === null || parent === document.body || parent.tagName === "MAIN") {
      break;
    }
    node = parent;
  }
  return node;
}

// Banners / modals / alerts anywhere on the page — where phishing pressure text
// is often rendered even when it sits outside the form container.
function alertLikeText(): string {
  const parts: string[] = [];
  try {
    const selector =
      '[role="alert"], [role="alertdialog"], [role="dialog"], .alert, .banner, .notice, .notification, .toast, .modal';
    const nodes = document.querySelectorAll(selector);
    const limit = nodes.length < 12 ? nodes.length : 12;
    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      if (!EXCLUDED_TAGS.has(el.tagName)) {
        parts.push(safeText(el));
      }
    }
  } catch {
    // ignore
  }
  return parts.join(" ");
}

function fallbackSurfaceText(): string {
  try {
    const main = document.querySelector("main");
    if (main !== null) {
      return safeText(main);
    }
  } catch {
    // ignore
  }
  return safeText(document.body);
}

// Scoped manipulation text: the auth surface (form container + alert/banner
// elements), not the entire page body. This avoids matching generic marketing
// copy in the header/nav/footer of legitimate sites.
function normalizedAuthSurfaceText(): string {
  const container = authFormContainer();
  const base = container !== null ? safeText(container) : fallbackSurfaceText();
  const raw = `${base} ${alertLikeText()}`;
  return raw.replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_SURFACE_CHARS);
}

function textHasAnyPhrase(text: string, phrases: readonly string[]): boolean {
  for (let i = 0; i < phrases.length; i++) {
    if (text.includes(phrases[i])) {
      return true;
    }
  }
  return false;
}

function textMatchesAnyRegex(text: string, patterns: readonly RegExp[]): boolean {
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(text)) {
      return true;
    }
  }
  return false;
}

function detectUrgencyFearPressure(text: string): boolean {
  if (textHasAnyPhrase(text, URGENCY_FEAR_PHRASES)) {
    return true;
  }
  return textMatchesAnyRegex(text, URGENCY_FEAR_REGEXES);
}

function detectFakeSocialProofNumeric(text: string): boolean {
  for (let i = 0; i < SOCIAL_PROOF_REGEXES.length; i++) {
    if (SOCIAL_PROOF_REGEXES[i].test(text)) {
      return true;
    }
  }
  return false;
}

function detectFalseAuthorityLanguage(text: string): boolean {
  return textHasAnyPhrase(text, AUTHORITY_PHRASES);
}

export function emptyManipulationSurfaceHints(): ManipulationSurfaceHints {
  return {
    has_urgency_fear_pressure: false,
    has_fake_social_proof_numeric: false,
    has_false_authority_language: false,
  };
}

export function collectManipulationSurfaceHints(): ManipulationSurfaceHints {
  const text = normalizedAuthSurfaceText();
  const hints = emptyManipulationSurfaceHints();

  if (text === "") {
    return hints;
  }

  hints.has_urgency_fear_pressure = detectUrgencyFearPressure(text);
  hints.has_fake_social_proof_numeric = detectFakeSocialProofNumeric(text);
  hints.has_false_authority_language = detectFalseAuthorityLanguage(text);

  return hints;
}
