import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Checkbox,
} from "@const/ui";
import { MoreVertical, FolderPlus, FolderMinus, Edit3, Trash2, ExternalLink, FileText } from "lucide-react";
import { LocalLearn } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import { LearnIcon } from "./learn-icon";

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
  onRemoveFromCollection?: (learn: LearnItem) => void;
  onDelete?: (learn: LearnItem) => void;
}

function formatCardDate(timestamp: number, language: string, t: (key: any, params?: any) => string): string {
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

  const date = new Date(timestamp);
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  const locale = language === "id" ? "id-ID" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      ...(isCurrentYear ? {} : { year: "numeric" }),
    }).format(date);
  } catch {
    return `${date.getDate()} ${date.getMonth() + 1}${isCurrentYear ? "" : ` ${date.getFullYear()}`}`;
  }
}

export function LearnCard({
  learn,
  viewMode = "list",
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onClick,
  onEdit,
  onManageCollections,
  onRemoveFromCollection,
  onDelete,
}: LearnCardProps) {
  const { t, language } = useI18n();
  const formattedDate = formatCardDate(learn.updatedAt || learn.createdAt, language, t);
  const count = learn.sourcesCount ?? 0;
  const sourcesText =
    count === 1
      ? t("sourcesCountSingle")
      : count === 0
      ? t("sourcesCountNone")
      : t("sourcesCount", { count });

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
        className={`w-full px-4 py-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3.5 cursor-pointer select-none ${
          isSelected
            ? "border-primary/80 bg-secondary/90 ring-1 ring-primary/40"
            : "border-border/80 hover:border-border bg-card hover:bg-secondary/60 active:bg-secondary/80 text-card-foreground shadow-2xs active:scale-[0.99]"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {isSelectionMode ? (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 p-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(learn.id)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0 border border-border/60 text-foreground shadow-2xs">
              <LearnIcon icon={learn.emoji} className="w-5 h-5 text-foreground/90" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate leading-snug">
              {learn.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap truncate">
                {formattedDate}
              </span>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/80 border border-border/50 text-[10px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">
                <FileText className="w-2.5 h-2.5 text-muted-foreground/75" />
                <span>{sourcesText}</span>
              </div>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground active:text-foreground cursor-pointer shrink-0 transition-colors"
              aria-label={t("moreOptions")}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-md mr-2">
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onClick?.(learn)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{t("openLearn")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onManageCollections?.(learn)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>{t("manageCollections")}</span>
            </DropdownMenuItem>
            {onRemoveFromCollection && (
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-amber-600 dark:text-amber-400"
                onClick={() => onRemoveFromCollection(learn)}
              >
                <FolderMinus className="h-3.5 w-3.5" />
                <span>{t("removeFromModule")}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onEdit?.(learn)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{t("editLearn")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={() => onDelete?.(learn)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t("delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Grid view (mobile 2-columns)
  return (
    <div
      onClick={handleCardClick}
      className={`min-h-[150px] w-full p-3.5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
        isSelected
          ? "border-primary/70 bg-secondary/80 ring-1 ring-primary/40 shadow-xs"
          : "border-border/70 active:bg-secondary/40 bg-card"
      }`}
    >
      {/* Top */}
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-foreground shadow-2xs shrink-0">
          <LearnIcon icon={learn.emoji} className="w-4 h-4 text-foreground/90" />
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
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground active:text-foreground cursor-pointer -mr-1"
                aria-label={t("moreOptions")}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-md mr-1">
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onClick?.(learn)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t("openLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onManageCollections?.(learn)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{t("manageCollections")}</span>
              </DropdownMenuItem>
              {onRemoveFromCollection && (
                <DropdownMenuItem
                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-amber-600 dark:text-amber-400"
                  onClick={() => onRemoveFromCollection(learn)}
                >
                  <FolderMinus className="h-3.5 w-3.5" />
                  <span>{t("removeFromModule")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onEdit?.(learn)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t("editLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete?.(learn)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Middle */}
      <div className="my-2">
        <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
          {learn.title}
        </h4>
      </div>

      {/* Bottom */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5 mt-auto">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap truncate select-none">
          {formattedDate}
        </span>
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/80 border border-border/50 text-[10px] font-medium text-muted-foreground shrink-0 whitespace-nowrap select-none"
          title={sourcesText}
        >
          <FileText className="w-2.5 h-2.5 text-muted-foreground/75" />
          <span>{sourcesText}</span>
        </div>
      </div>
    </div>
  );
}
