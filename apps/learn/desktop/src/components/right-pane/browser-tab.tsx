import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  X,
  MonitorSmartphone,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Globe,
  Search,
  BookOpen,
  GraduationCap,
  FileText,
} from "lucide-react";
import type { RightPaneTab } from "./types";
import { useI18n } from "../../lib/i18n";

interface BrowserTabProps {
  tab: RightPaneTab;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
}

type ResponsivePreset = "responsive" | "mobile" | "mobile-lg" | "tablet" | "desktop";

interface PresetConfig {
  id: ResponsivePreset;
  label: string;
  width?: number;
  height?: number;
}

const RESPONSIVE_PRESETS: PresetConfig[] = [
  { id: "responsive", label: "Responsive (100%)" },
  { id: "mobile", label: "Mobile (375 × 667)", width: 375 },
  { id: "mobile-lg", label: "Mobile Large (414 × 896)", width: 414 },
  { id: "tablet", label: "Tablet (768 × 1024)", width: 768 },
  { id: "desktop", label: "Desktop (1024 × 768)", width: 1024 },
];

function normalizeUrl(input: any): string {
  if (typeof input !== "string" || !input.trim() || input === "[object Object]") {
    return "";
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === "[object Object]" || trimmed === "about:blank") return "";

  // Check localhost / 127.0.0.1
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Already has protocol
  if (/^[a-zA-Z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Domain with dot (e.g. wikipedia.org, google.com, arxiv.org)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Otherwise search with Google
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function BrowserTab({ tab, onUpdateTab }: BrowserTabProps) {
  const { language } = useI18n();
  const rawInitial = typeof tab.url === "string" && tab.url && tab.url !== "[object Object]" ? tab.url.trim() : "";
  const [currentUrl, setCurrentUrl] = useState<string>(rawInitial);
  const [addressBarInput, setAddressBarInput] = useState<string>(rawInitial);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<{ code: number; desc: string; url: string } | null>(null);

  // Responsive Size Preset
  const [selectedPreset, setSelectedPreset] = useState<ResponsivePreset>("responsive");
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState<boolean>(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  // More Options Menu
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const webviewRef = useRef<any>(null);

  // Keep address bar in sync if tab.url changes from outside
  useEffect(() => {
    if (tab.url !== undefined && typeof tab.url === "string" && tab.url !== "[object Object]") {
      const trimmed = tab.url.trim();
      if (trimmed !== currentUrl) {
        setCurrentUrl(trimmed);
        setAddressBarInput(trimmed);
      }
    }
  }, [tab.url, currentUrl]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
        setIsSizeMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Webview navigation helpers
  const handleNavigate = (targetUrl: string) => {
    const resolved = normalizeUrl(targetUrl);
    if (!resolved) {
      setAddressBarInput("");
      setCurrentUrl("");
      setLoadError(null);
      onUpdateTab?.(tab.id, { url: "", title: language === "id" ? "Peramban Web" : "Web Browser" });
      return;
    }
    setAddressBarInput(resolved);
    setCurrentUrl(resolved);
    setLoadError(null);
    onUpdateTab?.(tab.id, { url: resolved });

    if (webviewRef.current) {
      try {
        webviewRef.current.loadURL(resolved);
      } catch (e) {
        console.error("Failed to load URL:", e);
      }
    }
  };

  const handleGoBack = () => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleReloadOrStop = () => {
    if (!webviewRef.current) return;
    if (isLoading) {
      webviewRef.current.stop();
      setIsLoading(false);
    } else {
      setLoadError(null);
      webviewRef.current.reload();
    }
  };

  const handleOpenExternal = () => {
    setIsMoreMenuOpen(false);
    const url = currentUrl || "https://www.google.com";
    const electron = (window as any).electron;
    if (electron?.openExternal) {
      electron.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyUrl = () => {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    }
    setIsMoreMenuOpen(false);
  };

  const handleHardReload = () => {
    setIsMoreMenuOpen(false);
    if (webviewRef.current) {
      setLoadError(null);
      webviewRef.current.reloadIgnoringCache();
    }
  };

  // Wire up webview native events
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidStartLoading = () => {
      setIsLoading(true);
      setLoadError(null);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      try {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      } catch {}
    };

    const handleDidNavigate = (e: any) => {
      if (e.url) {
        setCurrentUrl(e.url);
        setAddressBarInput(e.url);
        onUpdateTab?.(tab.id, { url: e.url });
      }
      try {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      } catch {}
    };

    const handleDidNavigateInPage = (e: any) => {
      if (e.url) {
        setCurrentUrl(e.url);
        setAddressBarInput(e.url);
        onUpdateTab?.(tab.id, { url: e.url });
      }
      try {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      } catch {}
    };

    const handlePageTitleUpdated = (e: any) => {
      if (e.title) {
        onUpdateTab?.(tab.id, { title: e.title });
      }
    };

    const handlePageFaviconUpdated = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        onUpdateTab?.(tab.id, { favicon: e.favicons[0] });
      }
    };

    const handleDidFailLoad = (e: any) => {
      // Ignore abort errors (code -3)
      if (e.errorCode === -3) return;
      if (e.isMainFrame) {
        setLoadError({
          code: e.errorCode,
          desc: e.errorDescription || "Failed to load page",
          url: e.validatedURL || currentUrl,
        });
      }
    };

    const handleNewWindow = (e: any) => {
      e.preventDefault();
      if (e.url) {
        handleNavigate(e.url);
      }
    };

    webview.addEventListener("did-start-loading", handleDidStartLoading);
    webview.addEventListener("did-stop-loading", handleDidStopLoading);
    webview.addEventListener("did-navigate", handleDidNavigate);
    webview.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
    webview.addEventListener("page-title-updated", handlePageTitleUpdated);
    webview.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
    webview.addEventListener("did-fail-load", handleDidFailLoad);
    webview.addEventListener("new-window", handleNewWindow);

    return () => {
      webview.removeEventListener("did-start-loading", handleDidStartLoading);
      webview.removeEventListener("did-stop-loading", handleDidStopLoading);
      webview.removeEventListener("did-navigate", handleDidNavigate);
      webview.removeEventListener("did-navigate-in-page", handleDidNavigateInPage);
      webview.removeEventListener("page-title-updated", handlePageTitleUpdated);
      webview.removeEventListener("page-favicon-updated", handlePageFaviconUpdated);
      webview.removeEventListener("did-fail-load", handleDidFailLoad);
      webview.removeEventListener("new-window", handleNewWindow);
    };
  }, [tab.id, onUpdateTab, currentUrl]);

  // Viewport preset style
  const activePresetConfig = RESPONSIVE_PRESETS.find((p) => p.id === selectedPreset);
  const isCustomWidth = activePresetConfig && activePresetConfig.width;

  const quickLinks = [
    { label: "Google", icon: Search, url: "https://www.google.com" },
    { label: "Wikipedia", icon: BookOpen, url: "https://www.wikipedia.org" },
    { label: "Google Scholar", icon: GraduationCap, url: "https://scholar.google.com" },
    { label: "arXiv.org", icon: FileText, url: "https://arxiv.org" },
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-background text-foreground select-none overflow-hidden relative font-sans">
      {/* 1. Top Browser Navigation Toolbar */}
      <div className="h-10 w-full bg-card border-b border-border flex items-center px-2 gap-1.5 shrink-0 z-20">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleGoBack}
          disabled={!canGoBack || !currentUrl}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoBack && currentUrl
              ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              : "text-muted-foreground/40 cursor-not-allowed"
          }`}
          title={language === "id" ? "Kembali" : "Click to go back"}
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Forward Button */}
        <button
          type="button"
          onClick={handleGoForward}
          disabled={!canGoForward || !currentUrl}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoForward && currentUrl
              ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              : "text-muted-foreground/40 cursor-not-allowed"
          }`}
          title={language === "id" ? "Maju" : "Click to go forward"}
          aria-label="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Reload / Stop Button */}
        {currentUrl ? (
          <button
            type="button"
            onClick={handleReloadOrStop}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={isLoading ? (language === "id" ? "Hentikan muat" : "Stop loading") : (language === "id" ? "Muat ulang" : "Reload")}
            aria-label="Reload or stop"
          >
            {isLoading ? <X className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
          </button>
        ) : null}

        {/* Address Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNavigate(addressBarInput);
          }}
          className="flex-1 flex items-center min-w-0 mx-1"
        >
          <div className="w-full flex items-center bg-muted/70 hover:bg-muted focus-within:bg-background border border-border focus-within:border-primary/80 rounded-lg px-2.5 py-1 text-xs transition-colors group">
            <Globe className="w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary shrink-0 mr-1.5 transition-colors" />
            <input
              type="text"
              value={addressBarInput}
              onChange={(e) => setAddressBarInput(e.target.value)}
              placeholder={language === "id" ? "Ketik URL atau cari di Google..." : "Enter web address or search..."}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 text-xs font-mono select-text truncate"
            />
            {addressBarInput && (
              <button
                type="button"
                onClick={() => {
                  setAddressBarInput("");
                  if (currentUrl) {
                    handleNavigate("");
                  }
                }}
                className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors ml-1 cursor-pointer"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Viewport Preset Picker */}
        <div className="relative" ref={sizeMenuRef}>
          <button
            type="button"
            onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer border ${
              isCustomWidth
                ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            }`}
            title={activePresetConfig ? `Viewport: ${activePresetConfig.label}` : "Viewport size preset"}
            aria-label="Viewport size preset"
          >
            <MonitorSmartphone className="w-4 h-4" />
          </button>

          {isSizeMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/70">
                {language === "id" ? "Ukuran Tampilan" : "Viewport Presets"}
              </div>
              {RESPONSIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setIsSizeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    selectedPreset === preset.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-popover-foreground hover:bg-muted"
                  }`}
                >
                  <span>{preset.label}</span>
                  {selectedPreset === preset.id && <Check className="w-3 h-3 ml-2" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* More Actions Dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!currentUrl}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  currentUrl ? "text-popover-foreground hover:bg-muted cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? (language === "id" ? "URL Disalin" : "URL Copied!") : (language === "id" ? "Salin URL" : "Copy URL")}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenExternal}
                disabled={!currentUrl}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  currentUrl ? "text-popover-foreground hover:bg-muted cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{language === "id" ? "Buka di browser luar" : "Open in default browser"}</span>
              </button>

              <button
                type="button"
                onClick={handleHardReload}
                disabled={!currentUrl}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  currentUrl ? "text-popover-foreground hover:bg-muted cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === "id" ? "Muat ulang tanpa cache" : "Hard reload (clear cache)"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Body Viewport */}
      <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col items-center justify-center bg-background">
        {!currentUrl ? (
          /* Blank / New Tab Landing State ("namun dengan tidak buka apa apa") */
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 mb-4 shadow-xs">
              <Globe className="w-7 h-7 stroke-[1.6]" />
            </div>

            <h3 className="text-base font-semibold text-foreground mb-1.5 tracking-tight font-sans">
              {language === "id" ? "Peramban Riset Web" : "Web Research Browser"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-6">
              {language === "id"
                ? "Jelajahi referensi, baca jurnal, atau buka sumber web langsung di samping ruang belajar Anda."
                : "Explore references, read documentation, or view web sources alongside your learning workspace."}
            </p>

            {/* Quick Search Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleNavigate(addressBarInput);
              }}
              className="w-full max-w-md mb-6"
            >
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border focus-within:border-primary shadow-xs transition-all">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={addressBarInput}
                  onChange={(e) => setAddressBarInput(e.target.value)}
                  placeholder={language === "id" ? "Masukkan kata kunci atau alamat web..." : "Search web or enter address..."}
                  className="flex-1 bg-transparent text-foreground outline-none text-xs font-sans placeholder:text-muted-foreground/50"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  {language === "id" ? "Buka" : "Go"}
                </button>
              </div>
            </form>

            {/* Quick Links Chips */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
                {language === "id" ? "Tautan Cepat" : "Quick Links"}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.label}
                      type="button"
                      onClick={() => handleNavigate(link.url)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card hover:bg-secondary/70 border border-border hover:border-border/80 text-xs text-foreground transition-all cursor-pointer shadow-2xs"
                    >
                      <Icon className="w-3.5 h-3.5 text-sky-500" />
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : loadError ? (
          /* Error State */
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {language === "id" ? "Tidak Dapat Memuat Halaman" : "Unable to load page"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed max-w-sm">
              {loadError.desc}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReloadOrStop}
                className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{language === "id" ? "Coba Lagi" : "Retry"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("")}
                className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
              >
                {language === "id" ? "Ke Beranda" : "Go to Home"}
              </button>
            </div>
          </div>
        ) : (
          /* Actual Webview Container with optional responsive viewport framing */
          <div
            className={`w-full h-full flex-1 min-h-0 relative flex flex-col ${
              isCustomWidth
                ? "shadow-2xl border-x border-border bg-background mx-auto"
                : ""
            }`}
            style={{
              width: isCustomWidth ? `${activePresetConfig.width}px` : "100%",
              maxWidth: "100%",
              height: "100%",
            }}
          >
            <webview
              ref={webviewRef}
              src={currentUrl}
              partition="persist:learn_browser"
              allowpopups={true}
              className="w-full h-full border-none block flex-1"
              style={{
                display: "inline-flex",
                width: "100%",
                height: "100%",
                flex: "1 1 100%",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
