import React from "react";
import ReactDOM from "react-dom/client";
import { SonnerToaster, initThemeListener } from "@const/ui";
import { I18nProvider } from "./lib/i18n";
import App from "./App";
import "./index.css";

// Initialize reactive theme listener (respecting saved theme or system preference)
initThemeListener();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
        <SonnerToaster position="top-center" richColors closeButton />
      </I18nProvider>
    </React.StrictMode>
  );
}
