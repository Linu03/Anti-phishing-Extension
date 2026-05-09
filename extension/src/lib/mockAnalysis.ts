import type { AnalysisSnapshot } from "./types";

// Date de test 
export const mockAnalysis: AnalysisSnapshot = {
  threatScore: 67,
  verdict: "high_risk",
  pageUrl: "https://paypaI-verify.example.co/secure/login",
  pageTitle: "Sign in — Account security",
  lastChecked: "acum câteva secunde",
  layers: [
    {
      id: "blacklist",
      label: "Blacklist",
      contribution: 38,
      detail: "Potrivire parțială cu feed-uri publice (simulare).",
    },
    {
      id: "url",
      label: "Analiză URL",
      contribution: 18,
      detail: "Entropie ridicată în subdomeniu; posibil typosquatting.",
    },
    {
      id: "tls",
      label: "TLS / certificat",
      contribution: 6,
      detail: "Certificat recent; emitent neclasificat.",
    },
    {
      id: "dom",
      label: "Șablon pagină",
      contribution: 5,
      detail: "Formular parolă vizibil; structură asemănătoare login.",
    },
  ],
};
