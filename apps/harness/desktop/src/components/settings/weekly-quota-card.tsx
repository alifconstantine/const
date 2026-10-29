import { useId } from "react";
import { cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@const/ui";

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
        "space-y-3 settings-surface rounded-2xl bg-neutral-50 p-4 dark:bg-[#222222]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3
            id={titleId}
            className="text-[13px] font-medium text-neutral-900 dark:text-white"
          >
            {t("settings.weeklyQuotaCard")}
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("common.info")}
                  className="rounded text-neutral-500 hover:text-neutral-900 dark:text-[#969696] dark:hover:text-white"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-xs">
                {t("settings.quotaNote")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span
          role="status"
          className={cn(
            "text-xs tabular-nums",
            isLow
              ? "text-rose-600 dark:text-rose-400"
              : "text-neutral-500 dark:text-[#969696]",
          )}
        >
          {known
            ? t("settings.percentRemaining", {
                percent: new Intl.NumberFormat(language, {
                  maximumFractionDigits: 1,
                }).format(percent),
              })
            : t(
                quota === undefined
                  ? "common.loading"
                  : "settings.quotaUnavailable",
              )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("settings.remaining")}
        aria-valuemin={known ? 0 : undefined}
        aria-valuemax={known ? 100 : undefined}
        aria-valuenow={known ? percent : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#383838]"
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300",
            isLow ? "bg-rose-500" : "bg-neutral-700 dark:bg-[#d4d4d4]",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {[
          [t("settings.remaining"), known ? number(remaining) : "—"],
          [t("settings.limit"), known ? number(limit) : "—"],
          [
            t("settings.resetsInLabel"),
            known ? quota?.resetsInText || "—" : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-[11px] text-neutral-500 dark:text-[#969696]">
              {label}
            </dt>
            <dd className="text-sm font-medium tabular-nums text-neutral-900 dark:text-white break-words">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
