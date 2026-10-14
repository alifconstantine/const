import React, { useState } from "react";
import {
  Plus,
  Search,
  Globe,
  FileText,
  PanelLeft,
  ChevronDown,
  Trash2,
  BookOpen,
  X,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
  ScrollArea,
  Checkbox,
} from "@const/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalSource } from "@/lib/db";
import { useI18n } from "../../lib/i18n";
import { SourceIcon, getSourceCategoryLabel } from "./source-icon";
import { SourcePreviewDialog } from "./source-preview-dialog";

export interface InitialSearchConfig {
  query: string;
  scope?: "web" | "journal";
  speed?: "fast" | "deep";
  autoSearch?: boolean;
}

interface SourcesPanelProps {
  learnId?: string;
  sourcesCount?: number;
  width?: number;
  onAddSource: (initialSearch?: InitialSearchConfig) => void;
  onSelectSource?: (sourceType: string) => void;
  onDropFiles?: (files: File[]) => void;
  onToggleCollapse?: () => void;
  onOpenBrowser?: (url: string) => void;
  isCollapsed?: boolean;
  isResizing?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourcesPanel({
  learnId,
  sourcesCount: fallbackCount = 0,
  width,
  onAddSource,
  onSelectSource,
  onDropFiles,
  onToggleCollapse,
  onOpenBrowser,
  isCollapsed = false,
  isResizing = false,
}: SourcesPanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Fast");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedSourceForPreview, setSelectedSourceForPreview] = useState<LocalSource | null>(null);

  const handleTriggerSearch = () => {
    onAddSource({
      query: searchQuery.trim(),
      scope: webScope.toLowerCase() === "journal" ? "journal" : "web",
      speed: researchSpeed.toLowerCase() === "deep" ? "deep" : "fast",
      autoSearch: Boolean(searchQuery.trim()),
    });
  };

  // Query sources live from Dexie database
  const sources =
    useLiveQuery(
      () => {
        if (!learnId) return [];
        return db.sources.where("learnId").equals(learnId).reverse().sortBy("createdAt");
      },
      [learnId]
    ) || [];

  const displayCount = sources.length > 0 ? sources.length : fallbackCount;
  const carriedCount = sources.filter((s) => s.includedInChat !== false).length;

  const filteredSources = searchQuery.trim()
    ? sources.filter((s) =>
        (s?.title || "").toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : sources;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onDropFiles) {
      onDropFiles(files);
    }
  };

  return (
    <>
      <aside
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ width: isCollapsed ? 48 : (width || 330) }}
        className={cn(
          "h-full flex flex-col relative bg-card rounded-2xl border text-foreground shrink-0 select-none overflow-hidden shadow-xs font-sans",
          isDraggingOver ? "border-primary/80 ring-2 ring-primary/20" : "border-border/50",
          !isResizing && "transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        )}
      >
      {/* Global Persistent Toggle Button (Stationary in top-left corner, zero jitter) */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute top-2 left-2 z-30 h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
          title={isCollapsed ? (t("openSourcesPanel") || "Expand Panel") : (t("hidePanel") || "Collapse panel")}
          aria-label={t("sourcesPanelTitle")}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Collapsed Rail View (Staggered dissolve to prevent icon collision) */}
      <div
        className={cn(
          "w-12 h-full flex flex-col items-center pt-12 pb-3 bg-card text-muted-foreground select-none font-sans absolute top-0 left-0 z-10 origin-top-left transition-all ease-out",
          isCollapsed
            ? "opacity-100 scale-100 pointer-events-auto duration-200 delay-100"
            : "opacity-0 scale-95 pointer-events-none duration-150 delay-0"
        )}
      >
        <button
          type="button"
          onClick={() => {
            onAddSource();
            if (isCollapsed) onToggleCollapse?.();
          }}
          className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer mt-1"
          title={t("addSource")}
          aria-label={t("addSource")}
        >
          <Plus className="h-4 w-4" />
        </button>

        {displayCount > 0 && (
          <span
            className="text-[10px] font-sans font-medium tabular-nums px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 mt-2"
            title={`${displayCount} ${t("sourcesPanelTitle")}`}
          >
            {displayCount}
          </span>
        )}
      </div>

      {/* Expanded Content View (Staggered dissolve to prevent icon collision) */}
      <div
        style={{
          width: isCollapsed ? `${width || 330}px` : "100%",
          minWidth: isCollapsed ? `${width || 330}px` : undefined,
        }}
        className={cn(
          "h-full flex flex-col absolute top-0 left-0 origin-top-left",
          isResizing
            ? "transition-none"
            : "transition-[opacity,transform] ease-out",
          isCollapsed
            ? "opacity-0 scale-[0.98] pointer-events-none duration-150 delay-0"
            : "opacity-100 scale-100 pointer-events-auto duration-200 delay-100"
        )}
      >
        {/* Header (aligned with h-12 height of Chat and Studio headers) */}
        <div className="h-12 pl-12 pr-3 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              {t("sourcesPanelTitle")}
            </span>
            {displayCount > 0 && (
              <span className="text-[10px] font-sans tabular-nums px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
                {displayCount}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col px-3 pb-3 sm:px-3.5 sm:pb-3.5 min-h-0 overflow-hidden">
          {/* "+ Add source" Button */}
          <button
            type="button"
            onClick={() => onAddSource()}
            className="w-full py-2.5 px-4 rounded-full bg-secondary/80 hover:bg-secondary border border-border/70 hover:border-border text-xs font-medium text-foreground flex items-center justify-center gap-2 transition-all cursor-pointer mb-3 shrink-0 shadow-2xs hover:shadow-xs active:scale-[0.99] group"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5] text-muted-foreground group-hover:text-foreground transition-colors" />
            <span>{t("addSource")}</span>
          </button>

      {/* Search & Web Research Box */}
      <div className="w-full bg-muted/40 hover:bg-muted/50 focus-within:bg-muted/60 rounded-2xl p-2.5 sm:p-3 border border-border/60 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all text-left mb-3 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTriggerSearch();
            }}
            placeholder={t("searchWebSources")}
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none pr-6 pl-1 py-0.5"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-0 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
              title="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-1">
          <div className="flex items-center gap-1.5 flex-nowrap">
            {/* Web Scope Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 hover:bg-background text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border/50 shadow-2xs"
                >
                  <Globe className="h-2.5 w-2.5 text-muted-foreground/80" />
                  <span>{webScope === "Journal" ? t("webScopeJournal") : t("webScopeWeb")}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36 p-1 text-xs shadow-md">
                <DropdownMenuItem
                  onClick={() => setWebScope("Web")}
                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-blue-400" />
                    {t("webScopeWeb")}
                  </span>
                  {webScope === "Web" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setWebScope("Journal")}
                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                    {t("webScopeJournal")}
                  </span>
                  {webScope === "Journal" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Research Speed Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 hover:bg-background text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border/50 shadow-2xs"
                >
                  <span>{researchSpeed === "Deep" ? t("speedDeep") : t("speedFast")}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 p-1 text-xs shadow-md">
                <DropdownMenuItem
                  onClick={() => setResearchSpeed("Fast")}
                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                >
                  <span>{t("speedFast")}</span>
                  {researchSpeed === "Fast" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setResearchSpeed("Deep")}
                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                >
                  <span>{t("speedDeep")}</span>
                  {researchSpeed === "Deep" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            type="button"
            onClick={handleTriggerSearch}
            className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all cursor-pointer border border-primary/20 shadow-2xs shrink-0"
            aria-label={t("search")}
            title="Search web or journals"
          >
            <Search className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Sources List or Empty State */}
      {sources.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Subheader: Selection info & Bulk toggle */}
          <div className="flex items-center justify-between px-1 pb-2 mb-1.5 border-b border-border/40 text-[11px] text-muted-foreground shrink-0">
            <span>
              {t("carriedSourcesHeader", { carried: carriedCount, total: sources.length })}
            </span>
            {learnId && (
              <button
                type="button"
                onClick={() => {
                  const allSelected = carriedCount === sources.length;
                  localDb.setAllSourcesInChat(learnId, !allSelected);
                }}
                className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
              >
                {carriedCount === sources.length ? t("deselectAll") : t("selectAll")}
              </button>
            )}
          </div>

          {/* Scrollable list of source cards */}
          {filteredSources.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <p className="text-xs">No local sources matching &quot;{searchQuery}&quot;</p>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={handleTriggerSearch}
                  className="mt-2.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Search className="h-3 w-3" />
                  <span>Search &quot;{searchQuery.slice(0, 18)}&quot; on {webScope}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-[11px] text-muted-foreground hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <ScrollArea className="flex-1 w-full" viewportClassName="space-y-1.5 pr-1">
              {filteredSources.map((source) => {
                const isCarried = source.includedInChat !== false;
                return (
                  <div
                    key={source.id}
                    className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                      isCarried
                        ? "bg-secondary/60 hover:bg-secondary border-border/70 text-foreground"
                        : "bg-muted/20 hover:bg-muted/40 border-border/30 text-muted-foreground opacity-70 hover:opacity-100"
                    }`}
                    onClick={() => {
                      localDb.toggleSourceInChat(source.id, !isCarried);
                    }}
                  >
                    <Checkbox
                      checked={isCarried}
                      onCheckedChange={() => {
                        localDb.toggleSourceInChat(source.id, !isCarried);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded-[4px] border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shrink-0 cursor-pointer transition-all"
                      aria-label={`Toggle ${source.title}`}
                    />

                    <SourceIcon source={source} size="md" />

                      <div
                        className="flex-1 min-w-0 pr-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSourceForPreview(source);
                        }}
                      >
                        <p
                          className="text-xs font-medium text-foreground truncate leading-tight hover:underline"
                          title={source.title}
                        >
                          {source.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 font-sans tabular-nums mt-0.5 truncate flex items-center gap-1">
                          <span className="capitalize font-medium text-foreground/80">
                            {getSourceCategoryLabel(source)}
                          </span>
                          {source.size ? `• ${formatFileSize(source.size)}` : null}
                          {source.subpagesCount && source.subpagesCount > 1
                            ? `• ${source.subpagesCount} pages`
                            : null}
                        </p>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          localDb.deleteSource(source.id);
                        }}
                        className="absolute right-2 opacity-0 group-hover:opacity-100 h-6 w-6 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center transition-all cursor-pointer"
                        title={t("removeSource")}
                        aria-label={t("removeSource")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </div>
        ) : (
          /* Empty State / Interactive Dropzone */
          <div
            onClick={() => onAddSource()}
            className={`flex-1 flex flex-col items-center justify-center text-center p-6 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer group ${
              isDraggingOver
                ? "border-primary bg-primary/5 scale-[0.99]"
                : "border-border/60 hover:border-border/90 bg-muted/15 hover:bg-muted/25"
            }`}
          >
            <div className="h-12 w-12 rounded-2xl bg-secondary/80 border border-border/60 flex items-center justify-center text-muted-foreground mb-3.5 shadow-2xs group-hover:scale-105 group-hover:text-foreground transition-all">
              <FileText className="h-6 w-6 stroke-[1.5] text-muted-foreground/80 group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="text-xs font-semibold text-foreground mb-1.5 tracking-tight">
              {t("emptySourcesTitle")}
            </h3>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed max-w-[260px] mb-5">
              {t("emptySourcesDescription")}
            </p>

            {/* Simple "+ Add Source" Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSource();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary hover:bg-muted border border-border/70 text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 group-hover:border-border"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t("addSource")}</span>
            </button>

            <p className="text-[11px] text-muted-foreground/60 mt-3.5">
              {t("orDropFiles")}
            </p>
          </div>
        )}
        </div>
      </div>
      </aside>

      {/* Source Detail Modal */}
      <SourcePreviewDialog
        source={selectedSourceForPreview}
        open={!!selectedSourceForPreview}
        onOpenChange={(open) => {
          if (!open) setSelectedSourceForPreview(null);
        }}
        onOpenBrowser={onOpenBrowser}
      />
    </>
  );
}
