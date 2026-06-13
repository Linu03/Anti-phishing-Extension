import type { LayerSignal } from "../types";
import type { TlsStepResult } from "./types";

export function buildTlsLayer(step: TlsStepResult): LayerSignal {
  if (step.status === "ok") {
    if (step.findings.length === 0) {
      return {
        id: "tls",
        label: "TLS / Certificate",
        contribution: step.score,
        detail: "No TLS certificate issues.",
        findings: [],
      };
    }

    const lines: string[] = [];
    for (const f of step.findings) {
      lines.push(f.detail);
    }
    const detailText = lines.join(" ");

    return {
      id: "tls",
      label: "TLS / Certificate",
      contribution: step.score,
      detail: detailText,
      findings: step.findings,
    };
  }

  if (step.status === "skipped") {
    return {
      id: "tls",
      label: "TLS / Certificate",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "tls",
    label: "TLS / Certificate",
    contribution: 0,
    detail: "Could not check: " + step.errorMessage,
  };
}
