export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_BLOCKLIST_API_BASE;
  if (typeof raw === "string" && raw.trim() !== "") {
    let base = raw.trim();
    while (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    return base;
  }
  return "http://127.0.0.1:8000";
}
