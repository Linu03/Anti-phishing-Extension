import type { FieldProfile, FormSnapshot, IframeSnapshot } from "./types";

export type CaptchaSurfaceHints = {
  has_standalone_checkbox: boolean;
  has_captcha_like_text: boolean;
  mentions_cloudflare_or_recaptcha: boolean;
  has_clickfix_instruction_text: boolean;
  has_real_captcha_widget: boolean;
};

const REAL_CAPTCHA_HOST_SUFFIXES = [
  "challenges.cloudflare.com",
  "www.recaptcha.net",
  "recaptcha.net",
  "hcaptcha.com",
  "newassets.hcaptcha.com",
] as const;

const CAPTCHA_TEXT_PHRASES = [
  "verify you are human",
  "not a robot",
  "i'm not a robot",
  "im not a robot",
  "just a moment",
  "checking your browser",
  "security check",
  "complete the check",
] as const;

// ClickFix lures always combine a "run/execute" step with a "paste/confirm"
// step. We require BOTH a run-signal and a paste-signal so isolated generic
// words (e.g. "clipboard", "press enter") on a normal page don't trigger.
const CLICKFIX_RUN_PHRASES = [
  "win+r",
  "win + r",
  "windows+r",
  "windows + r",
  "open run",
  "run dialog",
  "powershell",
  "open powershell",
  "cmd.exe",
  "press windows",
  "verification command",
] as const;

const CLICKFIX_PASTE_PHRASES = [
  "ctrl+v",
  "ctrl + v",
  "paste",
  "press enter",
  "hit enter",
  "then enter",
] as const;

function hostMatchesRealCaptcha(host: string): boolean {
  const value = host.trim().toLowerCase();
  if (value === "") {
    return false;
  }
  for (let i = 0; i < REAL_CAPTCHA_HOST_SUFFIXES.length; i++) {
    const suffix = REAL_CAPTCHA_HOST_SUFFIXES[i];
    if (value === suffix || value.endsWith(`.${suffix}`)) {
      return true;
    }
  }
  return false;
}

function hostFromOrigin(origin: string): string {
  const text = origin.trim();
  if (text === "") {
    return "";
  }
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizedBodyText(): string {
  try {
    return (document.body?.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  } catch {
    return "";
  }
}

const VERIFICATION_SELECTOR = [
  '[class*="captcha" i]',
  '[id*="captcha" i]',
  '[class*="verify" i]',
  '[id*="verify" i]',
  '[class*="verification" i]',
  '[class*="challenge" i]',
  '[class*="robot" i]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  ".modal",
].join(", ");

// Text from the verification surface only: containers that look like a
// captcha/verification widget plus the area immediately around any checkbox.
// Real ClickFix lures put their instructions right next to the fake checkbox,
// so this keeps detection while ignoring incidental wording elsewhere on large
// legitimate pages (footer, product listings, etc.).
function verificationSurfaceText(): string {
  const parts: string[] = [];

  try {
    const nodes = document.querySelectorAll(VERIFICATION_SELECTOR);
    const limit = nodes.length < 15 ? nodes.length : 15;
    for (let i = 0; i < limit; i++) {
      parts.push(nodes[i].textContent ?? "");
    }
  } catch {
    // ignore
  }

  try {
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    const limit = boxes.length < 10 ? boxes.length : 10;
    for (let i = 0; i < limit; i++) {
      const container = boxes[i].closest("form, section, fieldset, label, div");
      if (container !== null) {
        parts.push(container.textContent ?? "");
      }
    }
  } catch {
    // ignore
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 6000);
}

function textHasAnyPhrase(text: string, phrases: readonly string[]): boolean {
  for (let i = 0; i < phrases.length; i++) {
    if (text.includes(phrases[i])) {
      return true;
    }
  }
  return false;
}

function hasCredentialLikeForm(fieldProfile: FieldProfile, forms: FormSnapshot[]): boolean {
  if (fieldProfile.has_password || fieldProfile.has_otp) {
    return true;
  }
  for (let i = 0; i < forms.length; i++) {
    if (forms[i].has_password) {
      return true;
    }
  }
  return false;
}

function hasStandaloneCheckbox(): boolean {
  try {
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    return boxes.length > 0;
  } catch {
    return false;
  }
}

function detectRealCaptchaWidget(
  iframes: IframeSnapshot[],
  scriptOrigins: string[],
): boolean {
  for (let i = 0; i < iframes.length; i++) {
    const host = hostFromOrigin(iframes[i].src_origin);
    if (hostMatchesRealCaptcha(host)) {
      return true;
    }
  }

  for (let i = 0; i < scriptOrigins.length; i++) {
    if (hostMatchesRealCaptcha(scriptOrigins[i])) {
      return true;
    }
  }

  try {
    const selector =
      'iframe[src*="challenges.cloudflare.com"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha iframe, .h-captcha iframe';
    if (document.querySelector(selector) !== null) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

export function emptyCaptchaSurfaceHints(): CaptchaSurfaceHints {
  return {
    has_standalone_checkbox: false,
    has_captcha_like_text: false,
    mentions_cloudflare_or_recaptcha: false,
    has_clickfix_instruction_text: false,
    has_real_captcha_widget: false,
  };
}

function detectClickfixInstruction(text: string): boolean {
  const hasRunStep = textHasAnyPhrase(text, CLICKFIX_RUN_PHRASES);
  const hasPasteStep = textHasAnyPhrase(text, CLICKFIX_PASTE_PHRASES);
  return hasRunStep && hasPasteStep;
}

export function collectCaptchaSurfaceHints(
  fieldProfile: FieldProfile,
  forms: FormSnapshot[],
  iframes: IframeSnapshot[],
  scriptOrigins: string[],
): CaptchaSurfaceHints {
  const hints = emptyCaptchaSurfaceHints();
  const bodyText = normalizedBodyText();
  const surfaceText = verificationSurfaceText();

  hints.has_captcha_like_text = textHasAnyPhrase(surfaceText, CAPTCHA_TEXT_PHRASES);
  hints.mentions_cloudflare_or_recaptcha =
    bodyText.includes("cloudflare") || bodyText.includes("recaptcha");
  hints.has_clickfix_instruction_text = detectClickfixInstruction(surfaceText);
  hints.has_real_captcha_widget = detectRealCaptchaWidget(iframes, scriptOrigins);

  if (!hasCredentialLikeForm(fieldProfile, forms)) {
    hints.has_standalone_checkbox = hasStandaloneCheckbox();
  }

  return hints;
}
