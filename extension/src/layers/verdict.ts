import type { Verdict } from "./types";

export function verdictLabel(v: Verdict): string {
  if (v === "safe") return "Low";
  if (v === "caution") return "Medium";
  return "High";
}

export function verdictFromScore(score: number): Verdict {
  if (score < 28) return "safe";
  if (score < 62) return "caution";
  return "high_risk";
}

export function scoreHue(score: number): string {
  if (score < 28) return "#34d399";
  if (score < 62) return "#fbbf24";
  return "#f87171";
}
