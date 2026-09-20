import React, { useState, useRef } from "react";
import {
  X,
  Globe,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";

export interface MobileBrowserSheetProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function MobileBrowserSheet({
  open,
  url,
  onClose,
}: MobileBrowserSheetProps) {
  const { language } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  if (!open || !url) return null;

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(language === "id" ? "Tautan disalin ke clipboard" : "Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleOpenExternal = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground animate-in fade-in duration-200 select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Web Browser"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-border bg-secondary/40 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label="Tutup"
            title="Tutup Browser"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Address Bar Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/60 text-xs text-foreground min-w-0 flex-1 max-w-[260px] sm:max-w-md">
            <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate font-mono text-[11px] select-all">
              {hostname}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReload}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            title={language === "id" ? "Muat ulang" : "Reload"}
          >
            <RotateCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            title={language === "id" ? "Salin tautan" : "Copy link"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            title={language === "id" ? "Buka di browser luar" : "Open in external browser"}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 ml-1"
            title={language === "id" ? "Tutup" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Browser Web Content (Iframe) */}
      <div className="flex-1 relative w-full h-full bg-card overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 backdrop-blur-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-mono">
              {language === "id" ? "Memuat halaman..." : "Loading page..."}
            </span>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-semibold text-foreground">
                {language === "id" ? "Gagal memuat di dalam frame" : "Unable to load in-app frame"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {language === "id"
                  ? "Situs ini mungkin memblokir tampilan iframe atau memerlukan pembukaan langsung di peramban sistem."
                  : "This website may block iframe embedding or requires opening directly in your system browser."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer active:scale-95 transition-all shadow-xs"
            >
              <span>{language === "id" ? "Buka di Browser Luar" : "Open in External Browser"}</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            title={url}
            className="w-full h-full border-0 bg-white dark:bg-zinc-950"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            allow="fullscreen; clipboard-read; clipboard-write;"
          />
        )}
      </div>
    </div>
  );
}
