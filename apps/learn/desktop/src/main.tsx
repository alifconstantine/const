import React from "react";
import ReactDOM from "react-dom/client";
import { SonnerToaster, initThemeListener } from "@const/ui";
import { I18nProvider } from "./lib/i18n";
import { ErrorBoundary } from "./components/ui/error-boundary";
import App from "./App";
import "./index.css";
import "katex/dist/katex.min.css";

// Initialize reactive theme listener (respecting saved theme or system preference)
initThemeListener();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary title="Aplikasi mengalami kendala" description="Terjadi kesalahan tak terduga pada antarmuka. Silakan muat ulang atau coba lagi.">
        <I18nProvider>
          <App />
          <SonnerToaster position="top-center" richColors closeButton />
        </I18nProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
