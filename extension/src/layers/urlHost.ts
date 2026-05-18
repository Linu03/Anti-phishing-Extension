export function hostFromInput(input: string): string {
  let s = input.trim();
  if (s === "") {
    return "";
  }
  if (!s.includes("://")) {
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "";
    }
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}
