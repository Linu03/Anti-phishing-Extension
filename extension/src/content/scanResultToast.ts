void (() => {
  type ToastPayload = {
    verdict: "caution" | "high_risk";
    label: string;
  };

  const g = globalThis as unknown as { __AFS_SCAN_TOAST?: ToastPayload };
  const payload = g.__AFS_SCAN_TOAST;
  delete g.__AFS_SCAN_TOAST;

  if (!payload || (payload.verdict !== "caution" && payload.verdict !== "high_risk")) {
    return;
  }

  const ROOT_ID = "anti-phishing-shield-scan-toast";

  const COL = {
    surface: "#100e0c",
    border: "#342f2a",
    ink: "#e9e5df",
    inkMuted: "#a39a90",
    warn: "#fbbf24",
    danger: "#f87171",
    warnBg: "rgba(120, 53, 15, 0.92)",
    dangerBg: "rgba(127, 29, 29, 0.92)",
  } as const;

  function removeToast(): void {
    const old = document.getElementById(ROOT_ID);
    if (old) {
      old.remove();
    }
  }

  removeToast();

  const isHigh = payload.verdict === "high_risk";
  const accent = isHigh ? COL.danger : COL.warn;
  const bg = isHigh ? COL.dangerBg : COL.warnBg;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("role", "status");
  Object.assign(root.style, {
    boxSizing: "border-box",
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483646",
    width: "min(320px, calc(100vw - 24px))",
    borderRadius: "8px",
    border: `1px solid ${COL.border}`,
    background: bg,
    backdropFilter: "blur(8px)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    color: COL.ink,
    overflow: "hidden",
  } as CSSStyleDeclaration);

  const inner = document.createElement("div");
  Object.assign(inner.style, {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
  } as CSSStyleDeclaration);

  const icon = document.createElement("div");
  icon.textContent = "!";
  Object.assign(icon.style, {
    flexShrink: "0",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    border: `1px solid ${accent}`,
    color: accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: "1",
  } as CSSStyleDeclaration);

  const textWrap = document.createElement("div");
  textWrap.style.minWidth = "0";
  textWrap.style.flex = "1";

  const title = document.createElement("p");
  title.textContent = "Anti-Phishing Shield";
  Object.assign(title.style, {
    margin: "0 0 2px 0",
    fontSize: "11px",
    fontWeight: "600",
    color: COL.inkMuted,
    letterSpacing: "0.02em",
  } as CSSStyleDeclaration);

  const message = document.createElement("p");
  message.textContent = `Scan complete — ${payload.label}. Open the extension to review.`;
  Object.assign(message.style, {
    margin: "0",
    fontSize: "13px",
    lineHeight: "1.45",
    color: COL.ink,
    fontWeight: "600",
  } as CSSStyleDeclaration);

  textWrap.appendChild(title);
  textWrap.appendChild(message);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    flexShrink: "0",
    border: "none",
    background: "transparent",
    color: COL.inkMuted,
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: "1",
    padding: "0",
    marginTop: "-2px",
  } as CSSStyleDeclaration);
  closeBtn.addEventListener("click", removeToast);

  inner.appendChild(icon);
  inner.appendChild(textWrap);
  inner.appendChild(closeBtn);
  root.appendChild(inner);

  root.style.opacity = "0";
  root.style.transform = "translateY(-6px)";
  root.style.transition = "opacity 180ms ease, transform 180ms ease";

  document.documentElement.appendChild(root);

  requestAnimationFrame(() => {
    root.style.opacity = "1";
    root.style.transform = "translateY(0)";
  });

  window.setTimeout(removeToast, 12000);
})();
