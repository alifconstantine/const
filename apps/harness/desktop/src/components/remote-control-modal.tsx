import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Monitor, QrCode, RotateCw, Smartphone, Unplug, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, ScrollArea } from "@const/ui";
import { useTranslation } from "../lib/i18n";
import type { RemoteDaemonStatus } from "../lib/remote-control";

interface RemoteControlModalProps { isOpen: boolean; onClose: () => void }

export function RemoteControlModal({ isOpen, onClose }: RemoteControlModalProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RemoteDaemonStatus | null>(null);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<"startError" | "actionError" | null>(null);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairingUrl = useRef(status?.pairingUrl);
  pairingUrl.current = status?.pairingUrl;

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
      } catch { if (generation.current === current) setError("startError"); }
      finally { if (generation.current === current) setBusy(false); }
    })();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      generation.current++;
      unsubscribe?.();
      clearInterval(timer);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setCopied(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    const url = status?.pairingUrl;
    if (isOpen && url) {
      void QRCode.toDataURL(url, { width: 300, margin: 4, errorCorrectionLevel: "M" }).then(
        (image) => { if (!cancelled) setQr({ url, image }); },
        () => { if (!cancelled) setError("actionError"); },
      );
    }
    return () => { cancelled = true; };
  }, [isOpen, status?.pairingUrl]);

  const run = async (action: "start" | "stop" | "refresh") => {
    const api = window.electron?.remote;
    if (!api || busy) return;
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = await (action === "start" ? api.startSession() : action === "stop" ? api.stopSession() : api.refreshSession());
      if (generation.current === current) { setStatus(next); setNow(Date.now()); }
    } catch { if (generation.current === current) setError(action === "start" ? "startError" : "actionError"); }
    finally { if (generation.current === current) setBusy(false); }
  };

  const copy = async () => {
    if (!status?.pairingUrl) return;
    const current = generation.current;
    const copiedUrl = status.pairingUrl;
    try {
      await navigator.clipboard.writeText(copiedUrl);
      if (generation.current !== current || pairingUrl.current !== copiedUrl) return;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { if (generation.current === current) setError("actionError"); }
  };

  const stopped = !status || status.status === "idle";
  const expired = !stopped && now >= (status.expiresAt ?? 0);
  const button = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#f4f4f5] dark:bg-[#2b2b2b] px-3 py-2 text-[13px] hover:bg-[#e8e8ea] dark:hover:bg-[#383838] disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:outline-none ring-0";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent hideClose className="w-[calc(100vw-32px)] max-w-[820px] max-h-[calc(100dvh-32px)] flex flex-col gap-0 rounded-2xl bg-white dark:bg-[#161616] border-[#dedee2] dark:border-[#383838] p-0 text-[#262626] dark:text-[#d4d4d4]">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-medium dark:text-white">{t("remoteControl.title")}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-[#737373] dark:text-[#969696]">{t("remoteControl.description")}</DialogDescription>
          </div>
          <button onClick={onClose} title={t("common.close")} aria-label={t("common.close")} className={`${button} !p-1.5`}><X className="h-4 w-4" /></button>
        </div>
        <ScrollArea className="min-h-0 flex-1" thumbClassName="bg-white/20 hover:bg-white/30">
          <div className="grid grid-cols-1 sm:grid-cols-[280px_minmax(0,1fr)] gap-6 p-6 pt-2">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#f4f4f5] dark:bg-[#222222] p-4">
              <div className="flex h-[248px] w-[248px] items-center justify-center">
                {busy ? <RotateCw aria-label={t("remoteControl.loading")} className="h-6 w-6 animate-spin" /> : !expired && qr && qr.url === status?.pairingUrl ?
                  <img src={qr.image} alt={t("remoteControl.qrAlt")} className="h-[248px] w-[248px] rounded-xl" /> :
                  <QrCode className="h-12 w-12 text-[#969696]" />}
              </div>
              <p className="mt-3 text-center text-xs text-[#737373] dark:text-[#969696]">{t(expired ? "remoteControl.expired" : "remoteControl.scan")}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-4 justify-center">
              <div className="flex items-center justify-between gap-3">
                <h3 role="status" className="text-sm font-medium dark:text-white">{t(busy ? "remoteControl.loading" : stopped ? "remoteControl.stopped" : status.status === "connected" ? "remoteControl.connected" : "remoteControl.waiting")}</h3>
                <button className={button} disabled={busy || !window.electron?.remote} onClick={() => void run(stopped ? "start" : "stop")}><Unplug className="h-3.5 w-3.5" />{t(stopped ? "remoteControl.start" : "common.stop")}</button>
              </div>
              <p className="text-[13px] leading-relaxed text-[#737373] dark:text-[#969696]">{t("remoteControl.network")}</p>
              {status?.connectedDevices.length ? <p className="text-xs">{t("remoteControl.connectedCount", { count: status.connectedDevices.length })}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled={busy || stopped} onClick={() => void run("refresh")}><RotateCw className="h-3.5 w-3.5" />{t("remoteControl.refresh")}</button>
                <button className={button} disabled={busy || stopped || expired} onClick={() => void copy()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{t(copied ? "common.copied" : "remoteControl.copy")}</button>
              </div>
              {error && <p role="alert" className="text-[13px] dark:text-white">{t(`remoteControl.${error}`)}</p>}
              <p className="text-xs text-[#737373] dark:text-[#969696]">{t("remoteControl.scope")}</p>
              <div className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#969696]"><Monitor className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{status?.deviceId}</span></div>
              <p className="text-xs text-[#737373] dark:text-[#969696]">{t("remoteControl.security")}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
