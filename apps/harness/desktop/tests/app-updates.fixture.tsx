import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConstLogoIcon } from "@const/ui";
import { PanelLeft } from "lucide-react";
import { UpdateControl } from "../../shared/updates/update-control";
import { updateStrings } from "../../shared/updates/strings";
import type { UpdateClient, UpdateState } from "../../shared/updates/releases";
import "../src/index.css";

let state: UpdateState = { installed: "0.0.2", status: "available", canInstall: true, preferences: { autoCheck: true, autoDownload: false },
  release: { version: "0.0.3", tag: "harness-v0.0.3", date: "2026-11-02T09:00:00Z",
    notes: "## New Features\n- Preview files directly from AI responses.\n- Browse media and documents from Activity.\n\n## Fixes\n- Browser sessions remain isolated between workspaces.\n- Literal code and relative file links are preserved.\n\n## Improvements\n- Compact SidePanel and mobile layouts.\n- English release notes with localized update controls.",
    asset: { name: "Const-Harness-0.0.3.exe", url: "https://example.invalid/never-download", size: 1024, sha256: "0".repeat(64) } } };
const listeners = new Set<(state: UpdateState) => void>();
const emit = (patch: Partial<UpdateState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener(state)); return state; };
let installed = 0;
const client: UpdateClient = {
  getState: async () => state, check: async () => emit({ status: "available", error: undefined }),
  download: async () => emit({ status: "downloading", progress: 37, error: undefined }),
  install: async () => { installed++; return emit({ status: "ready", error: undefined }); },
  setPreferences: async preferences => emit({ preferences }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
function Fixture() {
  const [language, setLanguage] = useState(new URLSearchParams(location.search).get("lang") || "en");
  const [mobile, setMobile] = useState(new URLSearchParams(location.search).has("mobile"));
  useEffect(() => {
    document.documentElement.classList.add("dark");
    (window as any).__updates = { setLanguage, setMobile, emit, installs: () => installed };
  }, []);
  return <div className="h-full bg-background text-foreground p-4"><header className={`flex items-center gap-2 ${mobile ? "w-full" : "w-64"}`}>
    <ConstLogoIcon className="size-6"/><span className="flex-1 text-sm font-medium">Const Harness</span>
    <UpdateControl client={client} labels={updateStrings(language)} language={language} mobile={mobile} />
    {!mobile && <button type="button" aria-label="Collapse sidebar" className="size-7"><PanelLeft className="size-4"/></button>}
  </header><p className="mt-12 max-w-md text-sm text-muted-foreground">UI review fixture. Version 0.0.3 and its release notes are simulated. No file is downloaded or installed.</p></div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
