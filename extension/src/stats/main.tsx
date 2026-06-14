import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import "../styles/stats.css";
import { StatsApp } from "./StatsApp";

const el = document.getElementById("root");
if (!el) throw new Error("Root element missing");

createRoot(el).render(
  <StrictMode>
    <StatsApp />
  </StrictMode>,
);
