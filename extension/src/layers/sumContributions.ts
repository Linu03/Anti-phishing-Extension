import type { LayerSignal } from "./types";

export function sumLayerContributions(layers: LayerSignal[]): number {
  let total = 0;
  for (let i = 0; i < layers.length; i++) {
    total = total + layers[i].contribution;
  }
  if (total < 0) {
    total = 0;
  }
  if (total > 100) {
    total = 100;
  }
  return total;
}
