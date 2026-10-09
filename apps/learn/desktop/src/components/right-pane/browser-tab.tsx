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
  Code2,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import type { RightPaneTab, AddSourceFromBrowserParams } from "./types";
import { useI18n } from "../../lib/i18n";

export interface BrowserTabProps {
  tab: RightPaneTab;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onAddSource?: (params: AddSourceFromBrowserParams) => Promise<any> | void;
  existingSourceUrls?: Set<string>;
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
    return "https://www.google.com";
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === "[object Object]" || trimmed === "about:blank") {
    return "https://www.google.com";
  }

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

export function BrowserTab({
  tab,
  onUpdateTab,
  onAddSource,
  existingSourceUrls,
}: BrowserTabProps) {
  const { t, language } = useI18n();
  const rawInitial =
    typeof tab.url === "string" && tab.url && tab.url !== "[object Object]"
      ? tab.url.trim()
      : "https://www.google.com";
  const initialUrlRef = useRef<string>(rawInitial);
  const [currentUrl, setCurrentUrl] = useState<string>(rawInitial);
  const [addressBarInput, setAddressBarInput] = useState<string>(rawInitial);
  const [pageTitle, setPageTitle] = useState<string>(tab.title || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<{ code: number; desc: string; url: string } | null>(null);

  // Ingestion to Sources state
  const [isAddingSource, setIsAddingSource] = useState<boolean>(false);

  // Responsive Size Preset
  const [selectedPreset, setSelectedPreset] = useState<ResponsivePreset>("responsive");
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState<boolean>(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  // More Options Menu
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Zoom controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const webviewRef = useRef<any>(null);

  // Check if current URL is already added to notebook sources
  const isCurrentUrlSaved = Boolean(
    currentUrl &&
    existingSourceUrls &&
    existingSourceUrls.has(currentUrl.trim().replace(/\/$/, "").toLowerCase())
  );

  // Sync mute with tab.isMuted
  useEffect(() => {
    if (webviewRef.current && typeof tab.isMuted === "boolean") {
      try {
        webviewRef.current.setAudioMuted(tab.isMuted);
      } catch {}
    }
  }, [tab.isMuted]);

  // Keep address bar in sync if tab.url changes from outside
  useEffect(() => {
    if (tab.url !== undefined && typeof tab.url === "string" && tab.url !== "[object Object]") {
      const trimmed = tab.url.trim();
      if (trimmed && trimmed !== currentUrl) {
        setCurrentUrl(trimmed);
        setAddressBarInput(trimmed);
        if (!initialUrlRef.current) {
          initialUrlRef.current = trimmed;
        }
        if (webviewRef.current) {
          try {
            webviewRef.current.loadURL(normalizeUrl(trimmed));
          } catch (e) {
            console.error("Failed to load URL in webview on tab update:", e);
          }
        }
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

  const handleOpenDevTools = () => {
    setIsMoreMenuOpen(false);
    if (webviewRef.current) {
      webviewRef.current.openDevTools();
    }
  };

  const handleZoomIn = () => {
    if (!webviewRef.current) return;
    const next = Math.min(200, zoomLevel + 10);
    setZoomLevel(next);
    try {
      webviewRef.current.setZoomFactor(next / 100);
    } catch {}
  };

  const handleZoomOut = () => {
    if (!webviewRef.current) return;
    const next = Math.max(50, zoomLevel - 10);
    setZoomLevel(next);
    try {
      webviewRef.current.setZoomFactor(next / 100);
    } catch {}
  };

  const handleZoomReset = () => {
    if (!webviewRef.current) return;
    setZoomLevel(100);
    try {
      webviewRef.current.setZoomFactor(1.0);
    } catch {}
  };

  // Add current webpage (or user selected text) into Notebook Sources
  const handleAddPageToSources = async () => {
    if (!webviewRef.current || !onAddSource || isAddingSource) return;
    setIsAddingSource(true);
    try {
      const extractionScript = `
        (function() {
          try {
            var selection = window.getSelection() ? window.getSelection().toString().trim() : '';
            var h1 = document.querySelector('h1');
            var title = document.title || (h1 ? h1.innerText : '') || window.location.hostname;
            var url = window.location.href;
            
            var targetEl = document.querySelector('article') || document.querySelector('main') || document.body;
            var text = '';
            if (targetEl) {
              var clone = targetEl.cloneNode(true);
              var removeSelectors = ['script', 'style', 'noscript', 'iframe', 'svg', 'header', 'footer', 'nav'];
              removeSelectors.forEach(function(sel) {
                var els = clone.querySelectorAll(sel);
                for (var i = 0; i < els.length; i++) {
                  els[i].remove();
                }
              });
              text = (clone.innerText || clone.textContent || '').trim();
            }
            return {
              title: title,
              url: url,
              selection: selection,
              content: selection ? selection : text
            };
          } catch(e) {
            return {
              title: document.title || '',
              url: window.location.href,
              selection: '',
              content: document.body ? document.body.innerText : ''
            };
          }
        })()
      `;

      let extracted: any = null;
      try {
        extracted = await webviewRef.current.executeJavaScript(extractionScript);
      } catch (err) {
        console.warn("Failed to extract content via executeJavaScript:", err);
      }

      const finalUrl = extracted?.url || currentUrl;
      const finalTitle = extracted?.title || pageTitle || tab.title || finalUrl;
      const finalContent = extracted?.content || "";
      const isSelection = Boolean(extracted?.selection);

      await onAddSource({
        url: finalUrl,
        title: finalTitle,
        content: finalContent,
        isSelection,
      });
    } catch (err: any) {
      console.error("Error adding page to sources:", err);
    } finally {
      setIsAddingSource(false);
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
        setPageTitle(e.title);
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

    const handleMediaStartedPlaying = () => {
      onUpdateTab?.(tab.id, { isAudible: true });
    };

    const handleMediaPaused = () => {
      const isAudible = webview.isCurrentlyAudible ? webview.isCurrentlyAudible() : false;
      onUpdateTab?.(tab.id, { isAudible });
    };

    webview.addEventListener("did-start-loading", handleDidStartLoading);
    webview.addEventListener("did-stop-loading", handleDidStopLoading);
    webview.addEventListener("did-navigate", handleDidNavigate);
    webview.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
    webview.addEventListener("page-title-updated", handlePageTitleUpdated);
    webview.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
    webview.addEventListener("did-fail-load", handleDidFailLoad);
    webview.addEventListener("new-window", handleNewWindow);
    webview.addEventListener("media-started-playing", handleMediaStartedPlaying);
    webview.addEventListener("media-paused", handleMediaPaused);

    return () => {
      webview.removeEventListener("did-start-loading", handleDidStartLoading);
      webview.removeEventListener("did-stop-loading", handleDidStopLoading);
      webview.removeEventListener("did-navigate", handleDidNavigate);
      webview.removeEventListener("did-navigate-in-page", handleDidNavigateInPage);
      webview.removeEventListener("page-title-updated", handlePageTitleUpdated);
      webview.removeEventListener("page-favicon-updated", handlePageFaviconUpdated);
      webview.removeEventListener("did-fail-load", handleDidFailLoad);
      webview.removeEventListener("new-window", handleNewWindow);
      webview.removeEventListener("media-started-playing", handleMediaStartedPlaying);
      webview.removeEventListener("media-paused", handleMediaPaused);
    };
  }, [tab.id, onUpdateTab, currentUrl]);

  // Viewport preset style
  const activePresetConfig = RESPONSIVE_PRESETS.find((p) => p.id === selectedPreset);
  const isCustomWidth = activePresetConfig && activePresetConfig.width;

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
        <button
          type="button"
          onClick={handleReloadOrStop}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={isLoading ? (language === "id" ? "Hentikan muat" : "Stop loading") : (language === "id" ? "Muat ulang" : "Reload")}
          aria-label="Reload or stop"
        >
          {isLoading ? <X className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
        </button>

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
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 text-xs font-sans select-text truncate"
            />
            {addressBarInput && (
              <button
                type="button"
                onClick={() => setAddressBarInput("")}
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

        {/* Add Page to Sources Button */}
        <button
          type="button"
          onClick={handleAddPageToSources}
          disabled={!currentUrl || isAddingSource}
          className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 transition-all text-xs font-medium cursor-pointer shrink-0 ${
            isCurrentUrlSaved
              ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border border-emerald-500/30"
              : isAddingSource
              ? "bg-primary/20 text-primary cursor-wait"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          }`}
          title={
            isCurrentUrlSaved
              ? t("savedInSources")
              : t("addPageToSources")
          }
          aria-label={t("addPageToSources")}
        >
          {isAddingSource ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : isCurrentUrlSaved ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5" />
          )}
          <span>
            {isAddingSource
              ? t("saving")
              : isCurrentUrlSaved
              ? t("saved")
              : t("add")}
          </span>
        </button>

        {/* Audio Mute Quick Toggle */}
        {tab.isAudible && (
          <button
            type="button"
            onClick={() => onUpdateTab?.(tab.id, { isMuted: !tab.isMuted })}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              tab.isMuted
                ? "text-amber-500 hover:bg-amber-500/10"
                : "text-sky-500 hover:bg-sky-500/10 animate-pulse"
            }`}
            title={tab.isMuted ? (language === "id" ? "Bunyikan tab" : "Unmute tab") : (language === "id" ? "Bisukan tab" : "Mute tab")}
            aria-label={tab.isMuted ? "Unmute tab" : "Mute tab"}
          >
            {tab.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}

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
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-popover border border-border rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
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
                onClick={handleOpenDevTools}
                disabled={!currentUrl}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  currentUrl ? "text-popover-foreground hover:bg-muted cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{language === "id" ? "Buka DevTools" : "Open DevTools"}</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border mt-0.5 pt-1">
                <span className="text-[11px] text-muted-foreground">{language === "id" ? "Zoom" : "Zoom"} ({zoomLevel}%)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={!currentUrl || zoomLevel <= 50}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    disabled={!currentUrl || zoomLevel === 100}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 font-sans tabular-nums"
                    title="Reset zoom"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={!currentUrl || zoomLevel >= 200}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border my-0.5" />

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
      <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col bg-background">
        {loadError ? (
          /* Error State */
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-3 shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {loadError.url.includes("localhost") || loadError.url.includes("127.0.0.1")
                ? language === "id"
                  ? "Server lokal belum berjalan"
                  : "Local server not running"
                : language === "id"
                ? "Tidak dapat memuat halaman"
                : "Unable to load page"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
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
                onClick={() => handleNavigate("https://www.google.com")}
                className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
              >
                {language === "id" ? "Ke Google" : "Go to Google"}
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
              src={initialUrlRef.current || currentUrl || "https://www.google.com"}
              partition="persist:const_browser"
              allowpopups={true}
              webpreferences="contextIsolation=yes, backgroundThrottling=no, autoplayPolicy=no-user-gesture-required"
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
