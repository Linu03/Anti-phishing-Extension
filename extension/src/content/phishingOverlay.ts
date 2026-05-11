const ROOT_ID = "anti-phishing-shield-overlay-root";

function removeOverlay(): void {
  const old = document.getElementById(ROOT_ID);
  if (old) {
    old.remove();
  }
}

function buildOverlay(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");

  root.style.boxSizing = "border-box";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2147483647";
  root.style.background = "rgba(15, 23, 42, 0.92)";
  root.style.color = "#f8fafc";
  root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.padding = "24px";

  const card = document.createElement("div");
  card.style.maxWidth = "520px";
  card.style.width = "100%";
  card.style.borderRadius = "16px";
  card.style.padding = "24px";
  card.style.background = "#0f172a";
  card.style.border = "1px solid #f87171";
  card.style.boxShadow = "0 24px 80px rgba(185, 69, 69, 0.45)";

  const title = document.createElement("h1");
  title.textContent = "High-risk site warning";
  title.style.margin = "0 0 12px 0";
  title.style.fontSize = "22px";
  title.style.lineHeight = "1.2";

  const p1 = document.createElement("p");
  p1.textContent = "This URL is on the OpenPhish blocklist. Very strong phishing signal.";
  p1.style.margin = "0 0 12px 0";
  p1.style.fontSize = "15px";
  p1.style.lineHeight = "1.5";
  p1.style.color = "#e2e8f0";

  const p2 = document.createElement("p");
  p2.textContent = `Page: ${window.location.href}`;
  p2.style.margin = "0 0 20px 0";
  p2.style.fontSize = "13px";
  p2.style.wordBreak = "break-all";
  p2.style.color = "#94a3b8";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "12px";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Go back";
  backBtn.style.flex = "1 1 160px";
  backBtn.style.cursor = "pointer";
  backBtn.style.borderRadius = "10px";
  backBtn.style.border = "none";
  backBtn.style.padding = "12px 14px";
  backBtn.style.fontWeight = "700";
  backBtn.style.fontSize = "14px";
  backBtn.style.background = "#22c55e";
  backBtn.style.color = "#052e16";

  backBtn.addEventListener("click", () => {
    removeOverlay();
    window.history.back();
  });

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.textContent = "Continue anyway";
  continueBtn.style.flex = "1 1 200px";
  continueBtn.style.cursor = "pointer";
  continueBtn.style.borderRadius = "10px";
  continueBtn.style.border = "1px solid #64748b";
  continueBtn.style.padding = "12px 14px";
  continueBtn.style.fontWeight = "700";
  continueBtn.style.fontSize = "14px";
  continueBtn.style.background = "transparent";
  continueBtn.style.color = "#e2e8f0";

  continueBtn.addEventListener("click", () => {
    const ok = window.confirm("Are you sure? This URL is on a phishing blocklist. Only continue if you fully trust it.");
    if (ok) {
      removeOverlay();
    }
  });

  row.appendChild(backBtn);
  row.appendChild(continueBtn);

  card.appendChild(title);
  card.appendChild(p1);
  card.appendChild(p2);
  card.appendChild(row);
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
