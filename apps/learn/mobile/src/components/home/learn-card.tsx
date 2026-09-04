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

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
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
  const formattedDate = formatDate(learn.updatedAt);
  const sourcesText = `${learn.sourcesCount ?? 0} sumber`;

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
        className={`w-full px-3.5 py-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
          isSelected
            ? "border-primary/70 bg-secondary/80"
            : "border-border/70 active:bg-secondary/50 bg-card"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isSelectionMode ? (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 p-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(learn.id)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-secondary/80 flex items-center justify-center text-lg shrink-0 border border-border/50 shadow-2xs">
              {learn.emoji || "🚀"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-medium text-foreground truncate">
              {learn.title}
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {formattedDate} • {sourcesText}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground active:text-foreground cursor-pointer shrink-0"
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
              <span>Buka Learn</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onManageCollections?.(learn)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Kelola Koleksi</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onEdit?.(learn)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Ubah Nama</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={() => onDelete?.(learn)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus</span>
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
        <div className="h-9 w-9 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-lg shadow-2xs shrink-0">
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
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground active:text-foreground cursor-pointer -mr-1"
                aria-label="Menu learn"
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
                <span>Buka Learn</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onManageCollections?.(learn)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Kelola Koleksi</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onEdit?.(learn)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Ubah Nama</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete?.(learn)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus</span>
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
      <div className="text-[10px] text-muted-foreground truncate pt-1 border-t border-border/40">
        <span>{formattedDate}</span>
      </div>
    </div>
  );
}
