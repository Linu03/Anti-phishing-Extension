import type { LayerFinding, LayerSignal } from "../types";

/** Max extra score from stacked combo patterns (applied after per-layer caps). */
const COMBO_LAYER_CAP = 35;

type ComboDef = {
  rule: string;
  points: number;
  detail: string;
  matches: (rules: Set<string>, findings: LayerFinding[]) => boolean;
};

function collectFindings(layers: LayerSignal[]): LayerFinding[] {
  const out: LayerFinding[] = [];
  for (const layer of layers) {
    if (layer.findings) {
      out.push(...layer.findings);
    }
  }
  return out;
}

function hasRule(rules: Set<string>, rule: string): boolean {
  return rules.has(rule);
}

function findingByRule(findings: LayerFinding[], rule: string): LayerFinding | undefined {
  return findings.find((item) => item.rule === rule);
}

const COMBOS: ComboDef[] = [
  {
    rule: "combo_card_harvest_ro",
    points: 22,
    detail:
      "Romanian bank/tax scam pattern: fake brand page collecting card data and CNP/identity together.",
    matches: (rules, findings) => {
      if (!hasRule(rules, "brand_page_host_mismatch")) {
        return false;
      }
      if (!hasRule(rules, "sensitive_field_collection")) {
        return false;
      }
      const sensitive = findingByRule(findings, "sensitive_field_collection");
      if (!sensitive) {
        return false;
      }
      const detail = sensitive.detail.toLowerCase();
      return detail.includes("payment and identity") || sensitive.points >= 20;
    },
  },
  {
    rule: "combo_free_hosting_kit",
    points: 18,
    detail:
      "Free site-builder hosting combined with brand impersonation — common for quick phishing kits.",
    matches: (rules) => {
      if (!hasRule(rules, "brand_page_host_mismatch")) {
        return false;
      }
      return (
        hasRule(rules, "credential_form_on_free_hosting") ||
        hasRule(rules, "hosting_brand_matrix")
      );
    },
  },
  {
    rule: "combo_aitm_proxy",
    points: 12,
    detail:
      "Adversary-in-the-middle pattern: fake login surface on a foreign host posting to the real identity provider.",
    matches: (rules) =>
      hasRule(rules, "oauth_aitm_login_surface") &&
      hasRule(rules, "idp_form_on_foreign_host"),
  },
  {
    rule: "combo_typosquat_confirmed",
    points: 12,
    detail: "Typosquatted domain confirmed by on-page brand impersonation.",
    matches: (rules) =>
      hasRule(rules, "typosquatting") && hasRule(rules, "brand_page_host_mismatch"),
  },
  {
    rule: "combo_marketplace_delivery_ro",
    points: 14,
    detail:
      "Marketplace or courier delivery scam: lure URL plus sensitive payment fields (eMAG/OLX/FanCourier style).",
    matches: (rules) => {
      if (!hasRule(rules, "sensitive_field_collection")) {
        return false;
      }
      return (
        hasRule(rules, "combosquatting_label") ||
        (hasRule(rules, "hosting_brand_matrix") && hasRule(rules, "brand_page_host_mismatch"))
      );
    },
  },
  {
    rule: "combo_manipulation_phish",
    points: 10,
    detail:
      "Psychological pressure (urgency, fake authority, crowd numbers) on an already suspicious page.",
    matches: (rules) =>
      hasRule(rules, "psychological_manipulation_surface") &&
      (hasRule(rules, "brand_page_host_mismatch") ||
        hasRule(rules, "sensitive_field_collection")),
  },
  {
    rule: "combo_clickfix_partial",
    points: 18,
    detail:
      "ClickFix-style lure (fake CAPTCHA / terminal steps) without a full behavioral chain yet detected.",
    matches: (rules) => {
      if (hasRule(rules, "clickfix_full_chain")) {
        return false;
      }
      if (hasRule(rules, "clickfix_lure_surface")) {
        return true;
      }
      return (
        hasRule(rules, "fake_captcha_surface") &&
        hasRule(rules, "clickfix_clipboard_shell")
      );
    },
  },
  {
    rule: "combo_redirect_exfil",
    points: 15,
    detail:
      "Rapid redirect into a page that exfiltrates form data via JavaScript — common courier/banking lure chain.",
    matches: (rules) =>
      hasRule(rules, "rapid_cross_domain_redirect") && hasRule(rules, "js_exfil_submit"),
  },
  {
    rule: "combo_credential_evasion",
    points: 12,
    detail:
      "Credential form hidden or obfuscated (hidden password, excessive hidden fields) on a non-official brand host.",
    matches: (rules) => {
      if (!hasRule(rules, "brand_page_host_mismatch")) {
        return false;
      }
      return (
        hasRule(rules, "hidden_password_field") ||
        hasRule(rules, "excessive_hidden_inputs")
      );
    },
  },
];

export function buildComboBoostLayer(layers: LayerSignal[]): LayerSignal {
  const findings = collectFindings(layers);
  const rules = new Set(findings.map((item) => item.rule));

  if (rules.has("whitelist_trusted")) {
    return {
      id: "combo-boosts",
      label: "Threat patterns",
      contribution: 0,
      detail: "No stacked threat patterns.",
    };
  }

  const triggered: LayerFinding[] = [];
  for (const combo of COMBOS) {
    if (combo.matches(rules, findings)) {
      triggered.push({
        rule: combo.rule,
        points: combo.points,
        detail: combo.detail,
      });
    }
  }

  if (triggered.length === 0) {
    return {
      id: "combo-boosts",
      label: "Threat patterns",
      contribution: 0,
      detail: "No stacked threat patterns.",
    };
  }

  let contribution = 0;
  for (const item of triggered) {
    contribution = contribution + item.points;
  }
  if (contribution > COMBO_LAYER_CAP) {
    contribution = COMBO_LAYER_CAP;
  }

  const sorted = [...triggered].sort((a, b) => b.points - a.points);
  const detail = sorted.map((item) => item.detail).join(" ");

  return {
    id: "combo-boosts",
    label: "Threat patterns",
    contribution,
    detail,
    findings: triggered,
  };
}
