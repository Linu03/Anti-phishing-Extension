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
  "imediat",
  "immediately",
  "plata va fi anulată",
  "payment will be cancelled",
  "datele vor fi șterse",
  "data will be deleted",
] as const;

const URGENCY_FEAR_REGEXES = [
  /\b(expir|expire)[a-zăâîșț]*\b.{0,40}\b\d{1,3}\s*(minute|min|ore|hour|hours|zile|days)\b/i,
  /\b\d{1,2}:\d{2}:\d{2}\b/,
  /\bsuspend(at|ed|area|are)?\b/i,
  /\bcompromis|compromised\b/i,
] as const;

const SOCIAL_PROOF_REGEXES = [
  /\b\d{2,}[\d.,\s]*\s*(persoane|people|users|utilizatori)\b/i,
  /\b(peste|over|more than)\s+\d{2,}\b/i,
  /\bultimele\s+\d{1,3}\s+(locuri|places|spots)\b/i,
  /\b\d+\s+de\s+persoane\b/i,
  /\b\d{2,}\s+(persoane|utilizatori).{0,50}(verific|confirm|completeaz|checking|viewing)/i,
  /\b(verific|confirm).{0,40}(acum|now|astăzi|today)\b/i,
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
  const text = normalizedBodyText();
  const hints = emptyManipulationSurfaceHints();

  if (text === "") {
    return hints;
  }

  hints.has_urgency_fear_pressure = detectUrgencyFearPressure(text);
  hints.has_fake_social_proof_numeric = detectFakeSocialProofNumeric(text);
  hints.has_false_authority_language = detectFalseAuthorityLanguage(text);

  return hints;
}
