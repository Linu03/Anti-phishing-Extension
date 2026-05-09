import type { Verdict } from "./types";

export function verdictLabel(v: Verdict): string {
  switch (v) {
    case "safe":
      return "Scăzut";
    case "caution":
      return "Atenție";
    case "high_risk":
      return "Risc ridicat";
  }
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
