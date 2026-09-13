import React from "react";
import { LocalLearn } from "../../lib/db";
import { BookOpen } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface RecentlyViewedCardProps {
  learn: LocalLearn;
  onClick?: (learn: LocalLearn) => void;
}

export function RecentlyViewedCard({ learn, onClick }: RecentlyViewedCardProps) {
  const { t, language } = useI18n();

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return t("relativeJustNow");
    if (minutes < 60) return t("relativeMinutesAgo", { minutes });
    if (hours < 24) return t("relativeHoursAgo", { hours });
    if (days === 1) return t("relativeYesterday");
    if (days < 7) return t("relativeDaysAgo", { days });

    const locale = language === "id" ? "id-ID" : "en-US";
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
      }).format(new Date(timestamp));
    } catch {
      return t("relativeDaysAgo", { days });
    }
  };

  const relativeTime = formatRelativeTime(learn.updatedAt || learn.createdAt);
  const count = learn.sourcesCount || 0;
  const sourcesText = count === 1 ? t("sourcesCountSingle") : t("sourcesCount", { count });

  return (
    <div
      onClick={() => onClick?.(learn)}
      className="min-w-[170px] max-w-[240px] flex-1 p-3 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-white dark:bg-[#222222] hover:bg-[#f4f4f6] dark:hover:bg-[#2b2b2b] hover:border-[#b0b0b0] dark:hover:border-[#4f4f4f] transition-all cursor-pointer group flex flex-col justify-between select-none shadow-none"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
          {learn.emoji || "📘"}
        </div>
        <span className="text-[10px] font-mono text-[#8a8a8a] dark:text-[#777777] shrink-0">
          {relativeTime}
        </span>
      </div>

      <div className="min-w-0 space-y-0.5">
        <h4 className="text-xs font-medium text-[#262626] dark:text-[#d4d4d4] group-hover:text-black dark:group-hover:text-white truncate">
          {learn.title}
        </h4>
        <p className="text-[11px] text-[#8a8a8a] dark:text-[#777777] truncate">
          {learn.description || sourcesText}
        </p>
      </div>
    </div>
  );
}
