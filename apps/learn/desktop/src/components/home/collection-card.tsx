import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Checkbox,
} from "@const/ui";
import { MoreVertical, Edit3, Trash2, FolderOpen } from "lucide-react";
import { LocalCollection } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import { ModuleIcon } from "./module-icon";

export interface CollectionItem extends LocalCollection {
  itemCount: number;
}

interface CollectionCardProps {
  collection: CollectionItem;
  viewMode?: "grid" | "list";
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (collection: CollectionItem) => void;
  onEdit?: (collection: CollectionItem) => void;
  onDelete?: (collection: CollectionItem) => void;
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

export function CollectionCard({
  collection,
  viewMode = "grid",
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onClick,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const { t, language } = useI18n();
  const itemCountText = collection.itemCount === 1
    ? t("learnCountTextSingle")
    : t("learnCountText", { count: collection.itemCount });
  const createdDate = collection.createdAt || collection.updatedAt;
  const createdDateText = createdDate ? formatDate(createdDate, language) : "";

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onSelect?.(collection.id);
    } else {
      onClick?.(collection);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handleCardClick}
        className={`w-full px-4 py-3 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer select-none group shadow-none ${
          isSelected
            ? "border-primary/60 bg-secondary"
            : "border-border/70 hover:border-foreground/30 bg-card hover:bg-secondary/40"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {isSelectionMode ? (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(collection.id)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0 border border-border/50 text-foreground shadow-2xs">
              <ModuleIcon icon={collection.emoji} className="w-4 h-4 text-foreground/90" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {collection.name}
            </h4>
            {collection.description && (
              <p className="text-xs text-muted-foreground truncate">
                {collection.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          {createdDateText && (
            <span className="hidden sm:inline text-muted-foreground/75 whitespace-nowrap truncate" title={t("createdDate", { date: createdDateText })}>
              {t("createdDate", { date: createdDateText })}
            </span>
          )}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/50 text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap"
            title={itemCountText}
          >
            <FolderOpen className="w-3 h-3 text-muted-foreground/75" />
            <span>{itemCountText}</span>
          </div>

          {!isSelectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-md">
                <DropdownMenuItem
                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                  onClick={() => onClick?.(collection)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>{t("openCollection")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                  onClick={() => onEdit?.(collection)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{t("editCollection")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                  onClick={() => onDelete?.(collection)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t("delete")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={handleCardClick}
      className={`min-h-[170px] w-full p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer select-none group relative shadow-none ${
        isSelected
          ? "border-primary/70 bg-secondary ring-1 ring-primary/40"
          : "border-border/70 hover:border-foreground/30 bg-card hover:bg-secondary/30 hover:shadow-xs"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-foreground shadow-2xs group-hover:scale-105 group-hover:border-foreground/30 transition-all shrink-0">
          <ModuleIcon icon={collection.emoji} className="w-5 h-5 text-foreground/90" />
        </div>

        {isSelectionMode ? (
          <div onClick={(e) => e.stopPropagation()} className="p-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect?.(collection.id)}
              className="h-4 w-4 rounded cursor-pointer"
            />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                aria-label={t("moreOptions")}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-md">
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onClick?.(collection)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{t("openCollection")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onEdit?.(collection)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t("editCollection")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete?.(collection)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Middle */}
      <div className="my-2.5">
        <h4 className="text-sm font-medium text-foreground line-clamp-1 leading-snug group-hover:text-primary transition-colors">
          {collection.name}
        </h4>
        {collection.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {collection.description}
          </p>
        )}
      </div>

      {/* Bottom */}
      <div className="pt-2.5 flex items-center justify-between gap-2 mt-auto">
        {createdDateText ? (
          <span
            className="text-[11px] font-normal text-muted-foreground whitespace-nowrap truncate select-none"
            title={t("createdDate", { date: createdDateText })}
          >
            {createdDateText}
          </span>
        ) : (
          <span />
        )}
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/50 text-[11px] font-medium text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground/90 transition-colors shrink-0 whitespace-nowrap select-none"
          title={itemCountText}
        >
          <FolderOpen className="w-3 h-3 shrink-0 text-muted-foreground/75 group-hover:text-foreground/80 transition-colors" />
          <span>{itemCountText}</span>
        </div>
      </div>
    </div>
  );
}
