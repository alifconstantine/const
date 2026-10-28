// Synthetic UI fixture only. No accounts, relay, credentials, or model calls.
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "../src/context/I18nContext";
import { RemoteWorkspace } from "../src/components/remote/remote-workspace";
import "../src/app/globals.css";
sessionStorage.setItem("const_remote_token", "synthetic-test-token");
sessionStorage.setItem("const_remote_key:fixture", "A".repeat(43));
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark">
    <I18nProvider>
      <RemoteWorkspace
        sessionId="fixture"
        convexUrl="https://fixture.invalid"
      />
    </I18nProvider>
  </ThemeProvider>,
);
