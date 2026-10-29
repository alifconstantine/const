import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster, initThemeListener } from "@const/ui";
import App from "./App";
import "./index.css";

// Initialize system / saved theme listener
initThemeListener();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
      <Toaster position="bottom-center" />
    </React.StrictMode>,
  );
}
