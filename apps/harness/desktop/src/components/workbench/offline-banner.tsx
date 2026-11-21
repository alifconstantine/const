import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";

interface OfflineBannerProps {
  isChecking?: boolean;
  localModelAvailable?: boolean;
  onRetry: () => void;
  className?: string;
}

export function OfflineBanner({
  isChecking = false,
  localModelAvailable = false,
  onRetry,
  className,
}: OfflineBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full rounded-2xl bg-[#ffffff] dark:bg-[#222224] border border-[#e2e2e4] dark:border-[#343438] shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none px-3.5 py-2.5 flex items-center justify-between gap-3 select-none animate-in fade-in slide-in-from-bottom-1 duration-150",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-[#3b82f6]/12 dark:bg-[#3b82f6]/15 text-[#2563eb] dark:text-[#60a5fa] flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[#161616] dark:text-[#f4f4f5] leading-snug">
            {t("workbench.offlineTitle")}
          </div>
          <p className="text-[12px] text-[#737373] dark:text-[#969696] leading-snug mt-0.5">
            {localModelAvailable ? t("workbench.offlineDescLocal") : t("workbench.offlineDesc")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isChecking}
        className="h-8 px-3.5 rounded-full text-[12px] font-medium bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1.5 shrink-0 active:scale-[0.98]"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", isChecking && "animate-spin")} />
        <span>{isChecking ? t("workbench.offlineChecking") : t("workbench.offlineRetry")}</span>
      </button>
    </div>
  );
}
