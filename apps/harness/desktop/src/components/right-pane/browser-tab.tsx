import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  SlidersHorizontal,
  MousePointerClick,
  Camera,
  ExternalLink,
  Check,
  Copy,
  RotateCcw,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Trash2,
  Loader2,
  Hand,
  Square,
  Play,
} from "lucide-react";
import { useRemoteRuntime } from "../../lib/remote-runtime";
import { RemoteBrowserViewport } from "./remote-browser-viewport";
import type {
  RightPaneTab,
  BrowserSelectedElement,
  BrowserScreenshotAttachment,
} from "./types";
import { useTranslation } from "../../lib/i18n";

interface BrowserTabProps {
  tab: RightPaneTab;
  isActive?: boolean;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onSelectElementForChat?: (element: BrowserSelectedElement) => void;
  onAttachScreenshotToChat?: (screenshot: BrowserScreenshotAttachment) => void;
}

type ResponsivePreset = "responsive" | "mobile" | "mobile-lg" | "tablet" | "desktop";

interface PresetConfig {
  id: ResponsivePreset;
  label: string;
  width?: number;
  height?: number;
  mobile?: boolean;
}

const RESPONSIVE_PRESETS: PresetConfig[] = [
  { id: "responsive", label: "Responsive (100%)" },
  { id: "mobile", label: "Mobile (375 × 667)", width: 375, height: 667, mobile: true },
  { id: "mobile-lg", label: "Mobile Large (414 × 896)", width: 414, height: 896, mobile: true },
  { id: "tablet", label: "Tablet (768 × 1024)", width: 768, height: 1024, mobile: true },
  { id: "desktop", label: "Desktop (1280 × 800)", width: 1280, height: 800, mobile: false },
];

const ALLOWED_BROWSER_SCHEMES = ["http:", "https:"];

function isAllowedBrowserUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_BROWSER_SCHEMES.includes(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeUrl(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input === "[object Object]") {
    return "https://www.google.com/";
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === "[object Object]") return "https://www.google.com/";

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (/^[a-zA-Z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

/** Format URL cleanly when unfocused (e.g. `https://www.google.com/` -> `www.google.com`). */
function formatDisplayUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const hostPort = parsed.host;
    const pathPart = parsed.pathname === "/" && !parsed.search && !parsed.hash ? "" : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return `${hostPort}${pathPart}`;
  } catch {
    return rawUrl;
  }
}

function cdpModifiersFromEvent(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): number {
  let mask = 0;
  if (e.altKey) mask |= 1;
  if (e.ctrlKey) mask |= 2;
  if (e.metaKey) mask |= 4;
  if (e.shiftKey) mask |= 8;
  return mask;
}

function cdpMouseButton(button: number): "left" | "middle" | "right" | "none" {
  if (button === 0) return "left";
  if (button === 1) return "middle";
  if (button === 2) return "right";
  return "none";
}

interface InspectedOverlay {
  tag: string;
  id: string;
  className: string;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  font: string;
  textSnippet: string;
  htmlSnippet: string;
  url: string;
}

interface BrowserControlState {
  conversationId?: string;
  tabId?: string;
  status: "idle" | "running" | "paused";
  holder: "bot" | "human";
  since: string;
  requested: boolean;
  reason?: string;
}

export function BrowserTab({
  tab,
  isActive = true,
  onUpdateTab,
  onSelectElementForChat,
  onAttachScreenshotToChat,
}: BrowserTabProps) {
  const remote = useRemoteRuntime();
  const { t } = useTranslation();

  const initialUrl =
    typeof tab.url === "string" && tab.url && tab.url !== "[object Object]"
      ? tab.url
      : "https://www.google.com/";

  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [addressBarInput, setAddressBarInput] = useState<string>(initialUrl);
  const [isAddressFocused, setIsAddressFocused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<{ desc: string; url: string } | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [hasFirstFrame, setHasFirstFrame] = useState<boolean>(false);

  // Settings popover (Sliders icon inside URL pill)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<ResponsivePreset>("responsive");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isCopiedUrl, setIsCopiedUrl] = useState<boolean>(false);
  const [isResettingSession, setIsResettingSession] = useState<boolean>(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Screenshot button feedback
  const [isCapturingShot, setIsCapturingShot] = useState<boolean>(false);
  const [shotFeedback, setShotFeedback] = useState<boolean>(false);

  // Select Page / Element Picker
  const [isElementPickerActive, setIsElementPickerActive] = useState<boolean>(false);
  const [hoveredElement, setHoveredElement] = useState<InspectedOverlay | null>(null);
  const inspectInFlightRef = useRef<boolean>(false);
  const lastInspectAtRef = useRef<number>(0);

  // Minimalist Agent Control Pill State (`idle` | `running` | `paused`)
  const [controlState, setControlState] = useState<BrowserControlState>({
    status: "idle",
    holder: "human",
    since: new Date().toISOString(),
    requested: false,
  });

  // Canvas & WebSocket refs
  const viewportHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const remoteWebviewShimRef = useRef<any>(null);
  const remoteViewportSizeRef = useRef<{ width: number; height: number }>({ width: 1280, height: 800 });
  const lastNavigatedExternalUrlRef = useRef<string>(initialUrl);
  const isAddressFocusedRef = useRef<boolean>(false);
  const onUpdateTabRef = useRef(onUpdateTab);
  const controlStatusRef = useRef<BrowserControlState["status"]>("idle");
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    isAddressFocusedRef.current = isAddressFocused;
  }, [isAddressFocused]);

  useEffect(() => {
    onUpdateTabRef.current = onUpdateTab;
  }, [onUpdateTab]);

  useEffect(() => {
    controlStatusRef.current = controlState.status;
  }, [controlState.status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Close settings popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Sync control state with main process
  useEffect(() => {
    const browserApi = window.electron?.browser;
    if (!browserApi) return;

    let disposed = false;
    browserApi
      .getControl(tab.id, tab.conversationId)
      .then((st) => {
        if (!disposed && st) {
          setControlState({
            ...st,
            status: st.status ?? (st.requested ? "paused" : st.holder === "bot" ? "running" : "idle"),
          });
        }
      })
      .catch(() => {});

    const unsubControl = browserApi.onControlChanged((st) => {
      if (!st) return;
      if (st.conversationId && tab.conversationId && st.conversationId !== tab.conversationId) return;
      setControlState({
        ...st,
        status: st.status ?? (st.requested ? "paused" : st.holder === "bot" ? "running" : "idle"),
      });
    });

    return () => {
      disposed = true;
      unsubControl();
    };
  }, [tab.id, tab.conversationId]);

  const activePresetConfig = useMemo(
    () => RESPONSIVE_PRESETS.find((p) => p.id === selectedPreset) || RESPONSIVE_PRESETS[0]!,
    [selectedPreset],
  );

  // Measure target Chromium viewport dimensions from container or active preset
  const computeTargetViewport = useCallback((): { width: number; height: number; mobile: boolean } => {
    if (activePresetConfig.width && activePresetConfig.height) {
      return {
        width: activePresetConfig.width,
        height: activePresetConfig.height,
        mobile: Boolean(activePresetConfig.mobile),
      };
    }
    const rect = viewportHostRef.current?.getBoundingClientRect();
    const width = Math.max(480, Math.round(rect?.width || 1024));
    const height = Math.max(360, Math.round(rect?.height || 720));
    return { width, height, mobile: false };
  }, [activePresetConfig]);

  // Open or activate this tab in the shared native `agent-browser` daemon whenever visible
  useEffect(() => {
    if (remote || !isActive) return;
    const browserApi = window.electron?.browser;
    if (!browserApi?.openSession) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const vp = computeTargetViewport();
    remoteViewportSizeRef.current = { width: vp.width, height: vp.height };

    browserApi
      .openSession({
        tabId: tab.id,
        url: currentUrl,
        conversationId: tab.conversationId,
        viewport: vp,
        navigateIfDifferent: false,
      })
      .then((info) => {
        if (cancelled || !mountedRef.current || !info) return;
        if (info.url) {
          setCurrentUrl(info.url);
          if (!isAddressFocused) setAddressBarInput(info.url);
          lastNavigatedExternalUrlRef.current = info.url;
        }
        setCanGoBack(Boolean(info.canGoBack));
        setCanGoForward(Boolean(info.canGoForward));
        if (info.viewport?.width && info.viewport?.height) {
          remoteViewportSizeRef.current = info.viewport;
        }
        if (info.control) {
          setControlState({
            ...info.control,
            status:
              info.control.status ??
              (info.control.requested ? "paused" : info.control.holder === "bot" ? "running" : "idle"),
          });
        }
        if (info.streamUrl) {
          setStreamUrl(info.streamUrl);
        }
        if (info.title && info.title !== tab.title) {
          onUpdateTabRef.current?.(tab.id, { title: info.title, ...(info.url ? { url: info.url } : {}) });
        }
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled || !mountedRef.current) return;
        setIsLoading(false);
        setLoadError({
          desc: err?.message || "Could not start native browser engine.",
          url: currentUrl,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, remote, tab.id, tab.conversationId]);

  // Close daemon tab cleanly when this BrowserTab component unmounts permanently
  useEffect(() => {
    if (remote) return;
    return () => {
      void window.electron?.browser?.closeSession?.(tab.id).catch(() => {});
    };
  }, [remote, tab.id]);

  // React to explicit parent-initiated URL changes when idle (avoid fighting agent clicks)
  useEffect(() => {
    if (typeof tab.url !== "string" || !isAllowedBrowserUrl(tab.url)) return;
    if (tab.url === lastNavigatedExternalUrlRef.current || tab.url === currentUrl) return;
    lastNavigatedExternalUrlRef.current = tab.url;
    setCurrentUrl(tab.url);
    if (!isAddressFocusedRef.current) setAddressBarInput(tab.url);
    // While the agent is driving the tab, tab.url updates are echoes from backend navigation; never re-navigate.
    if (controlStatusRef.current === "running") return;
    if (!remote && isActive && window.electron?.browser?.navigate) {
      setLoadError(null);
      void window.electron.browser
        .navigate(tab.url, { tabId: tab.id })
        .then((res) => {
          if (!mountedRef.current || !res) return;
          if (res.url) {
            lastNavigatedExternalUrlRef.current = res.url;
            setCurrentUrl(res.url);
          }
          setCanGoBack(Boolean(res.canGoBack));
          setCanGoForward(Boolean(res.canGoForward));
        })
        .catch(() => {});
    }
  }, [tab.url, tab.id, isActive, remote, currentUrl]);

  // Sync Chromium viewport dimensions with panel resize / preset change
  useEffect(() => {
    if (remote || !isActive || !window.electron?.browser?.setViewport) return;
    const host = viewportHostRef.current;
    if (!host) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncViewport = () => {
      const vp = computeTargetViewport();
      const prev = remoteViewportSizeRef.current;
      if (Math.abs(prev.width - vp.width) < 4 && Math.abs(prev.height - vp.height) < 4) return;
      remoteViewportSizeRef.current = { width: vp.width, height: vp.height };
      void window.electron?.browser
        ?.setViewport?.({
          tabId: tab.id,
          width: vp.width,
          height: vp.height,
          mobile: vp.mobile,
        })
        .catch(() => {});
    };

    syncViewport();

    const observer = new ResizeObserver(() => {
      if (selectedPreset !== "responsive") return;
      clearTimeout(timer);
      timer = setTimeout(syncViewport, 160);
    });
    observer.observe(host);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [remote, isActive, tab.id, selectedPreset, computeTargetViewport]);

  // Live WebSocket connection to `agent-browser` StreamServer
  useEffect(() => {
    if (remote || !isActive || !streamUrl) return;

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let rendering = false;
    let pendingFrame: { data: string; seq?: number; width?: number; height?: number } | null = null;
    // Reuse one HTMLImageElement to decode JPEGs natively off-heap without per-frame V8 Uint8Array/Blob churn.
    const decoderImg = new Image();

    const drawFrame = (frame: { data: string; seq?: number; width?: number; height?: number }): Promise<void> => {
      return new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas || disposed) {
          resolve();
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve();
          return;
        }

        const finish = () => {
          if (!disposed && typeof frame.seq === "number" && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ack", seq: frame.seq }));
          }
          resolve();
        };

        decoderImg.onload = () => {
          if (!disposed) {
            const w = decoderImg.naturalWidth || 1280;
            const h = decoderImg.naturalHeight || 800;
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }
            ctx.drawImage(decoderImg, 0, 0);
            if (frame.width && frame.height) {
              remoteViewportSizeRef.current = { width: frame.width, height: frame.height };
            } else {
              remoteViewportSizeRef.current = { width: w, height: h };
            }
            setHasFirstFrame(true);
          }
          finish();
        };

        decoderImg.onerror = () => {
          finish();
        };

        decoderImg.src = `data:image/jpeg;base64,${frame.data}`;
      });
    };

    const pumpFrames = async () => {
      if (rendering) return;
      rendering = true;
      while (pendingFrame && !disposed) {
        const next = pendingFrame;
        pendingFrame = null;
        await drawFrame(next);
      }
      rendering = false;
    };

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (disposed || typeof event.data !== "string") return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "frame" && typeof msg.data === "string") {
            pendingFrame = {
              data: msg.data,
              seq: typeof msg.seq === "number" ? msg.seq : undefined,
              width: msg.metadata?.deviceWidth,
              height: msg.metadata?.deviceHeight,
            };
            void pumpFrames();
          } else if (msg.type === "url" && typeof msg.url === "string" && isAllowedBrowserUrl(msg.url)) {
            lastNavigatedExternalUrlRef.current = msg.url;
            setCurrentUrl(msg.url);
            if (!isAddressFocusedRef.current) setAddressBarInput(msg.url);
            let nextTitle: string | undefined;
            try {
              nextTitle = new URL(msg.url).hostname.replace(/^www\./, "");
            } catch {}
            onUpdateTabRef.current?.(tab.id, { url: msg.url, ...(nextTitle ? { title: nextTitle } : {}) });
          } else if (msg.type === "status" && msg.metadata?.deviceWidth && msg.metadata?.deviceHeight) {
            remoteViewportSizeRef.current = {
              width: msg.metadata.deviceWidth,
              height: msg.metadata.deviceHeight,
            };
          }
        } catch {
          // Ignore invalid JSON frames.
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 900);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      decoderImg.onload = null;
      decoderImg.onerror = null;
      decoderImg.src = "";
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [remote, isActive, streamUrl, tab.id]);

  // Map pointer position over canvas to Chromium viewport coordinates
  const mapPointerToViewport = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const { width, height } = remoteViewportSizeRef.current;
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: Math.max(0, Math.min(width, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(height, (clientY - rect.top) * scaleY)),
    };
  }, []);

  const sendWsInput = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  // Navigation handlers
  const handleNavigate = async (targetUrl: string) => {
    const resolved = normalizeUrl(targetUrl);
    if (!isAllowedBrowserUrl(resolved)) {
      setLoadError({ desc: t("rightPane.browserBlockedScheme"), url: String(targetUrl || "") });
      setAddressBarInput(currentUrl);
      return;
    }
    setAddressBarInput(resolved);
    setCurrentUrl(resolved);
    setLoadError(null);
    setIsLoading(true);

    if (remote && remoteWebviewShimRef.current) {
      remoteWebviewShimRef.current.loadURL(resolved);
      setIsLoading(false);
      return;
    }

    try {
      const res = await window.electron?.browser?.navigate(resolved, { tabId: tab.id });
      if (!mountedRef.current) return;
      if (res?.url) {
        lastNavigatedExternalUrlRef.current = res.url;
        setCurrentUrl(res.url);
        setAddressBarInput(res.url);
        onUpdateTab?.(tab.id, { url: res.url, ...(res.title ? { title: res.title } : {}) });
      }
      setCanGoBack(Boolean(res?.canGoBack));
      setCanGoForward(Boolean(res?.canGoForward));
    } catch (err: any) {
      if (mountedRef.current) {
        setLoadError({ desc: err?.message || "Failed to load page", url: resolved });
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleGoBack = async () => {
    if (remote && remoteWebviewShimRef.current) {
      remoteWebviewShimRef.current.goBack();
      return;
    }
    setIsLoading(true);
    try {
      const res = await window.electron?.browser?.goBack?.(tab.id);
      if (mountedRef.current && res) {
        if (res.url) {
          lastNavigatedExternalUrlRef.current = res.url;
          setCurrentUrl(res.url);
          if (!isAddressFocused) setAddressBarInput(res.url);
          onUpdateTab?.(tab.id, { url: res.url, ...(res.title ? { title: res.title } : {}) });
        }
        setCanGoBack(Boolean(res.canGoBack));
        setCanGoForward(Boolean(res.canGoForward));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleGoForward = async () => {
    if (remote && remoteWebviewShimRef.current) {
      remoteWebviewShimRef.current.goForward();
      return;
    }
    setIsLoading(true);
    try {
      const res = await window.electron?.browser?.goForward?.(tab.id);
      if (mountedRef.current && res) {
        if (res.url) {
          lastNavigatedExternalUrlRef.current = res.url;
          setCurrentUrl(res.url);
          if (!isAddressFocused) setAddressBarInput(res.url);
          onUpdateTab?.(tab.id, { url: res.url, ...(res.title ? { title: res.title } : {}) });
        }
        setCanGoBack(Boolean(res.canGoBack));
        setCanGoForward(Boolean(res.canGoForward));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleReload = async (ignoreCache = false) => {
    setIsSettingsOpen(false);
    setLoadError(null);
    if (remote && remoteWebviewShimRef.current) {
      remoteWebviewShimRef.current.reload();
      return;
    }
    setIsLoading(true);
    try {
      const res = await window.electron?.browser?.reload?.(tab.id, ignoreCache);
      if (mountedRef.current && res) {
        if (res.url) {
          lastNavigatedExternalUrlRef.current = res.url;
          setCurrentUrl(res.url);
          if (!isAddressFocused) setAddressBarInput(res.url);
        }
        setCanGoBack(Boolean(res.canGoBack));
        setCanGoForward(Boolean(res.canGoForward));
      }
    } catch (err: any) {
      if (mountedRef.current) setLoadError({ desc: err?.message || "Reload failed", url: currentUrl });
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleOpenExternal = () => {
    const url = currentUrl || "https://www.google.com/";
    if (window.electron?.openExternal) {
      void window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(currentUrl).catch(() => {});
    setIsCopiedUrl(true);
    setTimeout(() => setIsCopiedUrl(false), 1500);
    setIsSettingsOpen(false);
  };

  const handleSetZoom = async (nextLevel: number) => {
    const clamped = Math.max(50, Math.min(200, nextLevel));
    setZoomLevel(clamped);
    if (remote && remoteWebviewShimRef.current) {
      remoteWebviewShimRef.current.setZoomFactor(clamped / 100);
      return;
    }
    await window.electron?.browser?.setZoom?.({ tabId: tab.id, factor: clamped / 100 }).catch(() => {});
  };

  const handleResetSession = async () => {
    if (isResettingSession) return;
    setIsResettingSession(true);
    setIsSettingsOpen(false);
    try {
      await window.electron?.browser?.resetSession?.();
      setHasFirstFrame(false);
      setStreamUrl(null);
      const vp = computeTargetViewport();
      const info = await window.electron?.browser?.openSession?.({
        tabId: tab.id,
        url: currentUrl,
        conversationId: tab.conversationId,
        viewport: vp,
      });
      if (mountedRef.current && info?.streamUrl) {
        setStreamUrl(info.streamUrl);
      }
    } finally {
      if (mountedRef.current) setIsResettingSession(false);
    }
  };

  // Camera Button -> copy screenshot to OS clipboard AND attach straight to chat input!
  const handleCaptureScreenshotToChat = async () => {
    if (isCapturingShot) return;
    setIsCapturingShot(true);
    try {
      const shot = await window.electron?.browser?.captureToChat?.(tab.id);
      if (shot) {
        onAttachScreenshotToChat?.(shot);
        setShotFeedback(true);
        setTimeout(() => setShotFeedback(false), 1400);
      }
    } catch (err) {
      console.error("Browser screenshot capture failed:", err);
    } finally {
      if (mountedRef.current) setIsCapturingShot(false);
    }
  };

  // Select Page / Element Picker toggle
  const toggleElementPicker = useCallback(() => {
    setIsElementPickerActive((prev) => {
      if (prev) setHoveredElement(null);
      return !prev;
    });
  }, []);

  // Cancel picker on Escape
  useEffect(() => {
    if (!isElementPickerActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsElementPickerActive(false);
        setHoveredElement(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isElementPickerActive]);

  // Minimalist Bottom Pill Actions: Stop (when running) / Continue (when paused)
  const handleStopAgent = async () => {
    const st = await window.electron?.browser?.takeControl(tab.id).catch(() => null);
    if (st) {
      setControlState({ ...st, status: "idle" });
    } else {
      setControlState((prev) => ({ ...prev, status: "idle", holder: "human", requested: false }));
    }
  };

  const handleContinueAgent = async () => {
    const st = await window.electron?.browser?.releaseControl(tab.id).catch(() => null);
    if (st) {
      setControlState({ ...st, status: st.status ?? "running" });
    } else {
      setControlState((prev) => ({ ...prev, status: "running", holder: "bot", requested: false }));
    }
  };

  // Canvas input handlers
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = mapPointerToViewport(e.clientX, e.clientY);
    if (!pt) return;

    if (isElementPickerActive) {
      const now = Date.now();
      if (inspectInFlightRef.current || now - lastInspectAtRef.current < 90) return;
      lastInspectAtRef.current = now;
      inspectInFlightRef.current = true;
      void window.electron?.browser
        ?.inspectPoint?.({ tabId: tab.id, x: pt.x, y: pt.y })
        .then((info) => {
          if (mountedRef.current && isElementPickerActive) {
            setHoveredElement(info || null);
          }
        })
        .catch(() => {})
        .finally(() => {
          inspectInFlightRef.current = false;
        });
      return;
    }

    sendWsInput({
      type: "input_mouse",
      eventType: "mouseMoved",
      x: pt.x,
      y: pt.y,
      button: "none",
      clickCount: 0,
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    canvasRef.current?.focus();
    const pt = mapPointerToViewport(e.clientX, e.clientY);
    if (!pt) return;

    if (isElementPickerActive) {
      e.preventDefault();
      e.stopPropagation();
      void window.electron?.browser
        ?.inspectPoint?.({ tabId: tab.id, x: pt.x, y: pt.y })
        .then((info) => {
          const picked = info || hoveredElement;
          setIsElementPickerActive(false);
          setHoveredElement(null);
          if (picked) {
            onSelectElementForChat?.({
              tag: picked.tag,
              id: picked.id,
              className: picked.className,
              selector: picked.selector,
              rect: { width: picked.rect.width, height: picked.rect.height },
              color: picked.color,
              font: picked.font,
              textSnippet: picked.textSnippet,
              htmlSnippet: picked.htmlSnippet,
              url: picked.url,
            });
          }
        })
        .catch(() => {
          setIsElementPickerActive(false);
          setHoveredElement(null);
        });
      return;
    }

    sendWsInput({
      type: "input_mouse",
      eventType: "mousePressed",
      x: pt.x,
      y: pt.y,
      button: cdpMouseButton(e.button),
      clickCount: Math.max(1, e.detail || 1),
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isElementPickerActive) return;
    const pt = mapPointerToViewport(e.clientX, e.clientY);
    if (!pt) return;
    sendWsInput({
      type: "input_mouse",
      eventType: "mouseReleased",
      x: pt.x,
      y: pt.y,
      button: cdpMouseButton(e.button),
      clickCount: Math.max(1, e.detail || 1),
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (isElementPickerActive) return;
    const pt = mapPointerToViewport(e.clientX, e.clientY);
    if (!pt) return;
    sendWsInput({
      type: "input_mouse",
      eventType: "mouseWheel",
      x: pt.x,
      y: pt.y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (isElementPickerActive) return;
    // Support Ctrl+V / Cmd+V pasting cleanly into focused inputs inside the page
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      void navigator.clipboard
        .readText()
        .then((text) => {
          if (text) return window.electron?.browser?.paste?.({ tabId: tab.id, text });
        })
        .catch(() => {});
      return;
    }

    if (e.key === "Tab" || e.key === "Backspace" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === " ") {
      e.preventDefault();
    }

    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    sendWsInput({
      type: "input_keyboard",
      eventType: isPrintable ? "keyDown" : "rawKeyDown",
      key: e.key,
      code: e.code,
      ...(isPrintable ? { text: e.key } : {}),
      windowsVirtualKeyCode: e.keyCode || 0,
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  const handleCanvasKeyUp = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (isElementPickerActive) return;
    sendWsInput({
      type: "input_keyboard",
      eventType: "keyUp",
      key: e.key,
      code: e.code,
      windowsVirtualKeyCode: e.keyCode || 0,
      modifiers: cdpModifiersFromEvent(e),
    });
  };

  // Compute overlay box scaled to rendered canvas CSS dimensions
  const overlayBoxStyle = useMemo(() => {
    if (!isElementPickerActive || !hoveredElement || !canvasRef.current) return null;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const { width, height } = remoteViewportSizeRef.current;
    if (width <= 0 || height <= 0 || canvasRect.width <= 0 || canvasRect.height <= 0) return null;
    const scaleX = canvasRect.width / width;
    const scaleY = canvasRect.height / height;
    const left = hoveredElement.rect.x * scaleX;
    const top = hoveredElement.rect.y * scaleY;
    const boxW = hoveredElement.rect.width * scaleX;
    const boxH = hoveredElement.rect.height * scaleY;
    const tooltipTop = top + boxH + 8 + 76 > canvasRect.height ? Math.max(8, top - 82) : top + boxH + 8;
    const tooltipLeft = Math.max(8, Math.min(left, canvasRect.width - 250));
    return { left, top, width: boxW, height: boxH, tooltipLeft, tooltipTop };
  }, [isElementPickerActive, hoveredElement]);

  const isCustomWidth = Boolean(activePresetConfig.width);
  const isPaused = controlState.status === "paused" || controlState.requested;
  const isAgentRunning = controlState.status === "running" && !isPaused;
  const showBottomPill = isPaused || isAgentRunning;

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#0f0f0f] text-white select-none overflow-hidden relative">
      {/* 1. Clean Top Browser Toolbar (matching Image 2) */}
      <div className="h-10 w-full bg-[#121212] border-b border-[#242424] flex items-center px-2 gap-1 shrink-0 z-20">
        {/* Back */}
        <button
          type="button"
          onClick={() => void handleGoBack()}
          disabled={!canGoBack}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoBack
              ? "text-[#b0b0b0] hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-[#444444] cursor-not-allowed"
          }`}
          title={t("rightPane.browserBack")}
          aria-label={t("rightPane.browserBack")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        {/* Forward */}
        <button
          type="button"
          onClick={() => void handleGoForward()}
          disabled={!canGoForward}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoForward
              ? "text-[#b0b0b0] hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-[#444444] cursor-not-allowed"
          }`}
          title={t("rightPane.browserForward")}
          aria-label={t("rightPane.browserForward")}
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Reload */}
        <button
          type="button"
          onClick={() => void handleReload(false)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#b0b0b0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={t("rightPane.browserReload")}
          aria-label={t("rightPane.browserReload")}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white/70" : ""}`} />
        </button>

        {/* Clean Pill Address Bar with integrated Site/View Settings (SlidersHorizontal) */}
        <div className="flex-1 min-w-0 relative flex items-center mx-1" ref={settingsMenuRef}>
          <div className="w-full h-7 rounded-full bg-[#1a1a1a] hover:bg-[#1f1f1f] focus-within:bg-[#161616] border border-[#2c2c2c] focus-within:border-[#404040] flex items-center px-1.5 gap-1.5 transition-colors">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                isSettingsOpen || selectedPreset !== "responsive" || zoomLevel !== 100
                  ? "text-white bg-white/12"
                  : "text-[#8e8e8e] hover:text-white hover:bg-white/10"
              }`}
              title="Page & viewport settings"
              aria-label="Page and viewport settings"
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>

            <input
              type="text"
              value={isAddressFocused ? addressBarInput : formatDisplayUrl(currentUrl)}
              onChange={(e) => setAddressBarInput(e.target.value)}
              onFocus={(e) => {
                setIsAddressFocused(true);
                setAddressBarInput(currentUrl);
                requestAnimationFrame(() => e.target.select());
              }}
              onBlur={() => {
                setIsAddressFocused(false);
                setAddressBarInput(currentUrl);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                  void handleNavigate(addressBarInput);
                } else if (e.key === "Escape") {
                  setAddressBarInput(currentUrl);
                  e.currentTarget.blur();
                }
              }}
              placeholder={t("rightPane.browserSearchPlaceholder")}
              className="flex-1 min-w-0 bg-transparent text-xs font-medium text-[#e8e8e8] placeholder-[#666666] outline-none pr-2 truncate font-sans"
            />
          </div>

          {/* Site & Viewport Settings Popover */}
          {isSettingsOpen && (
            <div className="absolute top-9 left-0 w-60 rounded-xl bg-[#1b1b1b] border border-[#2f2f2f] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
              <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#777777] uppercase">
                Viewport
              </div>
              {RESPONSIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setIsSettingsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    selectedPreset === preset.id
                      ? "bg-white/10 text-white font-medium"
                      : "text-[#bcbcbc] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{preset.label}</span>
                  {selectedPreset === preset.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}

              <div className="border-t border-[#2c2c2c] my-1" />

              {/* Zoom */}
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[11px] text-[#999999]">Zoom ({zoomLevel}%)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleSetZoom(zoomLevel - 10)}
                    disabled={zoomLevel <= 50}
                    className="p-1 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40"
                    title={t("rightPane.browserZoomOut")}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSetZoom(100)}
                    disabled={zoomLevel === 100}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40 font-mono"
                    title={t("rightPane.browserResetZoom")}
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSetZoom(zoomLevel + 10)}
                    disabled={zoomLevel >= 200}
                    className="p-1 rounded hover:bg-white/10 text-[#a0a0a0] hover:text-white cursor-pointer disabled:opacity-40"
                    title={t("rightPane.browserZoomIn")}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="border-t border-[#2c2c2c] my-1" />

              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                {isCopiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#888888]" />
                )}
                <span>{isCopiedUrl ? "Copied URL" : "Copy URL"}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleReload(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#888888]" />
                <span>Hard Reload</span>
              </button>

              <button
                type="button"
                onClick={() => void handleResetSession()}
                disabled={isResettingSession}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10 transition-colors cursor-pointer text-left disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isResettingSession ? "Clearing session..." : "Clear Shared Session"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Icon 1: Select Page Element (replacing Download icon from Image 2) */}
        <button
          type="button"
          onClick={toggleElementPicker}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isElementPickerActive
              ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              : "text-[#b0b0b0] hover:text-white hover:bg-white/10"
          }`}
          title={
            isElementPickerActive
              ? "Select page element active (Click element or Esc to cancel)"
              : "Select page element for chat"
          }
          aria-label="Select page element for chat"
        >
          <MousePointerClick className="w-3.5 h-3.5" />
        </button>

        {/* Right Icon 2: Camera (Screenshot -> Clipboard + Attach to Chat Input) */}
        <button
          type="button"
          onClick={() => void handleCaptureScreenshotToChat()}
          disabled={isCapturingShot}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            shotFeedback
              ? "text-emerald-400 bg-emerald-500/15"
              : "text-[#b0b0b0] hover:text-white hover:bg-white/10"
          }`}
          title="Capture screenshot (copy to clipboard & attach to chat)"
          aria-label="Capture screenshot"
        >
          {shotFeedback ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Camera className={`w-3.5 h-3.5 ${isCapturingShot ? "animate-pulse" : ""}`} />
          )}
        </button>

        {/* Right Icon 3: Open in External Browser */}
        <button
          type="button"
          onClick={handleOpenExternal}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#b0b0b0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Open in default browser"
          aria-label="Open in default browser"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Live Native Browser Viewport Area */}
      <div
        ref={viewportHostRef}
        className="flex-1 w-full h-full min-h-0 relative overflow-hidden bg-[#101010] flex flex-col items-center justify-center"
      >
        {/* Friendly Error Overlay */}
        {loadError && (
          <div className="absolute inset-0 z-20 bg-[#121212] flex flex-col items-center justify-center text-center p-6">
            <div className="max-w-sm mx-auto flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3.5">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {loadError.url.includes("localhost") || loadError.url.includes("127.0.0.1")
                  ? "Local server not running"
                  : "Unable to load page"}
              </h3>
              <p className="text-xs text-[#8e8e8e] mb-4 leading-relaxed">{loadError.desc}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleReload(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleNavigate("https://www.google.com/")}
                  className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-[#a0a0a0] hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Go to Google
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport Frame */}
        <div
          className={`w-full h-full flex-1 min-h-0 relative flex items-center justify-center overflow-hidden ${
            isCustomWidth ? "shadow-2xl border-x border-[#2b2b2b] bg-black mx-auto" : ""
          }`}
          style={{
            width: isCustomWidth ? `${activePresetConfig.width}px` : "100%",
            maxWidth: "100%",
            height: "100%",
          }}
        >
          {remote ? (
            <RemoteBrowserViewport
              conversationId={tab.conversationId}
              tabId={tab.id}
              url={currentUrl}
              webviewRef={remoteWebviewShimRef}
            />
          ) : (
            <>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                onWheel={handleCanvasWheel}
                onKeyDown={handleCanvasKeyDown}
                onKeyUp={handleCanvasKeyUp}
                className={`w-full h-full outline-none block ${
                  isElementPickerActive ? "cursor-crosshair" : "cursor-default"
                }`}
              />

              {/* Cold-start subtle loading indicator until first WebSocket frame arrives */}
              {!hasFirstFrame && !loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#101010] pointer-events-none">
                  <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
                  <span className="text-xs text-[#7a7a7a]">Starting browser...</span>
                </div>
              )}

              {/* React Element Picker Overlay (Zero DOM injection into target site) */}
              {overlayBoxStyle && hoveredElement && (
                <>
                  <div
                    className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/15 rounded-[3px] z-20 transition-all duration-75"
                    style={{
                      left: overlayBoxStyle.left,
                      top: overlayBoxStyle.top,
                      width: overlayBoxStyle.width,
                      height: overlayBoxStyle.height,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute z-30 bg-[#10141d] border border-[#2d3748] rounded-lg px-2.5 py-2 text-[11px] text-white shadow-2xl max-w-[240px]"
                    style={{
                      left: overlayBoxStyle.tooltipLeft,
                      top: overlayBoxStyle.tooltipTop,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 font-semibold mb-1">
                      <span className="truncate">{hoveredElement.tag}</span>
                      <span className="font-mono text-[10px] text-[#a0aec0]">
                        {hoveredElement.rect.width}×{hoveredElement.rect.height}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#94a3b8] truncate font-mono">
                      {hoveredElement.selector}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* 3. Minimalist Bottom Floating Pill (Agent Working -> Stop | Paused -> Continue) */}
        {showBottomPill && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-[#171717]/95 backdrop-blur-md border border-white/15 px-2.5 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-bottom-2 duration-150"
            title={isPaused ? controlState.reason || "Complete the step on the page, then click Continue." : "Agent is controlling the browser"}
          >
            {isPaused ? (
              <>
                <span className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Hand className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => void handleContinueAgent()}
                  className="h-6 px-3 rounded-full bg-white text-[#111111] hover:bg-white/90 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Continue</span>
                </button>
              </>
            ) : (
              <>
                <span className="w-6 h-6 rounded-full bg-white/10 text-white/85 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </span>
                <button
                  type="button"
                  onClick={() => void handleStopAgent()}
                  className="h-6 px-3 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
