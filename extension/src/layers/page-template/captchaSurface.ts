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

const CLICKFIX_INSTRUCTION_PHRASES = [
  "win+r",
  "windows + r",
  "ctrl+v",
  "ctrl + v",
  "press enter",
  "verification command",
  "open run",
  "powershell",
  "clipboard",
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

export function collectCaptchaSurfaceHints(
  fieldProfile: FieldProfile,
  forms: FormSnapshot[],
  iframes: IframeSnapshot[],
  scriptOrigins: string[],
): CaptchaSurfaceHints {
  const hints = emptyCaptchaSurfaceHints();
  const bodyText = normalizedBodyText();

  hints.has_captcha_like_text = textHasAnyPhrase(bodyText, CAPTCHA_TEXT_PHRASES);
  hints.mentions_cloudflare_or_recaptcha =
    bodyText.includes("cloudflare") || bodyText.includes("recaptcha");
  hints.has_clickfix_instruction_text = textHasAnyPhrase(bodyText, CLICKFIX_INSTRUCTION_PHRASES);
  hints.has_real_captcha_widget = detectRealCaptchaWidget(iframes, scriptOrigins);

  if (!hasCredentialLikeForm(fieldProfile, forms)) {
    hints.has_standalone_checkbox = hasStandaloneCheckbox();
  }

  return hints;
}
