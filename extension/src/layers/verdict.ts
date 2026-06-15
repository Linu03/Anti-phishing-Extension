import type { Verdict } from "./types";

export function verdictLabel(v: Verdict): string {
  if (v === "safe") return "Low risk";
  if (v === "caution") return "Medium risk";
  return "High risk";
}

export function verdictFromScore(score: number): Verdict {
  if (score < 30) return "safe";
  if (score < 60) return "caution";
  return "high_risk";
}

export function scoreHue(score: number): string {
  if (score < 30) return "#34d399";
  if (score < 60) return "#fbbf24";
  return "#f87171";
}
