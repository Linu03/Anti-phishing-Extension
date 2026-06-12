const HIDDEN_FIELD_MAX_PX = 2;

const PASSWORD_HINTS = [
  "password",
  "passwd",
  "passcode",
  "parola",
  "parolă",
  "parole",
] as const;

const NON_PASSWORD_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "checkbox",
  "radio",
  "file",
  "image",
]);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeHintText(text: string): string {
  return stripDiacritics(text.toLowerCase().replace(/\s+/g, " ").trim());
}

export function textContainsPasswordHint(text: string): boolean {
  const normalized = normalizeHintText(text);
  if (normalized === "") {
    return false;
  }

  for (let i = 0; i < PASSWORD_HINTS.length; i++) {
    const hint = PASSWORD_HINTS[i];
    const pattern = new RegExp(`\\b${escapeRegex(hint)}\\b`, "i");
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

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

export function inputIsVisuallyHidden(input: HTMLInputElement): boolean {
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
    if (width <= HIDDEN_FIELD_MAX_PX && height <= HIDDEN_FIELD_MAX_PX) {
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

/** Honeypot / bot-trap fields (e.g. Framer spam traps) must not count as OTP or password. */
export function inputIsHoneypotField(input: HTMLInputElement): boolean {
  if (attrLower(input, "aria-hidden") === "true") {
    return true;
  }

  if (input.tabIndex === -1 && inputIsVisuallyHidden(input)) {
    return true;
  }

  return false;
}

function inputAssociatedLabelText(el: HTMLInputElement | HTMLTextAreaElement): string {
  const id = el.id.trim();
  if (id !== "") {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label !== null) {
        return label.textContent ?? "";
      }
    } catch {
      // ignore
    }
  }

  const parentLabel = el.closest("label");
  if (parentLabel !== null) {
    return parentLabel.textContent ?? "";
  }

  return "";
}

function inputAttributeHints(el: HTMLInputElement | HTMLTextAreaElement): string {
  return [
    attrLower(el, "placeholder"),
    attrLower(el, "name"),
    attrLower(el, "id"),
    attrLower(el, "aria-label"),
    attrLower(el, "autocomplete"),
  ].join(" ");
}

/**
 * Detects password intent from visible cues — not only type="password".
 * Phishers often use type="text" with placeholder/label "password" or "parolă".
 */
export function inputLooksLikePassword(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (NON_PASSWORD_INPUT_TYPES.has(type)) {
      return false;
    }
    if (inputIsHoneypotField(el)) {
      return false;
    }
    if (type === "password") {
      return true;
    }
  }

  const autocomplete = attrLower(el, "autocomplete");
  if (autocomplete === "current-password" || autocomplete === "new-password") {
    return true;
  }

  if (textContainsPasswordHint(inputAttributeHints(el))) {
    return true;
  }

  if (textContainsPasswordHint(inputAssociatedLabelText(el))) {
    return true;
  }

  return false;
}

export function countPasswordLikeInputs(root: ParentNode = document): number {
  let count = 0;

  try {
    const nodes = root.querySelectorAll("input, textarea");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el instanceof HTMLInputElement && inputLooksLikePassword(el)) {
        count = count + 1;
      } else if (el instanceof HTMLTextAreaElement && inputLooksLikePassword(el)) {
        count = count + 1;
      }
    }
  } catch {
    return count;
  }

  return count;
}
