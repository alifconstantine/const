import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@const/ui";
import App from "./App";
import { initThemeListener } from "./lib/theme";
import { I18nProvider } from "./lib/i18n";
import { ensureDefaultSkillsSeeded } from "./lib/skills/skills-service";
import "./index.css";

// Initialize system theme listener & seed agent skills catalog
initThemeListener();
ensureDefaultSkillsSeeded().catch((err) => console.warn("Failed to seed skills on startup:", err));

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
        <Toaster position="bottom-right" />
      </I18nProvider>
    </React.StrictMode>
  );
}
