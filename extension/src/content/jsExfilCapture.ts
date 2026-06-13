import type { JsExfilAttempt } from "../layers/behavioral/types";
import {
  isPostLikeMethod,
  isTrustedExfilPld,
  registeredDomainFromHost,
} from "../layers/behavioral/jsExfilAllowlist";

const MAX_ATTEMPTS = 8;
const GESTURE_WINDOW_MS = 5000;

const PAYMENT_IDENTITY_HINTS = [
  "cardnumber",
  "card-number",
  "cc-number",
  "cvv",
  "cvc",
  "cnp",
  "ssn",
  "otp",
  "2fa",
  "mfa",
] as const;

type CaptureState = {
  pageHost: string;
  pagePld: string;
  attempts: JsExfilAttempt[];
  gestureUntil: number;
  installed: boolean;
  dispose: (() => void) | null;
};

let state: CaptureState | null = null;

function resolveRequestUrl(raw: string, pageHref: string): URL | null {
  const text = raw.trim();
  if (text === "") {
    return null;
  }
  try {
    return new URL(text, pageHref);
  } catch {
    return null;
  }
}

function pageHasSensitiveInputs(): boolean {
  try {
    const inputs = document.querySelectorAll("input, select, textarea");
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLSelectElement)) {
        continue;
      }

      const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : "";
      if (type === "password") {
        return true;
      }

      const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
      if (autocomplete.includes("cc-") || autocomplete.includes("one-time-code")) {
        return true;
      }

      const meta = `${el.getAttribute("name") || ""} ${el.getAttribute("id") || ""} ${autocomplete}`.toLowerCase();
      for (let j = 0; j < PAYMENT_IDENTITY_HINTS.length; j++) {
        if (meta.includes(PAYMENT_IDENTITY_HINTS[j])) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

function markUserGesture(): void {
  if (state === null) {
    return;
  }
  state.gestureUntil = Date.now() + GESTURE_WINDOW_MS;
}

function gestureActive(): boolean {
  return state !== null && Date.now() <= state.gestureUntil;
}

function shouldCapture(method: string): boolean {
  if (state === null || !state.installed) {
    return false;
  }
  if (!gestureActive()) {
    return false;
  }
  if (!pageHasSensitiveInputs()) {
    return false;
  }
  if (!isPostLikeMethod(method) && method.toUpperCase() !== "BEACON") {
    return false;
  }
  return true;
}

function recordAttempt(url: URL, method: string, via: JsExfilAttempt["via"]): void {
  if (state === null) {
    return;
  }

  const destHost = url.hostname.toLowerCase();
  if (destHost === "") {
    return;
  }

  const destPld = registeredDomainFromHost(destHost);
  if (destPld === "" || destPld === state.pagePld) {
    return;
  }

  if (isTrustedExfilPld(destPld)) {
    return;
  }

  const attempt: JsExfilAttempt = {
    dest_host: destHost,
    dest_origin: url.origin,
    method: method.toUpperCase(),
    via,
  };

  for (let i = 0; i < state.attempts.length; i++) {
    const existing = state.attempts[i];
    if (
      existing.dest_host === attempt.dest_host &&
      existing.via === attempt.via &&
      existing.method === attempt.method
    ) {
      return;
    }
  }

  if (state.attempts.length >= MAX_ATTEMPTS) {
    return;
  }

  state.attempts.push(attempt);
}

function bindUserGestureListeners(): () => void {
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.closest(
        'button, input[type="submit"], input[type="button"], input[type="image"], [role="button"]',
      ) !== null
    ) {
      markUserGesture();
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      markUserGesture();
    }
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}

function installNetworkHooks(pageHref: string): () => void {
  const nativeFetch = window.fetch.bind(window);
  const nativeBeacon = navigator.sendBeacon.bind(navigator);
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toString();
    if (shouldCapture(method)) {
      let rawUrl = "";
      if (typeof input === "string") {
        rawUrl = input;
      } else if (input instanceof URL) {
        rawUrl = input.href;
      } else if (input instanceof Request) {
        rawUrl = input.url;
      }
      const resolved = resolveRequestUrl(rawUrl, pageHref);
      if (resolved !== null) {
        recordAttempt(resolved, method, "fetch");
      }
    }
    return nativeFetch(input, init);
  }) as typeof window.fetch;

  navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null): boolean => {
    if (shouldCapture("BEACON")) {
      const rawUrl = typeof url === "string" ? url : url.href;
      const resolved = resolveRequestUrl(rawUrl, pageHref);
      if (resolved !== null) {
        recordAttempt(resolved, "POST", "sendBeacon");
      }
    }
    return nativeBeacon(url, data);
  }) as typeof navigator.sendBeacon;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    (this as XMLHttpRequest & { __afsMethod?: string; __afsUrl?: string }).__afsMethod = method;
    (this as XMLHttpRequest & { __afsMethod?: string; __afsUrl?: string }).__afsUrl =
      typeof url === "string" ? url : url.href;
    return xhrOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const meta = this as XMLHttpRequest & { __afsMethod?: string; __afsUrl?: string };
    const method = meta.__afsMethod || "GET";
    const rawUrl = meta.__afsUrl || "";
    if (shouldCapture(method)) {
      const resolved = resolveRequestUrl(rawUrl, pageHref);
      if (resolved !== null) {
        recordAttempt(resolved, method, "xhr");
      }
    }
    return xhrSend.call(this, body);
  };

  return () => {
    window.fetch = nativeFetch;
    navigator.sendBeacon = nativeBeacon;
    XMLHttpRequest.prototype.open = xhrOpen;
    XMLHttpRequest.prototype.send = xhrSend;
  };
}

export function installJsExfilCapture(pageHref: string): {
  getAttempts: () => JsExfilAttempt[];
  dispose: () => void;
} {
  let pageHost = "";
  try {
    pageHost = new URL(pageHref).hostname.toLowerCase();
  } catch {
    pageHost = "";
  }

  if (state !== null && state.pageHost === pageHost && state.installed) {
    return {
      getAttempts: () => [...state!.attempts],
      dispose: () => {
        state?.dispose?.();
        state = null;
      },
    };
  }

  if (state !== null) {
    state.dispose?.();
  }

  const captureState: CaptureState = {
    pageHost,
    pagePld: registeredDomainFromHost(pageHost),
    attempts: [],
    gestureUntil: 0,
    installed: true,
    dispose: null,
  };
  state = captureState;

  const unbindGesture = bindUserGestureListeners();
  const unbindNetwork = installNetworkHooks(pageHref);
  captureState.dispose = () => {
    unbindGesture();
    unbindNetwork();
    captureState.installed = false;
  };

  return {
    getAttempts: () => [...captureState.attempts],
    dispose: () => {
      captureState.dispose?.();
      state = null;
    },
  };
}

export function getJsExfilAttemptsSnapshot(): JsExfilAttempt[] {
  if (state === null) {
    return [];
  }
  return [...state.attempts];
}
