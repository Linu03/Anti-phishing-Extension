import type { LayerSignal } from "../types";
import type { WhitelistStepResult } from "./types";

const POINTS_IF_TRUSTED = -15;

export function buildWhitelistLayer(step: WhitelistStepResult): LayerSignal {

  if (step.status === "trusted") 
  {
    return {
      id: "whitelist",
      label: "Whitelist",
      contribution: POINTS_IF_TRUSTED,
      detail: "This site is on your trusted list.",
      findings: [
        {
          rule: "whitelist_trusted",
          points: POINTS_IF_TRUSTED,
          detail: "This site is on your trusted list.",
        },
      ],
    };
  }

  if (step.status === "clear") {
    return {
      id: "whitelist",
      label: "Whitelist",
      contribution: 0,
      detail: "Not on your trusted list.",
    };
  }

  return {
    id: "whitelist",
    label: "Whitelist",
    contribution: 0,
    detail: step.reason,
  };
}
