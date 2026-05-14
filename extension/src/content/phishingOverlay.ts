void (() => {
  const g = globalThis as unknown as { __AFS_PERSONAL?: boolean };
  const showRemoveFromBlocklist = g.__AFS_PERSONAL === true;
  delete g.__AFS_PERSONAL;

const ROOT_ID = "anti-phishing-shield-overlay-root";
const FONT_LINK_ID = "afs-aphish-fonts";

const MSG_GO_BACK = "AFS_GO_BACK";
const MSG_REMOVE_PERSONAL = "AFS_REMOVE_PERSONAL";

const COL = {
  surface: "#100e0c",
  border: "#342f2a",
  ink: "#e9e5df",
  inkMuted: "#a39a90",
  inkFaint: "#6b6560",
  accentLine: "#4a6b7c",
  safeBg: "#13251c",
  safeBorder: "#1f3d2e",
  safeText: "#8fb89a",
} as const;

function ensureThemeFonts(): void {
  if (document.getElementById(FONT_LINK_ID)) {
    return;
  }
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap";
  document.head.appendChild(link);
}

function removeOverlay(): void {
  const old = document.getElementById(ROOT_ID);
  if (old) {
    old.remove();
  }
}

function shieldSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${COL.accentLine}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
}

function buildOverlay(): HTMLDivElement {
  ensureThemeFonts();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");

  Object.assign(root.style, {
    boxSizing: "border-box",
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "rgba(16, 14, 12, 0.94)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    fontFamily: '"Source Sans 3", sans-serif',
    color: COL.ink,
  } as CSSStyleDeclaration);

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "100%",
    maxWidth: "360px",
    borderRadius: "6px",
    border: `1px solid ${COL.border}`,
    background: COL.surface,
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    overflow: "hidden",
  } as CSSStyleDeclaration);

  const head = document.createElement("div");
  Object.assign(head.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderBottom: `1px solid ${COL.border}`,
    background: "rgba(26, 23, 20, 0.6)",
  } as CSSStyleDeclaration);

  const iconWrap = document.createElement("div");
  Object.assign(iconWrap.style, {
    flexShrink: "0",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    border: `1px solid ${COL.border}`,
    background: COL.surface,
  } as CSSStyleDeclaration);
  iconWrap.innerHTML = shieldSvg();

  const headText = document.createElement("div");
  headText.style.minWidth = "0";
  const h1 = document.createElement("h1");
  h1.textContent = "Anti-Phishing Shield";
  Object.assign(h1.style, {
    margin: "0",
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: "16px",
    fontWeight: "600",
    lineHeight: "1.25",
    color: COL.ink,
  } as CSSStyleDeclaration);
  const sub = document.createElement("p");
  sub.textContent = "Blocklist match";
  Object.assign(sub.style, {
    margin: "4px 0 0 0",
    fontSize: "11px",
    color: COL.inkMuted,
    fontWeight: "400",
  } as CSSStyleDeclaration);
  headText.appendChild(h1);
  headText.appendChild(sub);

  head.appendChild(iconWrap);
  head.appendChild(headText);

  const body = document.createElement("div");
  body.style.padding = "12px 14px 14px";

  const p1 = document.createElement("p");
  p1.textContent =
    "This URL matches your extension blocklist. Treat it as high risk unless you fully trust it.";
  Object.assign(p1.style, {
    margin: "0 0 10px 0",
    fontSize: "13px",
    lineHeight: "1.55",
    color: COL.inkMuted,
  } as CSSStyleDeclaration);

  const p2 = document.createElement("p");
  p2.textContent = window.location.href;
  Object.assign(p2.style, {
    margin: "0 0 14px 0",
    fontSize: "11px",
    lineHeight: "1.45",
    wordBreak: "break-all",
    color: COL.inkFaint,
  } as CSSStyleDeclaration);

  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    paddingTop: "10px",
    borderTop: `1px solid ${COL.border}`,
  } as CSSStyleDeclaration);

  const btnBase: Partial<CSSStyleDeclaration> = {
    cursor: "pointer",
    borderRadius: "6px",
    padding: "8px 10px",
    fontFamily: '"Source Sans 3", sans-serif',
    fontSize: "11px",
    fontWeight: "600",
    flex: "1 1 88px",
    minWidth: "0",
  };

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Go back";
  Object.assign(backBtn.style, btnBase, {
    border: `1px solid ${COL.safeBorder}`,
    background: COL.safeBg,
    color: COL.safeText,
  } as CSSStyleDeclaration);
  backBtn.addEventListener("click", () => {
    removeOverlay();
    chrome.runtime.sendMessage({ type: MSG_GO_BACK }, () => {
      void chrome.runtime.lastError;
    });
  });

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.textContent = "Continue anyway";
  Object.assign(continueBtn.style, btnBase, {
    border: `1px solid ${COL.border}`,
    background: "transparent",
    color: COL.ink,
  } as CSSStyleDeclaration);
  continueBtn.addEventListener("click", () => {
    const ok = window.confirm(
      "This URL is on your blocklist. Only continue if you fully trust it.",
    );
    if (ok) {
      removeOverlay();
    }
  });

  row.appendChild(backBtn);
  if (showRemoveFromBlocklist) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove from my blocklist";
    Object.assign(removeBtn.style, btnBase, {
      border: `1px solid ${COL.border}`,
      background: "transparent",
      color: COL.ink,
    } as CSSStyleDeclaration);
    removeBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: MSG_REMOVE_PERSONAL }, (res) => {
        void chrome.runtime.lastError;
        const okRemove = res && typeof res === "object" && "removed" in res && (res as { removed: boolean }).removed === true;
        if (okRemove) {
          removeOverlay();
        } else {
          window.alert("This warning is from the public blocklist, not your list.");
        }
      });
    });
    row.appendChild(removeBtn);
  }
  row.appendChild(continueBtn);

  body.appendChild(p1);
  body.appendChild(p2);
  body.appendChild(row);

  card.appendChild(head);
  card.appendChild(body);
  root.appendChild(card);

  return root;
}

function showOverlayIfNeeded(): void {
  if (document.getElementById(ROOT_ID)) {
    return;
  }
  const node = buildOverlay();
  document.documentElement.appendChild(node);
}

showOverlayIfNeeded();
})();
