import { useId } from "react";
import { cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";

export interface WeeklyQuota {
  weeklyLimitTokens: number;
  remainingTokens: number;
  resetsInText?: string;
}

export function WeeklyQuotaCard({ quota }: { quota?: WeeklyQuota | null }) {
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
  const number = (value: number) =>
    new Intl.NumberFormat(language, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={quota === undefined}
      className="rounded-2xl bg-[#f3f3f3] dark:bg-[#222222] p-4 sm:p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={titleId}
          className="text-sm font-medium text-[#262626] dark:text-white"
        >
          {t("settings.weeklyQuotaCard")}
        </h3>
        <span className="text-xs tabular-nums text-[#737373] dark:text-[#969696]">
          {known
            ? t("settings.percentRemaining", { percent: percent.toFixed(1) })
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
        className="h-2 w-full rounded-full bg-[#e5e5e8] dark:bg-[#383838] overflow-hidden"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            known && percent <= 20
              ? "bg-rose-500"
              : "bg-[#262626] dark:bg-white",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <dl className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-4">
        {(
          [
            ["remaining", known ? number(remaining) : "—"],
            ["limit", known ? number(limit) : "—"],
            ["resetsInLabel", known ? quota?.resetsInText || "—" : "—"],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex min-[420px]:flex-col justify-between gap-1"
          >
            <dt className="text-xs text-[#737373] dark:text-[#969696]">
              {t(`settings.${label}`)}
            </dt>
            <dd className="text-sm font-medium tabular-nums text-[#262626] dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-[#737373] dark:text-[#969696]">
        {t("settings.quotaNote")}
      </p>
    </section>
  );
}
