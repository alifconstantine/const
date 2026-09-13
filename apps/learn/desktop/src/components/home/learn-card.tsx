import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Checkbox,
} from "@const/ui";
import { MoreVertical, FolderPlus, Edit3, Trash2, ExternalLink } from "lucide-react";
import { LocalLearn } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export type LearnItem = LocalLearn;

interface LearnCardProps {
  learn: LearnItem;
  viewMode?: "grid" | "list";
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (learn: LearnItem) => void;
  onEdit?: (learn: LearnItem) => void;
  onManageCollections?: (learn: LearnItem) => void;
  onDelete?: (learn: LearnItem) => void;
}

function formatDate(timestamp: number, language: "en" | "id"): string {
  const locale = language === "id" ? "id-ID" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    const d = new Date(timestamp);
    return `${d.getDate()} ${d.getMonth() + 1} ${d.getFullYear()}`;
  }
}

export function LearnCard({
  learn,
  viewMode = "grid",
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onClick,
  onEdit,
  onManageCollections,
  onDelete,
}: LearnCardProps) {
  const { t, language } = useI18n();
  const formattedDate = formatDate(learn.updatedAt, language);
  const count = learn.sourcesCount ?? 0;
  const sourcesText = count === 1 ? t("sourcesCountSingle") : t("sourcesCount", { count });

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onSelect?.(learn.id);
    } else {
      onClick?.(learn);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handleCardClick}
        className={`w-full px-4 py-3 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer select-none group shadow-none ${
          isSelected
            ? "border-primary/60 bg-[#f4f4f6] dark:bg-[#2b2b2b]"
            : "border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b0] dark:hover:border-[#4f4f4f] bg-white dark:bg-[#222222] hover:bg-[#f4f4f6] dark:hover:bg-[#2b2b2b]"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {isSelectionMode ? (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(learn.id)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] flex items-center justify-center text-lg shrink-0 border border-[#dedee2] dark:border-[#383838]">
              {learn.emoji || "🚀"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-[#262626] dark:text-[#d4d4d4] truncate group-hover:text-black dark:group-hover:text-white transition-colors">
              {learn.title}
            </h4>
            {learn.description && (
              <p className="text-xs text-[#8a8a8a] dark:text-[#777777] truncate">
                {learn.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-xs text-[#8a8a8a] dark:text-[#777777]">
          <span className="hidden sm:inline">
            {formattedDate} • {sourcesText}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#8a8a8a] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4]">
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onClick?.(learn)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t("openLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onManageCollections?.(learn)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{t("manageCollections")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onEdit?.(learn)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t("editLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-[#dedee2] dark:bg-[#383838]" />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-600"
                onClick={() => onDelete?.(learn)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Default: Grid View
  return (
    <div
      onClick={handleCardClick}
      className={`min-h-[170px] w-full p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer select-none group relative shadow-none ${
        isSelected
          ? "border-primary/70 bg-[#f4f4f6] dark:bg-[#2b2b2b] ring-1 ring-primary/40"
          : "border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b0] dark:hover:border-[#4f4f4f] bg-white dark:bg-[#222222] hover:bg-[#f4f4f6] dark:hover:bg-[#2b2b2b]"
      }`}
    >
      {/* Top row: Squircle emoji & Menu / Selection Checkbox */}
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-xl group-hover:scale-105 transition-transform shrink-0">
          {learn.emoji || "🚀"}
        </div>

        {isSelectionMode ? (
          <div onClick={(e) => e.stopPropagation()} className="p-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect?.(learn.id)}
              className="h-4 w-4 rounded cursor-pointer"
            />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#8a8a8a] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer transition-colors"
                aria-label={t("moreOptions")}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4]">
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onClick?.(learn)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t("openLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onManageCollections?.(learn)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{t("manageCollections")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e]"
                onClick={() => onEdit?.(learn)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t("editLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-[#dedee2] dark:bg-[#383838]" />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-600"
                onClick={() => onDelete?.(learn)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Middle: Title */}
      <div className="my-2.5">
        <h4 className="text-sm font-medium text-[#262626] dark:text-[#d4d4d4] line-clamp-2 leading-snug group-hover:text-black dark:group-hover:text-white transition-colors">
          {learn.title}
        </h4>
        {learn.description && (
          <p className="text-xs text-[#8a8a8a] dark:text-[#777777] line-clamp-1 mt-0.5">
            {learn.description}
          </p>
        )}
      </div>

      {/* Bottom: Date & Source count */}
      <div className="text-[11px] font-normal text-[#8a8a8a] dark:text-[#777777] flex items-center gap-1.5 pt-1">
        <span>{formattedDate}</span>
        <span>•</span>
        <span>{sourcesText}</span>
      </div>
    </div>
  );
}
