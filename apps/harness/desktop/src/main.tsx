import React from "react";
import ReactDOM from "react-dom/client";
import { SonnerToaster } from "@const/ui";
import App from "./App";
import { initThemeListener } from "./lib/theme";
import "./index.css";

// Initialize system theme listener
initThemeListener();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
      <SonnerToaster position="top-center" richColors closeButton />
    </React.StrictMode>
  );
}
