import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster, initThemeListener } from "@const/ui";
import { I18nProvider } from "./lib/i18n";
import App from "./App";
import "./index.css";
import "katex/dist/katex.min.css";

// Initialize reactive theme listener (respecting saved theme or system preference)
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
