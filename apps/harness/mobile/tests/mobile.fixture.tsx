import React from "react";
import { createRoot } from "react-dom/client";
import { initThemeListener } from "@const/ui";
import App from "../src/App";
import "../src/index.css";

// Isolated, unsigned fixture credentials; this preview never contacts a backend.
localStorage.setItem("const_harness_token", `fixture.${btoa(JSON.stringify({ sub: "fixture-user|fixture-session" }))}.unsigned`);
initThemeListener();
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
