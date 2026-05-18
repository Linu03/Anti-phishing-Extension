import type { LayerSignal } from "../types";
import type { BlocklistStepResult } from "./types";

const POINTS_IF_ON_BLOCKLIST = 72;

export function buildBlocklistLayer(step: BlocklistStepResult): LayerSignal {
  if (step.status === "listed") {
    const src =
      step.sources.length > 0
        ? ` Sources: ${step.sources.join(", ")}.`
        : "";
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: POINTS_IF_ON_BLOCKLIST,
      detail: `This URL matches the blocklist.${src}`,
    };
  }

  if (step.status === "clear") {
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: 0,
      detail: "No blocklist match.",
    };
  }

  if (step.status === "skipped") {
    return {
      id: "blocklist",
      label: "Blocklist",
      contribution: 0,
      detail: step.reason,
    };
  }

  return {
    id: "blocklist",
    label: "Blocklist",
    contribution: 0,
    detail: `Could not check: ${step.errorMessage}`,
  };
}
