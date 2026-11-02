import React from "react";
import { createRoot } from "react-dom/client";
import { initThemeListener } from "@const/ui";
import App from "../src/App";
import "../src/index.css";
import { RELEASES_API } from "../../shared/updates/releases";

// Keep update checks local to this account/session fixture as well.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  return url.startsWith(RELEASES_API) ? Promise.resolve(Response.json({ release: null })) : originalFetch(input, init);
};

// Isolated, unsigned fixture credentials; this preview never contacts a backend.
localStorage.setItem("const_harness_token", `fixture.${btoa(JSON.stringify({ sub: "fixture-user|fixture-session" }))}.unsigned`);
initThemeListener();
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
