import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  X,
  Sparkles,
  MonitorSmartphone,
  MoreHorizontal,
  ExternalLink,
  Code2,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { RightPaneTab, BrowserSelectedElement } from "./types";

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
    return "https://www.google.com";
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === "[object Object]") return "https://www.google.com";

  // Check localhost / 127.0.0.1
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Already has protocol
  if (/^[a-zA-Z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Domain with dot (e.g. youtube.com, google.com, vite.dev)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Otherwise search with Google
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function BrowserTab({ tab, onUpdateTab, onSelectElementForChat }: BrowserTabProps) {
  const initialUrl =
    typeof tab.url === "string" && tab.url && tab.url !== "[object Object]"
      ? tab.url
      : "https://www.google.com";
  const initialUrlRef = useRef<string>(initialUrl);
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [addressBarInput, setAddressBarInput] = useState<string>(initialUrl);
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

  // Sync audio muting with tab.isMuted
  useEffect(() => {
    if (webviewRef.current && typeof tab.isMuted === "boolean") {
      try {
        webviewRef.current.setAudioMuted(tab.isMuted);
      } catch {}
    }
  }, [tab.isMuted]);

  // Keep address bar in sync if tab.url changes from outside
  useEffect(() => {
    if (
      tab.url &&
      typeof tab.url === "string" &&
      tab.url !== "[object Object]" &&
      tab.url !== currentUrl
    ) {
      setCurrentUrl(tab.url);
      setAddressBarInput(tab.url);
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
    const url = currentUrl || "http://localhost:3000";
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleOpenDevTools = () => {
    setIsMoreMenuOpen(false);
    if (webviewRef.current) {
      webviewRef.current.openDevTools();
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
    setIsMoreMenuOpen(false);
  };

  const handleHardReload = () => {
    setIsMoreMenuOpen(false);
    if (webviewRef.current) {
      setLoadError(null);
      webviewRef.current.reloadIgnoringCache();
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

          // Remove any existing overlay
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

  // Bind webview events
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
    webview.addEventListener("console-message", handleConsoleMessage);
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
      webview.removeEventListener("console-message", handleConsoleMessage);
      webview.removeEventListener("new-window", handleNewWindow);
      webview.removeEventListener("media-started-playing", handleMediaStartedPlaying);
      webview.removeEventListener("media-paused", handleMediaPaused);
    };
  }, [tab.id, onUpdateTab, onSelectElementForChat, currentUrl]);

  // Viewport preset style
  const activePresetConfig = RESPONSIVE_PRESETS.find((p) => p.id === selectedPreset);
  const isCustomWidth = activePresetConfig && activePresetConfig.width;

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#0f0f0f] text-white select-none overflow-hidden relative">
      {/* 1. Top Browser Navigation Toolbar (Matching Image 1:1) */}
      <div className="h-10 w-full bg-[#181818] border-b border-[#282828] flex items-center px-2 gap-1.5 shrink-0 z-20">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleGoBack}
          disabled={!canGoBack}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoBack
              ? "text-[#a0a0a0] hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-[#4a4a4a] cursor-not-allowed"
          }`}
          title="Click to go back"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Forward Button */}
        <button
          type="button"
          onClick={handleGoForward}
          disabled={!canGoForward}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoForward
              ? "text-[#a0a0a0] hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-[#4a4a4a] cursor-not-allowed"
          }`}
          title="Click to go forward"
          aria-label="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Reload / Stop Button */}
        <button
          type="button"
          onClick={handleReloadOrStop}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#a0a0a0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={isLoading ? "Stop loading" : "Reload this page"}
          aria-label="Reload"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#888888]" : ""}`} />
        </button>

        {/* Address Bar (URL Input) */}
        <div className="flex-1 min-w-0 relative flex items-center">
          <input
            type="text"
            value={addressBarInput}
            onChange={(e) => setAddressBarInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleNavigate(addressBarInput);
              }
            }}
            placeholder="Search with Google or enter address..."
            className="w-full h-7 px-3 bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#202020] border border-[#333333] focus:border-[#4f4f4f] rounded-lg text-xs text-[#e0e0e0] placeholder-[#666666] outline-none transition-all font-sans"
          />
        </div>

        {/* Responsive Size Button */}
        <div className="relative" ref={sizeMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsSizeMenuOpen((prev) => !prev);
              setIsMoreMenuOpen(false);
            }}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              selectedPreset !== "responsive" || isSizeMenuOpen
                ? "bg-white/15 text-white shadow-xs"
                : "text-[#a0a0a0] hover:text-white hover:bg-white/10"
            }`}
            title="Toggle responsive view size"
            aria-label="Responsive Size"
          >
            <MonitorSmartphone className="w-3.5 h-3.5" />
          </button>

          {/* Size Preset Dropdown */}
          {isSizeMenuOpen && (
            <div className="absolute top-9 right-0 w-52 rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-[#777777] uppercase">
                Viewport Size
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
                      ? "bg-blue-600/20 text-blue-400 font-medium"
                      : "text-[#cccccc] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{preset.label}</span>
                  {selectedPreset === preset.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Select Page Element for Chat Button */}
        <button
          type="button"
          onClick={toggleElementPicker}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isElementPickerActive
              ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              : "text-[#a0a0a0] hover:text-white hover:bg-white/10"
          }`}
          title={
            isElementPickerActive
              ? "Element picker active (Click element or Esc to cancel)"
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
                ? "text-amber-400 hover:bg-amber-400/15"
                : "text-blue-400 hover:bg-blue-400/15 animate-pulse"
            }`}
            title={tab.isMuted ? "Unmute tab" : "Mute tab"}
            aria-label={tab.isMuted ? "Unmute tab" : "Mute tab"}
          >
            {tab.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* More Options (...) Menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsMoreMenuOpen((prev) => !prev);
              setIsSizeMenuOpen(false);
            }}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isMoreMenuOpen
                ? "bg-white/15 text-white"
                : "text-[#a0a0a0] hover:text-white hover:bg-white/10"
            }`}
            title="More browser actions"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* More Dropdown */}
          {isMoreMenuOpen && (
            <div className="absolute top-9 right-0 w-56 rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
              <button
                type="button"
                onClick={handleOpenExternal}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#888888]" />
                <span>Open in default browser</span>
              </button>

              <button
                type="button"
                onClick={handleOpenDevTools}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <Code2 className="w-3.5 h-3.5 text-[#888888]" />
                <span>Open DevTools</span>
              </button>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#888888]" />
                )}
                <span>{isCopied ? "Copied to clipboard" : "Copy URL"}</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[#333333] mt-0.5 pt-1">
                <span className="text-[11px] text-[#8e8e8e]">Zoom ({zoomLevel}%)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 50}
                    className="p-1 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    disabled={zoomLevel === 100}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40 font-mono"
                    title="Reset zoom"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 200}
                    className="p-1 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="border-t border-[#333333] my-1" />

              <button
                type="button"
                onClick={handleHardReload}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#888888]" />
                <span>Hard Reload (Clear Cache)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Web Viewport Area */}
      <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden bg-[#121212] flex flex-col">
        {loadError ? (
          /* Friendly Error / Offline Localhost State */
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3.5">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              {loadError.url.includes("localhost") || loadError.url.includes("127.0.0.1")
                ? "Local server not running"
                : "Unable to load page"}
            </h3>
            <p className="text-xs text-[#8e8e8e] mb-4 leading-relaxed">
              {loadError.url.includes("localhost") || loadError.url.includes("127.0.0.1")
                ? `Could not connect to ${loadError.url}. Make sure your local development server is running in the terminal.`
                : loadError.desc}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReloadOrStop}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("https://www.google.com")}
                className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-[#a0a0a0] hover:text-white text-xs transition-colors cursor-pointer"
              >
                Go to Google
              </button>
            </div>
          </div>
        ) : (
          /* Actual Webview Container with optional responsive viewport framing */
          <div
            className={`w-full h-full flex-1 min-h-0 relative flex flex-col ${
              isCustomWidth
                ? "shadow-2xl border-x border-[#333333] bg-black mx-auto"
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
