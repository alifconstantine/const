import { useId } from "react";
import { cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { Zap, Clock, Info } from "lucide-react";

export interface WeeklyQuota {
  weeklyLimitTokens: number;
  remainingTokens: number;
  resetsInText?: string;
}

export function WeeklyQuotaCard({
  quota,
  className,
}: {
  quota?: WeeklyQuota | null;
  className?: string;
}) {
  const { t, language } = useTranslation();
  const titleId = useId();
  const known = Boolean(
    quota &&
    Number.isFinite(quota.weeklyLimitTokens) &&
    Number.isFinite(quota.remainingTokens),
  );
  const limit = known ? Math.max(0, quota!.weeklyLimitTokens) : 0;
  const remaining = known
    ? Math.min(limit, Math.max(0, quota!.remainingTokens))
    : 0;
  const percent = limit > 0 ? (remaining / limit) * 100 : 0;
  const isLow = known && percent <= 20;

  const number = (value: number) =>
    new Intl.NumberFormat(language, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={quota === undefined}
      className={cn(
        "rounded-2xl border border-neutral-200/80 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1a1a] p-5 sm:p-6 flex flex-col gap-5 shadow-xs transition-colors",
        className
      )}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
              isLow
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            )}
          >
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <h3
              id={titleId}
              className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight"
            >
              {t("settings.weeklyQuotaCard")}
            </h3>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Const Router inference allocation
            </span>
          </div>
        </div>

        {/* Quota Status Pill */}
        <div className="flex items-center gap-2">
          {known && quota?.resetsInText && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-[#252525] border border-neutral-200/60 dark:border-[#333333]">
              <Clock className="w-3 h-3 text-neutral-400" />
              <span>{quota.resetsInText}</span>
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border",
              !known
                ? "bg-neutral-100 dark:bg-[#252525] text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-[#333333]"
                : isLow
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            )}
          >
            {known
              ? t("settings.percentRemaining", { percent: percent.toFixed(1) })
              : t(
                  quota === undefined
                    ? "common.loading"
                    : "settings.quotaUnavailable"
                )}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={t("settings.remaining")}
          aria-valuemin={known ? 0 : undefined}
          aria-valuemax={known ? 100 : undefined}
          aria-valuenow={known ? percent : undefined}
          className="h-2 w-full rounded-full bg-neutral-100 dark:bg-[#282828] overflow-hidden"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              !known
                ? "bg-neutral-300 dark:bg-neutral-700 w-0"
                : isLow
                ? "bg-gradient-to-r from-rose-500 to-amber-500"
                : "bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-500 dark:to-cyan-400"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 3 Metric Summary Tiles */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#151515] border border-neutral-200/60 dark:border-[#262626] flex flex-col justify-between gap-1">
          <dt className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t("settings.remaining")}
          </dt>
          <dd className="text-base sm:text-lg font-semibold tabular-nums text-neutral-900 dark:text-white">
            {known ? number(remaining) : "—"}
          </dd>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#151515] border border-neutral-200/60 dark:border-[#262626] flex flex-col justify-between gap-1">
          <dt className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t("settings.limit")}
          </dt>
          <dd className="text-base sm:text-lg font-semibold tabular-nums text-neutral-900 dark:text-white">
            {known ? number(limit) : "—"}
          </dd>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#151515] border border-neutral-200/60 dark:border-[#262626] flex flex-col justify-between gap-1">
          <dt className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t("settings.resetsInLabel")}
          </dt>
          <dd className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white truncate">
            {known ? quota?.resetsInText || "—" : "—"}
          </dd>
        </div>
      </dl>

      {/* Information Footnote */}
      <div className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />
        <p>{t("settings.quotaNote")}</p>
      </div>
    </section>
  );
}
