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
  Bot,
  Hand,
  KeyRound,
  Sparkles,
} from "lucide-react";
import type { RightPaneTab, AddSourceFromBrowserParams } from "./types";
import { useI18n } from "../../lib/i18n";

export interface BrowserTabProps {
  tab: RightPaneTab;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onAddSource?: (params: AddSourceFromBrowserParams) => Promise<any> | void;
  existingSourceUrls?: Set<string>;
  onSelectElementForChat?: (info: {
    tag: string;
    id?: string;
    className?: string;
    text?: string;
    url?: string;
    selector?: string;
  }) => void;
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
  onSelectElementForChat,
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

  // AI / Human Control State (OpenBot / oh-my-pi architecture)
  const [controlState, setControlState] = useState<{
    holder: "bot" | "human";
    since: string;
    requested: boolean;
    reason?: string;
    secretWanted?: string;
  }>({
    holder: "bot",
    since: new Date().toISOString(),
    requested: false,
  });
  const [secretInput, setSecretInput] = useState<string>("");
  const [isSubmittingSecret, setIsSubmittingSecret] = useState<boolean>(false);

  // Element Picker ("Select Element for Chat") state
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false);
  const pickerTokenRef = useRef<string>("");

  const webviewRef = useRef<any>(null);

  // Check if current URL is already added to notebook sources
  const isCurrentUrlSaved = Boolean(
    currentUrl &&
    existingSourceUrls &&
    existingSourceUrls.has(currentUrl.trim().replace(/\/$/, "").toLowerCase())
  );

  // Subscribe to AI Control state updates from main process
  useEffect(() => {
    const browserApi = window.electron?.browser;
    if (!browserApi) return;

    browserApi.getControl().then((state) => {
      if (state) setControlState(state);
    }).catch(() => {});

    const unsubControl = browserApi.onControlChanged((state) => {
      if (state) setControlState(state);
    });

    return () => {
      unsubControl();
    };
  }, []);

  const handleToggleControl = async () => {
    const browserApi = window.electron?.browser;
    if (!browserApi) return;
    if (controlState.holder === "bot") {
      const next = await browserApi.takeControl();
      if (next) setControlState(next);
    } else {
      const next = await browserApi.releaseControl();
      if (next) setControlState(next);
    }
  };

  const handleSupplySecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim() || isSubmittingSecret) return;
    const browserApi = window.electron?.browser;
    if (!browserApi) return;
    setIsSubmittingSecret(true);
    try {
      await browserApi.supplySecret(secretInput);
      setSecretInput("");
    } catch (err) {
      console.error("Failed to supply secret:", err);
    } finally {
      setIsSubmittingSecret(false);
    }
  };

  const handleToggleElementPicker = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    if (isPickerActive) {
      setIsPickerActive(false);
      pickerTokenRef.current = "";
      try {
        await webview.executeJavaScript(`
          if (window.__constCleanupElementPicker) {
            window.__constCleanupElementPicker();
          }
        `);
      } catch {}
      return;
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    pickerTokenRef.current = token;
    setIsPickerActive(true);
    try {
      await webview.executeJavaScript(`
        (function() {
          if (window.__constCleanupElementPicker) {
            window.__constCleanupElementPicker();
          }
          const token = ${JSON.stringify(token)};
          const overlay = document.createElement('div');
          overlay.id = '__const_picker_overlay';
          overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #10b981;background:rgba(16,185,129,0.12);border-radius:4px;transition:all 0.05s ease;display:none;';
          const badge = document.createElement('div');
          badge.style.cssText = 'position:absolute;top:-22px;left:0;background:#10b981;color:#09090b;font-family:monospace;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap;';
          overlay.appendChild(badge);
          document.body.appendChild(overlay);

          function onMove(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || el === overlay || el === document.body || el === document.documentElement) {
              overlay.style.display = 'none';
              return;
            }
            const r = el.getBoundingClientRect();
            overlay.style.display = 'block';
            overlay.style.left = r.left + 'px';
            overlay.style.top = r.top + 'px';
            overlay.style.width = r.width + 'px';
            overlay.style.height = r.height + 'px';
            const idPart = el.id ? '#' + el.id : '';
            badge.textContent = el.tagName.toLowerCase() + idPart;
          }

          function onClick(e) {
            e.preventDefault();
            e.stopPropagation();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el) {
              const info = {
                tag: el.tagName.toLowerCase(),
                id: el.id || undefined,
                className: typeof el.className === 'string' ? el.className.trim().slice(0, 120) : undefined,
                text: (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 200),
                url: window.location.href,
                selector: el.id ? '#' + el.id : el.tagName.toLowerCase()
              };
              console.log('__CONST_PICKED_ELEMENT__:' + token + ':' + JSON.stringify(info));
            }
            cleanup();
          }

          function onKeyDown(e) {
            if (e.key === 'Escape') {
              console.log('__CONST_PICKED_CANCEL__:' + token);
              cleanup();
            }
          }

          function cleanup() {
            window.removeEventListener('mousemove', onMove, true);
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('keydown', onKeyDown, true);
            overlay.remove();
            delete window.__constCleanupElementPicker;
          }

          window.__constCleanupElementPicker = cleanup;
          window.addEventListener('mousemove', onMove, true);
          window.addEventListener('click', onClick, true);
          window.addEventListener('keydown', onKeyDown, true);
        })();
      `);
    } catch (err) {
      setIsPickerActive(false);
    }
  };

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

  // Wire up webview native events + AI BrowserController registration
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const registerWithController = () => {
      try {
        const id = webview.getWebContentsId?.();
        if (typeof id === "number" && window.electron?.browser) {
          window.electron.browser.registerTab(tab.id, id).catch(() => {});
        }
      } catch {}
    };

    const handleDomReady = () => {
      registerWithController();
    };

    const handleConsoleMessage = (e: any) => {
      const msg: string = e.message || "";
      const activeToken = pickerTokenRef.current;
      if (!activeToken) return;
      const pickedPrefix = `__CONST_PICKED_ELEMENT__:${activeToken}:`;
      const cancelPrefix = `__CONST_PICKED_CANCEL__:${activeToken}`;
      if (msg.startsWith(pickedPrefix)) {
        setIsPickerActive(false);
        pickerTokenRef.current = "";
        try {
          const json = JSON.parse(msg.slice(pickedPrefix.length));
          onSelectElementForChat?.(json);
        } catch {}
      } else if (msg.startsWith(cancelPrefix)) {
        setIsPickerActive(false);
        pickerTokenRef.current = "";
      }
    };

    const handleDidStartLoading = () => {
      setIsLoading(true);
      setLoadError(null);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      registerWithController();
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

    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("console-message", handleConsoleMessage);
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
      window.electron?.browser?.unregisterTab(tab.id).catch(() => {});
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("console-message", handleConsoleMessage);
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
  }, [tab.id, onUpdateTab, currentUrl, onSelectElementForChat]);

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

        {/* AI / Human Control Status Pill */}
        <button
          type="button"
          onClick={handleToggleControl}
          className={`h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer border shrink-0 ${
            controlState.holder === "human"
              ? "bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25"
              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20"
          }`}
          title={
            controlState.holder === "human"
              ? language === "id"
                ? "Anda memegang kendali browser — klik untuk kembalikan ke AI"
                : "You have browser control — click to hand back to AI"
              : language === "id"
              ? "AI dapat mengontrol tab ini — klik untuk ambil alih kendali"
              : "AI can control this browser — click to take manual control"
          }
        >
          {controlState.holder === "human" ? (
            <>
              <Hand className="w-3 h-3" />
              <span className="hidden sm:inline">{language === "id" ? "Anda" : "You Drive"}</span>
            </>
          ) : (
            <>
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Pilot</span>
            </>
          )}
        </button>

        {/* Element Picker ("Select Element for Chat") */}
        <button
          type="button"
          onClick={handleToggleElementPicker}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer border shrink-0 ${
            isPickerActive
              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 animate-pulse"
              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
          }`}
          title={
            language === "id"
              ? "Pilih elemen halaman untuk ditanyakan di Chat"
              : "Pick an element on the page to ask about in Chat"
          }
          aria-label="Pick element for Chat"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

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

      {/* 1b. Control State Banners */}
      {controlState.holder === "human" && !controlState.requested && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-500 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Hand className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {language === "id"
                ? "Anda memegang kendali — klik dan ketik langsung di halaman"
                : "You have control — click and type directly in the page"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleControl}
            className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-medium text-[11px] hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
          >
            {language === "id" ? "Kembalikan ke AI" : "Hand back to AI"}
          </button>
        </div>
      )}

      {controlState.requested && !controlState.secretWanted && (
        <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-500 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Hand className="w-4 h-4 shrink-0 animate-bounce" />
            <span className="truncate font-medium">
              {controlState.reason ||
                (language === "id"
                  ? "AI membutuhkan bantuan Anda di halaman ini (CAPTCHA / 2FA)"
                  : "AI needs your help on this page (e.g. CAPTCHA / 2FA)")}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleControl}
            className="px-2.5 py-1 rounded bg-emerald-500 text-zinc-950 font-semibold text-[11px] hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
          >
            {language === "id" ? "Selesai — Lanjutkan AI" : "Done — Resume AI"}
          </button>
        </div>
      )}

      {controlState.secretWanted && (
        <form
          onSubmit={handleSupplySecret}
          className="w-full bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center gap-2 text-xs text-amber-500 shrink-0 z-10"
        >
          <KeyRound className="w-4 h-4 shrink-0" />
          <span className="font-medium shrink-0">
            {controlState.secretWanted}:
          </span>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder={
              language === "id"
                ? "Ketik rahasia (tidak terlihat oleh AI)..."
                : "Enter secret (never visible to AI)..."
            }
            className="flex-1 bg-background/80 border border-amber-500/30 rounded px-2 py-1 text-xs text-foreground outline-none focus:border-amber-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={!secretInput.trim() || isSubmittingSecret}
            className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-semibold text-[11px] hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSubmittingSecret
              ? language === "id"
                ? "Mengirim..."
                : "Sending..."
              : language === "id"
              ? "Kirim"
              : "Supply"}
          </button>
        </form>
      )}

      {/* 2. Main Body Viewport */}
      <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col bg-background">
        {/* Keep <webview> always mounted so AI BrowserController never loses its guestContentsId */}
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

        {loadError && (
          /* Error State Overlay */
          <div className="absolute inset-0 z-20 bg-background flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-sm mx-auto flex flex-col items-center">
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
          </div>
        )}
      </div>
    </div>
  );
}
