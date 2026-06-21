import type { AnalysisSnapshot } from "../types";
import { hostFromInput } from "../urlHost";
import type { ExplainAudience, ExplainRequest } from "./types";

export function buildExplainPayload(snapshot: AnalysisSnapshot,audience: ExplainAudience): ExplainRequest {
  const sourceLayers = audience === "plain" || audience === "technical"
      ? snapshot.layers.filter((layer) => layer.contribution !== 0)
      : snapshot.layers;

  const layers = sourceLayers.map((layer) => {
    const findings = layer.findings ?? [];
    return {
      id: layer.id,
      label: layer.label,
      contribution: layer.contribution,
      detail: layer.detail,
      findings: findings.map((finding) => ({
        rule: finding.rule,
        points: finding.points,
        detail: finding.detail,
      })),
    };
  });

  return {
    threat_score: snapshot.threatScore,
    verdict: snapshot.verdict,
    page_url: snapshot.pageUrl,
    page_host: hostFromInput(snapshot.pageUrl),
    audience,
    layers,
  };
}
