import React from "react";
import ReactDOM from "react-dom/client";
import { SonnerToaster } from "@const/ui";
import App from "./App";
import "./index.css";

// Ensure dark mode class is active by default
if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
      <SonnerToaster position="top-center" richColors closeButton />
    </React.StrictMode>
  );
}
