import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@const/ui";
import { MoreVertical, Edit3, Trash2, FolderOpen } from "lucide-react";
import { LocalCollection } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface CollectionItem extends LocalCollection {
  itemCount: number;
}

interface CollectionCardProps {
  collection: CollectionItem;
  viewMode?: "grid" | "list";
  onClick?: (collection: CollectionItem) => void;
  onEdit?: (collection: CollectionItem) => void;
  onDelete?: (collection: CollectionItem) => void;
}

export function CollectionCard({
  collection,
  viewMode = "list",
  onClick,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const { t } = useI18n();
  const count = collection.itemCount;
  const itemCountText =
    count === 1 ? t("learnCountTextSingle") : t("learnCountText", { count });

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onClick?.(collection)}
        className="w-full px-4 py-3.5 rounded-2xl border border-border/80 hover:border-border bg-card hover:bg-secondary/60 active:bg-secondary/80 text-card-foreground active:scale-[0.99] transition-all duration-200 flex items-center justify-between gap-3.5 cursor-pointer select-none shadow-2xs"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center text-xl shrink-0 border border-border/60 shadow-2xs">
            {collection.emoji || "📁"}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate leading-snug">
              {collection.name}
            </h4>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {itemCountText}
            </span>
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
          <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-md mr-2">
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onClick?.(collection)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t("openLearn")}</span>
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
      </div>
    );
  }

  // Grid view (2 columns on mobile)
  return (
    <div
      onClick={() => onClick?.(collection)}
      className="min-h-[150px] w-full p-3.5 rounded-2xl border border-border/70 active:bg-secondary/40 bg-card transition-all flex flex-col justify-between cursor-pointer select-none relative"
    >
      {/* Top */}
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-lg shadow-2xs shrink-0">
          {collection.emoji || "📁"}
        </div>

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
          <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-md mr-1">
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onClick?.(collection)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t("openLearn")}</span>
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
      </div>

      {/* Middle */}
      <div className="my-2">
        <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
          {collection.name}
        </h4>
      </div>

      {/* Bottom */}
      <div className="text-[10px] text-muted-foreground truncate pt-1 flex items-center justify-between">
        <span>{itemCountText}</span>
        <span className="text-[9px] text-muted-foreground/80">&rarr;</span>
      </div>
    </div>
  );
}
