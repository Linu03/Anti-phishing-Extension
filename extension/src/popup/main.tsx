import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import { initTheme } from "../settings/applyTheme";
import { PopupApp } from "./PopupApp";

initTheme();

const el = document.getElementById("root");
if (!el) throw new Error("Root element missing");

createRoot(el).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
