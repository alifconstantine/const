import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@const/ui";
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
      <Toaster position="bottom-right" />
    </React.StrictMode>
  );
}
