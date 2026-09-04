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
  viewMode = "grid",
  onClick,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const itemCountText = `${collection.itemCount} learn`;

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onClick?.(collection)}
        className="w-full px-4 py-3 rounded-xl border border-border/70 hover:border-foreground/30 bg-card hover:bg-secondary/40 transition-all flex items-center justify-between gap-4 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-secondary/80 flex items-center justify-center text-lg shrink-0 border border-border/50 shadow-2xs">
            {collection.emoji || "📁"}
          </div>
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

        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span>{itemCountText}</span>

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
                <span>Buka Koleksi</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => onEdit?.(collection)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Ubah Koleksi</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete?.(collection)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={() => onClick?.(collection)}
      className="min-h-[170px] w-full p-5 rounded-2xl border border-border/70 hover:border-foreground/30 bg-card hover:bg-secondary/30 hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer select-none group relative"
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-xl shadow-2xs group-hover:scale-105 transition-transform shrink-0">
          {collection.emoji || "📁"}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Menu pilihan koleksi"
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
              <span>Buka Koleksi</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
              onClick={() => onEdit?.(collection)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Ubah Koleksi</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={() => onDelete?.(collection)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <div className="text-[11px] font-normal text-muted-foreground flex items-center justify-between pt-1">
        <span>{itemCountText}</span>
        <span className="text-[10px] text-muted-foreground/80 group-hover:text-foreground flex items-center gap-1 transition-colors">
          Buka &rarr;
        </span>
      </div>
    </div>
  );
}
