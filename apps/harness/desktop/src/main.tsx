import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@const/ui";
import App from "./App";
import { initThemeListener } from "./lib/theme";
import { I18nProvider } from "./lib/i18n";
import "./index.css";

// Initialize system theme listener
initThemeListener();

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
