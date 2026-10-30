import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Globe,
  Laptop,
  LogIn,
  Monitor,
  QrCode,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  Unplug,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  ScrollArea,
} from "@const/ui";
import { useTranslation } from "../lib/i18n";
import { useAppAuth } from "./convex-provider";
import type { RemoteDaemonStatus } from "../lib/remote-control";
import { useRemoteRuntime } from "../lib/remote-runtime";

interface RemoteControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function DeviceIcon({ name, className }: { name?: string; className?: string }) {
  const lower = (name || "").toLowerCase();
  if (
    lower.includes("iphone") ||
    lower.includes("android") ||
    lower.includes("phone") ||
    lower.includes("mobile")
  ) {
    return <Smartphone className={className} />;
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return <Tablet className={className} />;
  }
  if (
    lower.includes("mac") ||
    lower.includes("laptop") ||
    lower.includes("book")
  ) {
    return <Laptop className={className} />;
  }
  if (
    lower.includes("pc") ||
    lower.includes("windows") ||
    lower.includes("desktop") ||
    lower.includes("linux")
  ) {
    return <Monitor className={className} />;
  }
  return <Globe className={className} />;
}

function formatRelativeTime(
  timestamp: number,
  now: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!timestamp) return t("remoteControl.justNow");
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return t("remoteControl.justNow");
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return t("remoteControl.minutesAgo", { count: diffMin });
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return t("remoteControl.hoursAgo", { count: diffHours });
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RemoteControlModal(props: RemoteControlModalProps) {
  const remote = useRemoteRuntime();
  const { t } = useTranslation();
  if (!remote) return <HostRemoteControlModal {...props} />;
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent
        hideClose
        className="w-[calc(100vw-32px)] max-w-md border border-[#dedee2] dark:border-[#333333] rounded-2xl bg-white dark:bg-[#161616] p-6 text-[#262626] dark:text-[#d4d4d4] outline-none focus:outline-none ring-0"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-[#222222] text-[#262626] dark:text-white">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-medium text-[#111111] dark:text-white leading-tight">
                {t("remoteControl.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373] dark:text-[#969696] truncate">
                {remote.deviceName}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={props.onClose}
            aria-label={t("common.close")}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-[#737373] dark:text-[#969696] hover:bg-black/5 dark:hover:bg-[#2b2b2b] transition-colors outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-[#f4f4f5] dark:bg-[#202020] border border-[#dedee2] dark:border-[#303030]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              remote.online ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <p className="text-xs text-[#262626] dark:text-white font-medium">
            {t(
              remote.online
                ? "remoteControl.mobileConnected"
                : "remoteControl.mobileDisconnected",
            )}
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 px-4 py-2 text-xs font-medium text-[#262626] dark:text-white transition-colors outline-none"
            onClick={() => void remote.disconnect?.()}
          >
            {t("common.stop")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HostRemoteControlModal({ isOpen, onClose }: RemoteControlModalProps) {
  const { t } = useTranslation();
  const auth = useAppAuth();
  const [status, setStatus] = useState<RemoteDaemonStatus | null>(null);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState<"startError" | "actionError" | null>(null);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairingUrl = useRef(status?.pairingUrl);
  pairingUrl.current = status?.pairingUrl;

  const authToken =
    auth?.token || localStorage.getItem("const_harness_auth_token") || "";
  const isLoggedIn = !!authToken;

  // Opening only observes status. Starting network access is an explicit action.
  useEffect(() => {
    const current = ++generation.current;
    if (!isOpen) return;
    setStatus(null);
    setError(null);
    setCopied(false);
    setBusy(true);
    const api = window.electron?.remote;
    let receivedEvent = false;
    const unsubscribe = api?.onStatusChange((next) => {
      receivedEvent = true;
      if (generation.current === current) setStatus(next);
    });
    void (async () => {
      try {
        if (!api) throw new Error("REMOTE_UNAVAILABLE");
        const next = await api.getStatus();
        if (generation.current === current && !receivedEvent) setStatus(next);
      } catch {
        if (generation.current === current) setError("startError");
      } finally {
        if (generation.current === current) setBusy(false);
      }
    })();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      generation.current++;
      unsubscribe?.();
      clearInterval(timer);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (codeTimer.current) clearTimeout(codeTimer.current);
    };
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setCopied(false);
    setCopiedCode(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (codeTimer.current) clearTimeout(codeTimer.current);
    const url = status?.pairingUrl;
    if (isOpen && url) {
      void QRCode.toDataURL(url, {
        width: 300,
        margin: 4,
        errorCorrectionLevel: "M",
      }).then(
        (image) => {
          if (!cancelled) setQr({ url, image });
        },
        () => {
          if (!cancelled) setError("actionError");
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, status?.pairingUrl]);

  const handleLogin = async () => {
    try {
      if (window.electron?.startAuth) {
        await window.electron.startAuth({
          accountsUrl: "https://accounts.const.web.id",
        });
      } else {
        window.open("https://accounts.const.web.id", "_blank");
      }
    } catch {
      setError("startError");
    }
  };

  const run = async (action: "start" | "stop" | "refresh") => {
    const api = window.electron?.remote;
    if (!api || busy) return;
    if (action === "start" && !isLoggedIn) {
      void handleLogin();
      return;
    }
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = await (action === "start"
        ? api.startSession(authToken)
        : action === "stop"
          ? api.stopSession()
          : api.refreshSession());
      if (generation.current === current) {
        setStatus(next);
        setNow(Date.now());
      }
    } catch (err) {
      console.error("[RemoteModal] Failed to " + action + " session:", err);
      if (generation.current === current)
        setError(action === "start" ? "startError" : "actionError");
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };

  const copy = async () => {
    if (!status?.pairingUrl) return;
    const current = generation.current;
    const copiedUrl = status.pairingUrl;
    try {
      await navigator.clipboard.writeText(copiedUrl);
      if (generation.current !== current || pairingUrl.current !== copiedUrl)
        return;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (generation.current === current) setError("actionError");
    }
  };

  const copyCode = async (code: string) => {
    const current = generation.current;
    try {
      await navigator.clipboard.writeText(code);
      if (generation.current !== current) return;
      setCopiedCode(true);
      if (codeTimer.current) clearTimeout(codeTimer.current);
      codeTimer.current = setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      if (generation.current === current) setError("actionError");
    }
  };

  const stopped = !status || status.status === "idle";
  const expired = !stopped && now >= (status.expiresAt ?? 0);
  const connectedCount = status?.connectedDevices?.length ?? 0;
  const isConnected = !stopped && (status.status === "connected" || connectedCount > 0);

  const button =
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f4f4f5] dark:bg-[#2b2b2b] px-3 py-1.5 text-xs font-sans text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#e8e8ea] dark:hover:bg-[#383838] disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:outline-none ring-0 transition-colors";
  const primaryButton =
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#2a2a2a] dark:hover:bg-[#f0f0f0] px-3.5 py-1.5 text-xs font-sans font-medium disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:outline-none ring-0 transition-colors shadow-sm";
  const stopButton =
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/15 border border-red-500/20 px-3 py-1.5 text-xs font-sans font-medium disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:outline-none ring-0 transition-colors";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="w-[calc(100vw-32px)] max-w-[820px] max-h-[calc(100dvh-32px)] flex flex-col gap-0 rounded-2xl bg-white dark:bg-[#161616] border border-[#dedee2] dark:border-[#333333] p-0 text-[#262626] dark:text-[#d4d4d4] shadow-2xl outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-[#202020] border border-[#dedee2] dark:border-[#333333] text-[#262626] dark:text-white">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-medium text-[#111111] dark:text-white leading-tight">
                {t("remoteControl.title")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-[#737373] dark:text-[#969696] truncate">
                {t("remoteControl.description")}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-[#737373] dark:text-[#969696] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#2b2b2b] transition-colors outline-none focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea
          className="min-h-0 flex-1"
          thumbClassName="bg-white/20 hover:bg-white/30"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[280px_minmax(0,1fr)] gap-6 p-6 pt-2">
            {/* Left Column: QR Code */}
            <div className="flex flex-col items-center justify-between rounded-2xl bg-[#f4f4f5] dark:bg-[#202020] border border-[#dedee2] dark:border-[#2e2e2e] p-5 min-h-[320px]">
              <div className="flex flex-1 items-center justify-center w-full">
                {busy ? (
                  <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 text-[#737373] dark:text-[#969696]">
                    <RotateCw
                      aria-label={t("remoteControl.loading")}
                      className="h-7 w-7 animate-spin"
                    />
                    <span className="text-xs">{t("remoteControl.loading")}</span>
                  </div>
                ) : !expired && qr && qr.url === status?.pairingUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#e5e5e5] dark:border-transparent">
                    <img
                      src={qr.image}
                      alt={t("remoteControl.qrAlt")}
                      className="h-[200px] w-[200px] rounded-lg block select-none"
                    />
                  </div>
                ) : (
                  <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-3 rounded-2xl bg-black/5 dark:bg-white/[0.03] text-[#737373] dark:text-[#8e8e93] border border-dashed border-[#dedee2] dark:border-[#333333] p-4 text-center">
                    <QrCode className="h-10 w-10 text-[#969696] dark:text-[#777777]" />
                    <span className="text-xs text-[#737373] dark:text-[#969696]">
                      {t(
                        expired
                          ? "remoteControl.expired"
                          : stopped
                            ? "remoteControl.scanHint"
                            : "remoteControl.scan",
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-center w-full">
                {expired ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {t("remoteControl.expired")}
                  </p>
                ) : !stopped ? (
                  <div className="flex flex-col items-center gap-2">
                    {status?.pairingCode && (
                      <div className="w-full flex flex-col items-center gap-1 py-2 px-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-[#dedee2] dark:border-[#303030]">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-[#737373] dark:text-[#8e8e93]">
                          Pairing Code
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold tracking-widest text-[#111111] dark:text-white select-all">
                            {status.pairingCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyCode(status.pairingCode!)}
                            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[#737373] dark:text-[#8e8e93] transition-colors"
                            title="Copy code"
                          >
                            {copiedCode ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs font-medium text-[#262626] dark:text-[#e5e5e5]">
                      {t("remoteControl.scan")}
                    </p>
                    {status?.expiresAt && (
                      <span className="text-[11px] text-[#737373] dark:text-[#8e8e93]">
                        {Math.max(
                          1,
                          Math.ceil((status.expiresAt - now) / 60_000),
                        )}
                        m left
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#737373] dark:text-[#8e8e93]">
                    {t("remoteControl.scanHint")}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Controls, Destination & Connected Devices */}
            <div className="flex min-w-0 flex-col gap-3.5 justify-start">
              {/* Status Header & Action Button */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {stopped ? (
                    <span className="h-2 w-2 rounded-full bg-[#737373] dark:bg-[#555555] shrink-0" />
                  ) : isConnected ? (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                  )}
                  <h3
                    role="status"
                    className="text-sm font-medium text-[#111111] dark:text-white truncate"
                  >
                    {t(
                      busy
                        ? "remoteControl.loading"
                        : stopped
                          ? "remoteControl.stopped"
                          : isConnected
                            ? "remoteControl.connected"
                            : "remoteControl.waiting",
                    )}
                  </h3>
                  {!stopped && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-sans font-medium rounded-full border shrink-0 ${
                        connectedCount > 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-black/5 dark:bg-white/5 text-[#737373] dark:text-[#969696] border-transparent"
                      }`}
                    >
                      {t("remoteControl.pairedDevices", {
                        count: connectedCount,
                        max: 4,
                      })}
                    </span>
                  )}
                </div>

                <button
                  className={stopped ? primaryButton : stopButton}
                  disabled={busy || !window.electron?.remote}
                  onClick={() => void run(stopped ? "start" : "stop")}
                >
                  {busy ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="h-3.5 w-3.5" />
                  )}
                  <span>{t(stopped ? "remoteControl.start" : "common.stop")}</span>
                </button>
              </div>

              {/* Endpoint domain confirmation */}
              {status?.pairingUrl ? (
                <div className="flex flex-col gap-1.5 rounded-xl bg-[#f4f4f5] dark:bg-[#202020] border border-[#dedee2] dark:border-[#303030] p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-[#262626] dark:text-[#e5e5e5] truncate">
                      <Globe className="h-3.5 w-3.5 text-[#737373] dark:text-[#969696] shrink-0" />
                      {new URL(status.pairingUrl).host}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-black/5 dark:bg-white/10 text-[#737373] dark:text-[#d4d4d4] px-1.5 py-0.5 rounded shrink-0">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      {t("remoteControl.encryption")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 text-[11px] font-mono text-[#737373] dark:text-[#888888] truncate select-all bg-black/5 dark:bg-[#161616] px-2 py-1 rounded">
                      {status.pairingUrl.split("#")[0]}
                    </div>
                    <button
                      onClick={() => void copy()}
                      title={t("remoteControl.copy")}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-black/5 dark:bg-[#2b2b2b] hover:bg-black/10 dark:hover:bg-[#383838] text-[#262626] dark:text-white transition-colors"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {t(copied ? "common.copied" : "remoteControl.copy")}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#969696] px-1">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t("remoteControl.target", { host: "harness.const.web.id" })}
                  </span>
                </div>
              )}

              {/* Login required warning if stopped and not logged in */}
              {stopped && !isLoggedIn && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-medium">
                    {t("remoteControl.loginRequired")}
                  </span>
                  <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition-colors"
                    onClick={() => void handleLogin()}
                  >
                    <LogIn className="h-3 w-3" />
                    <span>{t("auth.signInButton")}</span>
                  </button>
                </div>
              )}

              {/* Connected Devices Section */}
              {!stopped && (
                <div className="flex flex-col gap-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#262626] dark:text-white">
                        {t("remoteControl.connectedDevicesTitle")}
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#8e8e93]">
                        ({connectedCount})
                      </span>
                    </div>
                    {connectedCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {t("remoteControl.activeNow")}
                      </span>
                    )}
                  </div>

                  {connectedCount > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-hidden">
                      {status.connectedDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f4f4f5] dark:bg-[#202020] border border-[#dedee2] dark:border-[#303030] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-[#282828] text-[#262626] dark:text-white">
                              <DeviceIcon
                                name={device.name}
                                className="h-4 w-4"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-[#111111] dark:text-white truncate">
                                  {device.name ||
                                    t("remoteControl.unknownDevice")}
                                </span>
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#737373] dark:text-[#8e8e93] mt-0.5">
                                <span>
                                  {formatRelativeTime(
                                    device.connectedAt,
                                    now,
                                    t,
                                  )}
                                </span>
                                <span>•</span>
                                <span className="font-mono text-[#8e8e93] dark:text-[#666666]">
                                  {device.id.slice(0, 10)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {t("remoteControl.deviceActive")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-[#dedee2] dark:border-[#303030]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-[#737373] dark:text-[#8e8e93]">
                        <Smartphone className="h-4 w-4 opacity-70 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#737373] dark:text-[#a0a0a0]">
                          {t("remoteControl.noDevicesConnected")}
                        </p>
                        <p className="text-[11px] text-[#8e8e93] dark:text-[#666666] mt-0.5">
                          {t("remoteControl.waitingForDevice")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions text */}
              <p className="text-xs leading-relaxed text-[#737373] dark:text-[#969696]">
                {t("remoteControl.network")}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={busy || stopped}
                  onClick={() => void run("refresh")}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{t("remoteControl.refresh")}</span>
                </button>
                <button
                  className={button}
                  disabled={busy || stopped || expired}
                  onClick={() => void copy()}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {t(copied ? "common.copied" : "remoteControl.copy")}
                  </span>
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-xs text-red-500 dark:text-red-400 font-medium"
                >
                  {t(`remoteControl.${error}`)}
                </p>
              )}

              {/* Scope & Permissions Warning */}
              <p className="text-[11px] leading-relaxed text-[#8e8e93] dark:text-[#777777]">
                {t("remoteControl.scope")}
              </p>

              {/* Host Machine & Encryption Footnote */}
              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs text-[#737373] dark:text-[#969696]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Monitor className="h-3.5 w-3.5 shrink-0 text-[#737373] dark:text-[#8e8e93]" />
                  <span className="text-[11px] text-[#737373] dark:text-[#8e8e93]">
                    {t("remoteControl.hostDevice")}:
                  </span>
                  <span className="font-mono text-[11px] text-[#262626] dark:text-[#d4d4d4] truncate select-all">
                    {status?.deviceId || "desktop"}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] shrink-0 text-[#737373] dark:text-[#8e8e93]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {t("remoteControl.security")}
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
