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
  Smartphone,
  Tablet,
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
import { SettingsRow, SettingsSection, settingsButton, settingsPrimaryButton } from "./settings/settings-controls";

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
  const [error, setError] = useState<"startError" | "actionError" | "authError" | null>(null);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
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
    } catch (err: any) {
      console.error("[RemoteModal] Failed to " + action + " session:", err);
      const errMsg = String(err?.message || err?.data?.code || err || "");
      const isAuthIssue =
        errMsg.includes("UNAUTHORIZED") ||
        errMsg.includes("LOGIN_REQUIRED") ||
        errMsg.includes("unauthorized") ||
        errMsg.includes("auth");
      if (generation.current === current)
        setError(action === "start" ? (isAuthIssue ? "authError" : "startError") : "actionError");
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
    const copiedUrl = pairingUrl.current;
    try {
      await navigator.clipboard.writeText(code);
      if (generation.current !== current || pairingUrl.current !== copiedUrl) return;
      setCopiedCode(true);
      if (codeTimer.current) clearTimeout(codeTimer.current);
      codeTimer.current = setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      if (generation.current === current) setError("actionError");
    }
  };

  const openHub = async (url: string) => {
    const api = window.electron;
    if (!api?.openExternal) return;
    const current = generation.current;
    try {
      await api.openExternal(url);
    } catch {
      if (generation.current === current) setError("actionError");
    }
  };

  const stopped = !status || status.status === "idle";
  const expired = !stopped && now >= (status.expiresAt ?? 0);
  const connectedCount = status?.connectedDevices?.length ?? 0;
  const isConnected = !stopped && (status.status === "connected" || connectedCount > 0);

  const focus = "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:focus-visible:outline-[#969696]";
  const button = settingsButton + " " + focus;
  const primaryButton = settingsPrimaryButton + " " + focus;
  const hubUrl = status?.pairingUrl ? new URL("/remote", status.pairingUrl).href : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        ref={dialogRef}
        hideClose
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogRef.current?.focus({ preventScroll: true });
        }}
        className="w-[calc(100vw-32px)] max-w-[600px] max-h-[calc(100dvh-32px)] flex flex-col gap-0 rounded-2xl bg-white dark:bg-[#161616] border border-neutral-200 dark:border-[#383838] p-0 text-neutral-900 dark:text-white outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
          <div className="min-w-0">
            <DialogTitle className="text-base font-medium">{t("remoteControl.title")}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-relaxed text-neutral-500 dark:text-[#969696]">
              {t("remoteControl.description")}
            </DialogDescription>
          </div>
          <button type="button" data-remote-control-close onClick={onClose} aria-label={t("common.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-neutral-500 shadow-none outline-none ring-0 hover:bg-black/5 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-neutral-200/60 dark:text-[#969696] dark:hover:bg-[#2b2b2b] dark:focus-visible:bg-[#2b2b2b]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="min-h-0 flex-1" thumbClassName="bg-neutral-400/40 hover:bg-neutral-400/60">
          <div className="space-y-5 px-6 pb-6">
            <SettingsSection>
              <SettingsRow
                label={t(busy ? "remoteControl.loading" : stopped ? "remoteControl.stopped" : isConnected ? "remoteControl.connected" : "remoteControl.waiting")}
                hint={t("remoteControl.pairedDevices", { count: connectedCount, max: 4 })}
              >
                <button type="button" className={stopped ? primaryButton : button}
                  disabled={busy || !window.electron?.remote}
                  onClick={() => void run(stopped ? "start" : "stop")}>
                  {busy && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                  {t(stopped ? (isLoggedIn ? "remoteControl.start" : "auth.signInButton") : "common.stop")}
                </button>
              </SettingsRow>
            </SettingsSection>

            <SettingsSection title={t("remoteControl.pairDevice")}>
              {expired ? (
                <div className="py-4 text-[13px] text-neutral-500 dark:text-[#969696]" role="status">
                  {t("remoteControl.expired")}
                </div>
              ) : (
                <div className="grid items-center gap-5 py-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="flex justify-center">
                    {!stopped && qr && qr.url === status?.pairingUrl ? (
                      <img src={qr.image} alt={t("remoteControl.qrAlt")}
                        className="h-40 w-40 rounded-xl bg-white select-none" />
                    ) : (
                      <div data-pairing-placeholder aria-hidden="true" className="flex h-40 w-40 items-center justify-center rounded-xl bg-neutral-200/60 text-neutral-500 dark:bg-[#2b2b2b] dark:text-[#969696]">
                        <QrCode className="h-12 w-12" strokeWidth={1.25} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    {stopped ? (
                      <p className="text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">{t("remoteControl.startHint")}</p>
                    ) : status?.pairingCode ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void copyCode(status.pairingCode!)}
                          title={t("remoteControl.copyCode")} aria-label={t("remoteControl.copyCode")}
                          className={"inline-flex min-h-11 max-w-full items-center gap-3 rounded-lg px-1 text-2xl font-medium tabular-nums tracking-[0.12em] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 " + focus}>
                          {status.pairingCode}
                          {copiedCode ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0 text-neutral-500 dark:text-[#969696]" />}
                        </button>
                        <p className="text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">
                          {t("remoteControl.codeHint")}{" "}
                          <a href={hubUrl} target="_blank" rel="noreferrer"
                            onClick={event => { if (window.electron?.openExternal) { event.preventDefault(); void openHub(hubUrl); } }}
                            className={"break-all text-neutral-900 underline underline-offset-2 dark:text-[#d4d4d4] " + focus}>
                            {hubUrl.replace(/^https?:\/\//, "")}
                          </a>
                        </p>
                      </>
                    ) : (
                      <p className="text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">
                        {t(status?.transport === "relay" ? "remoteControl.codeUnavailable" : "remoteControl.scanHint")}
                      </p>
                    )}
                    {status?.expiresAt && (
                      <p className="text-xs text-neutral-500 dark:text-[#969696]" role="status">
                        {t("remoteControl.expiresIn", { count: Math.max(1, Math.ceil((status.expiresAt - now) / 60_000)) })}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pb-3">
                <button type="button" className={button} disabled={busy || stopped || expired || !status?.pairingUrl} onClick={() => void copy()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {t(copied ? "common.copied" : "remoteControl.copy")}
                </button>
                <button type="button" className={button} disabled={busy || stopped} onClick={() => void run("refresh")}
                  title={t("remoteControl.refreshHint")}>
                  <RotateCw className="h-3.5 w-3.5" />
                  {t("remoteControl.refresh")}
                </button>
              </div>
              <p className="pb-3 text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">
                {t("remoteControl.network")}
              </p>
            </SettingsSection>

            {!stopped && connectedCount > 0 && (
              <SettingsSection title={t("remoteControl.connectedDevicesTitle")}>
                {status.connectedDevices.map(device => (
                  <div key={device.id} className="flex items-center gap-3 py-3">
                    <DeviceIcon name={device.name} className="h-4 w-4 shrink-0 text-neutral-500 dark:text-[#969696]" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[13px]">{device.name || t("remoteControl.unknownDevice")}</p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-[#969696]">{formatRelativeTime(device.connectedAt, now, t)}</p>
                    </div>
                  </div>
                ))}
              </SettingsSection>
            )}

            {stopped && !isLoggedIn && <p className="text-xs text-neutral-500 dark:text-[#969696]">{t("remoteControl.loginRequired")}</p>}
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
                <span role="alert" className="min-w-0 flex-1">{t("remoteControl." + error)}</span>
                {error === "authError" && <button type="button" className={button} onClick={() => void handleLogin()}>{t("auth.signInButton")}</button>}
              </div>
            )}
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">{t("remoteControl.scope")}</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
