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
  const BADGE_SIZE = "36px";

  function removeToast(): void {
    const old = document.getElementById(ROOT_ID);
    if (old) {
      old.remove();
    }
  }

  removeToast();

  const isHigh = payload.verdict === "high_risk";
  const bg = isHigh ? "#dc2626" : "#d97706";

  const root = document.createElement("button");
  root.id = ROOT_ID;
  root.type = "button";
  root.setAttribute("role", "alert");
  root.setAttribute(
    "aria-label",
    `Anti-Phishing Shield: ${payload.label}. Click to dismiss.`,
  );
  root.title = `Anti-Phishing Shield — ${payload.label}. Open the extension for details.`;
  root.textContent = "!";

  Object.assign(root.style, {
    boxSizing: "border-box",
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483646",
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    margin: "0",
    padding: "0",
    border: "none",
    borderRadius: "50%",
    background: bg,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontSize: "20px",
    fontWeight: "800",
    lineHeight: "1",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
    outline: "none",
  } as CSSStyleDeclaration);

  root.addEventListener("click", removeToast);

  root.style.opacity = "0";
  root.style.transform = "scale(0.85)";
  root.style.transition = "opacity 180ms ease, transform 180ms ease";

  document.documentElement.appendChild(root);

  requestAnimationFrame(() => {
    root.style.opacity = "1";
    root.style.transform = "scale(1)";
  });

  window.setTimeout(removeToast, 12000);
})();
