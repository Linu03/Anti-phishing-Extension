import type { ClipboardShellWrite } from "../layers/behavioral/types";

const MAX_WRITES = 4;
const GESTURE_WINDOW_MS = 5000;

const SHELL_PAYLOAD_RE =
  /(powershell|cmd\.exe|\bcmd\b|mshta|curl\s|wget\s|bash|\/bin\/|chmod\s|reg\s+add|certutil|bitsadmin|\becho\s|iex\(|invoke-expression|start-process)/i;

type CaptureState = {
  writes: ClipboardShellWrite[];
  gestureUntil: number;
  installed: boolean;
  dispose: (() => void) | null;
};

let state: CaptureState | null = null;

function looksShellPayload(text: string): boolean {
  const snippet = text.trim();
  if (snippet === "") {
    return false;
  }
  return SHELL_PAYLOAD_RE.test(snippet);
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

function recordWrite(text: string): void {
  if (state === null || !gestureActive()) {
    return;
  }
  const snippet = text.trim().slice(0, 240);
  if (snippet === "") {
    return;
  }
  if (!looksShellPayload(snippet)) {
    return;
  }
  if (state.writes.length >= MAX_WRITES) {
    return;
  }
  state.writes.push({
    snippet,
    looks_shell: true,
  });
}

export function getClipboardShellWritesSnapshot(): ClipboardShellWrite[] {
  if (state === null) {
    return [];
  }
  return state.writes.map((item) => ({ ...item }));
}

export function installClickfixClipboardCapture(): { dispose: () => void } {
  if (state !== null && state.installed) {
    return { dispose: state.dispose ?? (() => {}) };
  }

  state = {
    writes: [],
    gestureUntil: 0,
    installed: true,
    dispose: null,
  };

  const onGesture = (): void => {
    markUserGesture();
  };

  document.addEventListener("click", onGesture, true);
  document.addEventListener("keydown", onGesture, true);

  const clipboard = navigator.clipboard;
  let restoreWriteText: (() => void) | null = null;

  if (clipboard !== undefined && typeof clipboard.writeText === "function") {
    const original = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text: string): Promise<void> => {
      recordWrite(text);
      return original(text);
    };
    restoreWriteText = () => {
      clipboard.writeText = original;
    };
  }

  const dispose = (): void => {
    document.removeEventListener("click", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
    if (restoreWriteText !== null) {
      restoreWriteText();
    }
    if (state !== null) {
      state.installed = false;
      state.dispose = null;
    }
    state = null;
  };

  state.dispose = dispose;
  return { dispose };
}
