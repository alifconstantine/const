import React, { useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ConvexClient } from "convex/browser";
import {
  ArrowLeft,
  ArrowRight,
  Clipboard,
  Laptop,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TvMinimal,
  X,
} from "lucide-react";
import { ConstLogoIcon } from "@const/ui";
import { DEFAULT_CONVEX_URL } from "@const/remote/config";
import { broker } from "@const/remote/protocol";
import { normalizePairingCode, openWithCode } from "@const/remote/crypto";

interface ActiveSessionItem {
  sessionId: string;
  deviceName: string;
  pairingCode?: string;
  isOnline: boolean;
  expiresAt: number;
  pairExpiresAt: number;
  hasPairingCode: boolean;
}

interface ConnectedSession {
  sessionId: string;
  key: string;
  deviceName?: string;
}

const DEFAULT_ACCOUNTS_URL = "https://accounts.const.web.id";
const DEFAULT_WEB_URL = "https://harness.const.web.id";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [connectedSession, setConnectedSession] = useState<ConnectedSession | null>(null);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);

  const convexUrl = (import.meta.env.VITE_CONVEX_URL as string) || DEFAULT_CONVEX_URL;
  const accountsUrl = (import.meta.env.VITE_ACCOUNTS_URL as string) || DEFAULT_ACCOUNTS_URL;
  const webBaseUrl = (import.meta.env.VITE_WEB_URL as string) || DEFAULT_WEB_URL;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper to extract token from URL / deep link
  const extractToken = (rawUrl: string) => {
    try {
      const match = rawUrl.match(/[?&]token=([^&"'\s]+)/);
      const urlToken = match?.[1] ? decodeURIComponent(match[1]) : null;
      return urlToken;
    } catch {
      return null;
    }
  };

  const handleTokenReceived = (newToken: string) => {
    localStorage.setItem("const_harness_token", newToken);
    localStorage.setItem("const_sso_token", newToken);
    sessionStorage.setItem("const_remote_token", newToken);
    setToken(newToken);
    setIsWaitingAuth(false);
  };

  // 1. Initial auth state restoration & deep link handling
  useEffect(() => {
    const saved =
      localStorage.getItem("const_harness_token") ||
      localStorage.getItem("const_sso_token") ||
      sessionStorage.getItem("const_remote_token");
    if (saved) {
      setToken(saved);
    }

    const { token: urlToken } = { token: extractToken(window.location.href) };
    if (urlToken) {
      handleTokenReceived(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    let cleanupListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.getLaunchUrl().then((launch) => {
        if (launch?.url) {
          const deepToken = extractToken(launch.url);
          if (deepToken) handleTokenReceived(deepToken);
        }
      });

      CapApp.addListener("appUrlOpen", (data) => {
        if (data?.url) {
          const deepToken = extractToken(data.url);
          if (deepToken) {
            handleTokenReceived(deepToken);
            try {
              void Browser.close();
            } catch {
              // ignore browser close errors
            }
          }
        }
      }).then((handle) => {
        cleanupListener = () => handle.remove();
      });
    }

    setInitializing(false);

    return () => {
      cleanupListener?.();
    };
  }, []);

  // 2. Discover active desktop sessions
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);

    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const result = (await client.query(broker.listMySessions, {})) as ActiveSessionItem[];
        if (!cancelled && Array.isArray(result)) {
          setSessions(result);
        }
      } catch {
        // query may fail if token expired
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };

    void fetchSessions();
    const interval = setInterval(() => void fetchSessions(), 12_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      void client.close();
    };
  }, [token, convexUrl]);

  // Auth Actions
  const handleSignIn = async () => {
    setIsWaitingAuth(true);
    const isNative = Capacitor.isNativePlatform();
    const continueTarget = isNative
      ? "const-harness://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account&app=harness`;

    if (isNative) {
      try {
        await Browser.open({ url: targetUrl, presentationStyle: "popover" });
      } catch {
        window.location.href = targetUrl;
      }
    } else {
      window.location.href = targetUrl;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_harness_token");
    localStorage.removeItem("const_sso_token");
    sessionStorage.removeItem("const_remote_token");
    setToken(null);
    setConnectedSession(null);
    setSessions([]);
  };

  // Pairing code formatting
  const handleCodeChange = (value: string) => {
    setError(null);
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    if (cleaned.length > 3) {
      setPairingCode(`${cleaned.slice(0, 3)}-${cleaned.slice(3)}`);
    } else {
      setPairingCode(cleaned);
    }
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (text.includes("/r/")) {
          setDirectUrl(text);
          setShowDirectInput(true);
        } else {
          handleCodeChange(text);
        }
      }
    } catch {
      // clipboard read denied
    }
  };

  // Connect using 6-digit pairing code
  const handleConnectWithCode = async (codeToUse?: string) => {
    const rawCode = codeToUse || pairingCode;
    const normalized = normalizePairingCode(rawCode);
    if (normalized.length !== 6) {
      setError("Please enter a valid 6-character code (XXX-XXX).");
      return;
    }

    if (!token) {
      handleSignIn();
      return;
    }

    setConnecting(true);
    setError(null);
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);

    try {
      const formatted = `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
      const result = (await client.query(broker.resolvePairingCode, {
        code: formatted,
      })) as {
        sessionId: string;
        deviceName: string;
        encryptedSecret: string;
        pairHash: string;
      };

      if (!result?.sessionId || !result?.encryptedSecret) {
        throw new Error("Invalid response from relay");
      }

      // Decrypt the secret key client-side with code-derived key
      const secret = await openWithCode(normalized, result.encryptedSecret);
      if (!secret) {
        throw new Error("Could not decrypt session key. Check your code.");
      }

      setConnectedSession({
        sessionId: result.sessionId,
        key: secret,
        deviceName: result.deviceName || "Desktop Host",
      });
    } catch (err: any) {
      setError(
        err?.message ||
          "Session not found or code expired. Make sure Const Harness Desktop is active.",
      );
    } finally {
      setConnecting(false);
      void client.close();
    }
  };

  // Direct URL parser
  const handleConnectDirectUrl = () => {
    setError(null);
    try {
      const parsed = new URL(directUrl.trim());
      const parts = parsed.pathname.split("/").filter(Boolean);
      const rIndex = parts.indexOf("r");
      const sessionId = rIndex >= 0 ? parts[rIndex + 1] : parts[0];
      const key = new URLSearchParams(parsed.hash.slice(1)).get("key");

      if (!sessionId || !key) {
        setError("Invalid URL. URL must look like: https://.../r/[sessionId]#key=[secret]");
        return;
      }

      setConnectedSession({
        sessionId,
        key,
        deviceName: "Remote Host",
      });
    } catch {
      setError("Please enter a valid URL.");
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    const lower = deviceName.toLowerCase();
    if (lower.includes("phone") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone className="h-5 w-5 text-zinc-400" />;
    }
    if (lower.includes("mac") || lower.includes("laptop") || lower.includes("thinkpad")) {
      return <Laptop className="h-5 w-5 text-zinc-400" />;
    }
    return <Monitor className="h-5 w-5 text-zinc-400" />;
  };

  if (initializing) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0a] text-zinc-500">
        <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // SCREEN 3: Active Connected Remote Workspace
  if (connectedSession) {
    const remoteTargetUrl = `${webBaseUrl.replace(/\/+$/, "")}/r/${connectedSession.sessionId}#key=${encodeURIComponent(connectedSession.key)}`;

    return (
      <div className="relative flex h-full w-full flex-col bg-[#0a0a0a] text-white">
        {/* Mobile Control Header */}
        {isToolbarExpanded ? (
          <header className="safe-top-padding relative z-50 flex items-center justify-between border-b border-zinc-800/80 bg-[#141416]/95 px-3.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setConnectedSession(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:opacity-70 transition-colors"
                aria-label="Disconnect"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                  <span className="truncate text-xs font-semibold text-zinc-100">
                    {connectedSession.deviceName || "Desktop Workspace"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  ID: {connectedSession.sessionId.slice(0, 12)}...
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (iframeRef.current) {
                    iframeRef.current.src = remoteTargetUrl;
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:opacity-70 transition-colors"
                title="Reload Session"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsToolbarExpanded(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:opacity-70 transition-colors"
                title="Collapse Bar"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConnectedSession(null)}
                className="flex h-8 px-2.5 items-center gap-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </header>
        ) : (
          <button
            onClick={() => setIsToolbarExpanded(true)}
            className="safe-top-padding absolute top-2 right-2 z-50 flex h-8 items-center gap-1.5 rounded-full border border-zinc-800 bg-[#141416]/90 px-2.5 py-1 text-xs text-zinc-300 backdrop-blur-md shadow-md active:scale-95 transition-all"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Embedded Remote Workspace Frame */}
        <div className="relative flex-1 w-full h-full bg-[#0a0a0a] overflow-hidden">
          <iframe
            ref={iframeRef}
            src={remoteTargetUrl}
            className="w-full h-full border-none select-auto"
            allow="clipboard-read; clipboard-write; fullscreen"
            title="Const Remote Desktop Workspace"
          />
        </div>
      </div>
    );
  }

  // SCREEN 1: Sign in Screen
  if (!token) {
    return (
      <div className="safe-top-padding safe-bottom-padding flex flex-1 flex-col justify-between px-6 py-8 bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ConstLogoIcon className="h-7 w-7 text-white" />
            <span className="text-sm font-semibold tracking-wide text-zinc-100">
              CONST HARNESS
            </span>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
            REMOTE
          </span>
        </div>

        <div className="my-auto flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm">
            <Radio className="h-8 w-8 text-blue-500 animate-pulse" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Remote Workspace
          </h1>
          <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-zinc-400">
            Connect to and control your desktop Const Harness workspace remotely with end-to-end encryption.
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={handleSignIn}
              disabled={isWaitingAuth}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-zinc-950 shadow-sm hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isWaitingAuth ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>{isWaitingAuth ? "Signing in..." : "Sign in with Const Accounts"}</span>
            </button>

            <button
              onClick={() => setShowDirectInput(!showDirectInput)}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors py-2 cursor-pointer"
            >
              {showDirectInput ? "Hide manual pairing" : "Have a direct pairing link?"}
            </button>
          </div>

          {showDirectInput && (
            <div className="ch-card mt-4 w-full max-w-xs rounded-2xl p-4 text-left">
              <label className="text-xs font-medium text-zinc-300">
                Direct Pairing URL
              </label>
              <input
                type="text"
                placeholder="https://.../r/[id]#key=..."
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <button
                onClick={handleConnectDirectUrl}
                className="mt-3 w-full rounded-xl bg-zinc-800 py-2 text-xs font-medium text-white hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
              >
                Connect Direct
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Zero-Knowledge Relay • AES-256-GCM</span>
        </div>
      </div>
    );
  }

  // SCREEN 2: Authenticated - Pairing & Active Sessions Screen
  return (
    <div className="safe-top-padding safe-bottom-padding flex flex-1 flex-col justify-between px-5 py-6 overflow-y-auto bg-[#0a0a0a]">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <ConstLogoIcon className="h-7 w-7 text-white" />
          <div>
            <h2 className="text-sm font-semibold text-white">Const Harness</h2>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-subtle" />
              Connected to Cloud
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 space-y-6 pt-2">
        {/* Pairing Code Card */}
        <section className="ch-card relative overflow-hidden rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Enter Pairing Code</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                From Const Harness Desktop (Remote Modal)
              </p>
            </div>
            <button
              onClick={handlePasteCode}
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <Clipboard className="h-3 w-3" />
              <span>Paste</span>
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="relative">
              <input
                type="text"
                maxLength={7}
                placeholder="XXX-XXX"
                value={pairingCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleConnectWithCode();
                  }
                }}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3 text-center font-mono text-2xl font-bold tracking-widest text-zinc-100 uppercase placeholder-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              onClick={() => void handleConnectWithCode()}
              disabled={connecting || pairingCode.replace("-", "").length !== 6}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-zinc-950 shadow-sm hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {connecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>{connecting ? "Connecting to Desktop..." : "Connect to Desktop"}</span>
            </button>
          </div>
        </section>

        {/* Active Desktop Sessions List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Active Desktop Sessions ({sessions.length})
            </h3>
            {loadingSessions && (
              <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="ch-card flex flex-col items-center justify-center rounded-2xl p-6 text-center text-zinc-400">
              <TvMinimal className="h-7 w-7 text-zinc-600 mb-2" />
              <p className="text-xs font-medium text-zinc-300">
                No active desktop sessions
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
                Open Const Harness on your desktop and click the Remote icon in the titlebar.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((item) => (
                <div
                  key={item.sessionId}
                  className="ch-card-interactive flex items-center justify-between rounded-xl p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                      {getDeviceIcon(item.deviceName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.isOnline ? "bg-emerald-500 animate-pulse-subtle" : "bg-amber-400"
                          }`}
                        />
                        <span className="truncate text-xs font-medium text-zinc-200">
                          {item.deviceName}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {item.pairingCode ? (
                          <span className="text-zinc-300 font-semibold">
                            Code: {item.pairingCode}
                          </span>
                        ) : (
                          <span className="text-zinc-500">Direct Relay Session</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.pairingCode ? (
                    <button
                      onClick={() => void handleConnectWithCode(item.pairingCode)}
                      disabled={connecting}
                      className="shrink-0 flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 px-3 py-1.5 text-xs font-medium text-zinc-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Connect</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-500">Online</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Fallback Direct Pairing Link */}
        <section className="pt-1">
          <button
            onClick={() => setShowDirectInput(!showDirectInput)}
            className="flex w-full items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2 cursor-pointer"
          >
            <span>{showDirectInput ? "Hide Direct Link Input" : "Paste Direct Pairing URL"}</span>
          </button>

          {showDirectInput && (
            <div className="ch-card mt-2 rounded-xl p-3.5">
              <label className="text-xs font-medium text-zinc-300">
                Direct Pairing URL
              </label>
              <input
                type="text"
                placeholder="https://.../r/[sessionId]#key=[secret]"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <button
                onClick={handleConnectDirectUrl}
                className="mt-3 w-full rounded-lg bg-zinc-800 py-2 text-xs font-medium text-white hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
              >
                Connect to URL
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Footer Info */}
      <footer className="pt-4 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/60">
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Zero-Knowledge Relay</span>
        </div>
        <span>v0.0.1</span>
      </footer>
    </div>
  );
}
