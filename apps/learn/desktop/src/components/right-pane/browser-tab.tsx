import React, { useState } from "react";
import {
  Globe,
  RotateCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { RightPaneTab } from "./types";
import { useI18n } from "../../lib/i18n";

interface BrowserTabProps {
  tab: RightPaneTab;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
}

export function BrowserTab({ tab, onUpdateTab }: BrowserTabProps) {
  const { language } = useI18n();
  const [urlInput, setUrlInput] = useState(tab.url || "https://google.com");
  const [currentUrl, setCurrentUrl] = useState(tab.url || "https://google.com");
  const [preset, setPreset] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let target = urlInput.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
    }
    setCurrentUrl(target);
    onUpdateTab?.(tab.id, { url: target });
  };

  const handleOpenExternal = () => {
    const electron = (window as any).electron;
    if (electron?.openExternal) {
      electron.openExternal(currentUrl);
    } else {
      window.open(currentUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#141414] overflow-hidden select-none font-sans">
      {/* Browser Navigation Bar */}
      <div className="h-10 px-3 border-b border-[#282828] bg-[#1a1a1a] flex items-center justify-between gap-2 shrink-0">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Back"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Forward"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUpdateTab?.(tab.id, { url: currentUrl })}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Reload"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121212] border border-[#333333] focus-within:border-blue-500/70 text-xs transition-colors">
            <Globe className="w-3.5 h-3.5 text-[#666666] shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter web URL..."
              className="w-full bg-transparent text-white outline-none placeholder-[#666666] text-xs font-mono"
            />
          </div>
        </form>

        {/* Viewport Presets & External Button */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-[#222222] p-0.5 rounded border border-[#2e2e2e]">
            <button
              type="button"
              onClick={() => setPreset("desktop")}
              className={`p-1 rounded transition-colors cursor-pointer ${
                preset === "desktop" ? "bg-[#333] text-white" : "text-[#888] hover:text-white"
              }`}
              title="Desktop View"
            >
              <Monitor className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setPreset("tablet")}
              className={`p-1 rounded transition-colors cursor-pointer ${
                preset === "tablet" ? "bg-[#333] text-white" : "text-[#888] hover:text-white"
              }`}
              title="Tablet View"
            >
              <Tablet className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setPreset("mobile")}
              className={`p-1 rounded transition-colors cursor-pointer ${
                preset === "mobile" ? "bg-[#333] text-white" : "text-[#888] hover:text-white"
              }`}
              title="Mobile View"
            >
              <Smartphone className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-1"
            title="Open in default browser"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Browser Viewport Area / Placeholder */}
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center p-4 bg-[#111111]">
        <div
          className={`h-full border border-[#282828] rounded-xl bg-[#161618] flex flex-col items-center justify-center p-6 text-center transition-all shadow-xl ${
            preset === "mobile"
              ? "w-[375px]"
              : preset === "tablet"
              ? "w-[640px]"
              : "w-full"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#888888] mb-3 shadow-inner">
            <Globe className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1.5">
            {language === "id" ? "Pratinjau Peramban Web" : "Web Browser View"}
          </h3>
          <p className="text-xs text-[#888888] max-w-sm leading-relaxed mb-4">
            {language === "id"
              ? `Halaman web untuk "${currentUrl}" siap untuk integrasi webview interaktif berikutnya.`
              : `Web container for "${currentUrl}" is ready for subsequent interactive browser engine integration.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenExternal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#252528] hover:bg-[#303035] text-white text-xs font-medium border border-[#383838] transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === "id" ? "Buka di Browser Luar" : "Open in External Browser"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
