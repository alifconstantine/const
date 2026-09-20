import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Sparkles,
  Code2,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { RightPaneTab, BrowserSelectedElement } from "./types";
import { useI18n } from "../../lib/i18n";

interface BrowserTabProps {
  tab: RightPaneTab;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onSelectElementForChat?: (element: BrowserSelectedElement) => void;
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

export function BrowserTab({ tab, onUpdateTab, onSelectElementForChat }: BrowserTabProps) {
  const { language } = useI18n();
  const rawInitial = typeof tab.url === "string" && tab.url && tab.url !== "[object Object]" ? tab.url.trim() : "";
  const initialUrlRef = useRef<string>(rawInitial);
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

  // Zoom controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Element Picker Mode
  const [isElementPickerActive, setIsElementPickerActive] = useState<boolean>(false);

  const webviewRef = useRef<any>(null);

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
      if (trimmed !== currentUrl) {
        setCurrentUrl(trimmed);
        setAddressBarInput(trimmed);
        if (!initialUrlRef.current) {
          initialUrlRef.current = trimmed;
        }
        if (webviewRef.current && trimmed) {
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
    if (!resolved) {
      setAddressBarInput("");
      setCurrentUrl("");
      setLoadError(null);
      onUpdateTab?.(tab.id, { url: "", title: language === "id" ? "Peramban Web" : "Web Browser", favicon: undefined });
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

  // Toggle interactive DOM element inspector
  const toggleElementPicker = useCallback(() => {
    if (!webviewRef.current) return;

    if (isElementPickerActive) {
      // Deactivate
      setIsElementPickerActive(false);
      webviewRef.current.executeJavaScript(`
        if (window.__harnessPickerCleanup) {
          window.__harnessPickerCleanup();
        }
      `);
    } else {
      // Activate
      setIsElementPickerActive(true);
      const inspectorScript = `
        (function() {
          if (window.__harnessPickerActive) return;
          window.__harnessPickerActive = true;

          const oldOverlay = document.getElementById('__harness_inspector_overlay');
          if (oldOverlay) oldOverlay.remove();
          const oldTooltip = document.getElementById('__harness_inspector_tooltip');
          if (oldTooltip) oldTooltip.remove();

          const overlay = document.createElement('div');
          overlay.id = '__harness_inspector_overlay';
          overlay.style.position = 'fixed';
          overlay.style.pointerEvents = 'none';
          overlay.style.border = '2px solid #3b82f6';
          overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
          overlay.style.zIndex = '2147483646';
          overlay.style.boxSizing = 'border-box';
          overlay.style.borderRadius = '3px';
          overlay.style.display = 'none';
          overlay.style.transition = 'all 0.05s ease-out';

          const tooltip = document.createElement('div');
          tooltip.id = '__harness_inspector_tooltip';
          tooltip.style.position = 'fixed';
          tooltip.style.pointerEvents = 'none';
          tooltip.style.backgroundColor = '#10141d';
          tooltip.style.border = '1px solid #2d3748';
          tooltip.style.borderRadius = '10px';
          tooltip.style.padding = '8px 12px';
          tooltip.style.color = '#ffffff';
          tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
          tooltip.style.fontSize = '12px';
          tooltip.style.lineHeight = '1.4';
          tooltip.style.zIndex = '2147483647';
          tooltip.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)';
          tooltip.style.display = 'none';
          tooltip.style.maxWidth = '300px';

          document.body.appendChild(overlay);
          document.body.appendChild(tooltip);

          let currentTarget = null;

          function rgbToHex(rgb) {
            if (!rgb) return '#000000';
            if (rgb.startsWith('#')) return rgb;
            const match = rgb.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
            if (!match) return rgb;
            return '#' + [match[1], match[2], match[3]].map(x => {
              const hex = parseInt(x).toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');
          }

          function getSelector(el) {
            if (!el || el === document.body) return 'body';
            if (el.id) return '#' + el.id;
            let path = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\\s+/).filter(Boolean);
              if (classes.length > 0) {
                path += '.' + classes.slice(0, 2).join('.');
              }
            }
            if (el.parentElement && el.parentElement !== document.body) {
              const parentPath = getSelector(el.parentElement);
              if (parentPath && !parentPath.includes('>')) {
                path = parentPath + ' > ' + path;
              }
            }
            return path;
          }

          function onMouseMove(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || el === overlay || el === tooltip) return;
            currentTarget = el;

            const rect = el.getBoundingClientRect();
            overlay.style.display = 'block';
            overlay.style.top = rect.top + 'px';
            overlay.style.left = rect.left + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';

            const style = window.getComputedStyle(el);
            const colorHex = rgbToHex(style.color);
            const fontInfo = Math.round(parseFloat(style.fontSize) || 12) + 'px ' + (style.fontFamily.split(',')[0].replace(/['"]/g, '') || 'sans-serif');
            const dimensions = Math.round(rect.width) + 'x' + Math.round(rect.height);

            tooltip.innerHTML = \`
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">
                <span style="font-weight: 700; color: #ffffff; font-size: 13px;">\${el.tagName.toLowerCase()}</span>
                <span style="font-weight: 700; color: #ffffff; font-size: 12px; font-family: monospace;">\${dimensions}</span>
              </div>
              <div style="display: flex; gap: 10px; font-size: 11px; margin-bottom: 3px; align-items: center;">
                <span style="color: #8892b0; min-width: 32px;">Color</span>
                <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: #ffffff; font-family: monospace;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: \${colorHex}; border: 1px solid #4a5568;"></span>
                  \${colorHex}
                </span>
              </div>
              <div style="display: flex; gap: 10px; font-size: 11px; overflow: hidden; align-items: center;">
                <span style="color: #8892b0; min-width: 32px;">Font</span>
                <span style="color: #ffffff; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">\${fontInfo}</span>
              </div>
            \`;

            tooltip.style.display = 'block';
            let tipTop = rect.bottom + 8;
            if (tipTop + 90 > window.innerHeight) {
              tipTop = Math.max(8, rect.top - 85);
            }
            let tipLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 280));
            tooltip.style.top = tipTop + 'px';
            tooltip.style.left = tipLeft + 'px';
          }

          function onClick(e) {
            if (!currentTarget) return;
            e.preventDefault();
            e.stopPropagation();

            const el = currentTarget;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const payload = {
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              className: typeof el.className === 'string' ? el.className : '',
              selector: getSelector(el),
              rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
              color: rgbToHex(style.color),
              font: Math.round(parseFloat(style.fontSize) || 12) + 'px ' + style.fontFamily,
              textSnippet: (el.innerText || '').slice(0, 120).trim(),
              htmlSnippet: el.outerHTML ? el.outerHTML.slice(0, 300) : '',
              url: window.location.href,
            };

            cleanup();
            console.log('__HARNESS_ELEMENT_PICK__:' + JSON.stringify(payload));
          }

          function onKeyDown(e) {
            if (e.key === 'Escape') {
              cleanup();
              console.log('__HARNESS_ELEMENT_CANCEL__');
            }
          }

          function cleanup() {
            window.__harnessPickerActive = false;
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeyDown, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
            window.__harnessPickerCleanup = null;
          }

          window.__harnessPickerCleanup = cleanup;
          document.addEventListener('mousemove', onMouseMove, true);
          document.addEventListener('click', onClick, true);
          document.addEventListener('keydown', onKeyDown, true);
        })();
      `;
      webviewRef.current.executeJavaScript(inspectorScript);
    }
  }, [isElementPickerActive]);

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

    const handleMediaStartedPlaying = () => {
      onUpdateTab?.(tab.id, { isAudible: true });
    };

    const handleMediaPaused = () => {
      const isAudible = webview.isCurrentlyAudible ? webview.isCurrentlyAudible() : false;
      onUpdateTab?.(tab.id, { isAudible });
    };

    const handleConsoleMessage = (e: any) => {
      const msg = e.message || "";
      if (msg.startsWith("__HARNESS_ELEMENT_PICK__:")) {
        try {
          const raw = msg.replace("__HARNESS_ELEMENT_PICK__:", "");
          const data: BrowserSelectedElement = JSON.parse(raw);
          setIsElementPickerActive(false);
          onSelectElementForChat?.(data);
        } catch (err) {
          console.error("Failed to parse picked element:", err);
        }
      } else if (msg.startsWith("__HARNESS_ELEMENT_CANCEL__")) {
        setIsElementPickerActive(false);
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
    webview.addEventListener("media-started-playing", handleMediaStartedPlaying);
    webview.addEventListener("media-paused", handleMediaPaused);
    webview.addEventListener("console-message", handleConsoleMessage);

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
      webview.removeEventListener("console-message", handleConsoleMessage);
    };
  }, [tab.id, onUpdateTab, onSelectElementForChat, currentUrl]);

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

        {/* Select Page Element for Chat Button */}
        <button
          type="button"
          onClick={toggleElementPicker}
          disabled={!currentUrl}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isElementPickerActive
              ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              : currentUrl
              ? "text-muted-foreground hover:text-foreground hover:bg-muted"
              : "text-muted-foreground/40 cursor-not-allowed"
          }`}
          title={
            isElementPickerActive
              ? language === "id"
                ? "Pemilih elemen aktif (Klik elemen atau Esc untuk batal)"
                : "Element picker active (Click element or Esc to cancel)"
              : language === "id"
              ? "Pilih elemen halaman untuk tanya ke AI"
              : "Select page element for chat"
          }
          aria-label="Select element for chat"
        >
          <Sparkles className="w-3.5 h-3.5" />
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
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 font-mono"
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
              src={initialUrlRef.current || currentUrl}
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
