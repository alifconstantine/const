import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import {
  ArrowLeft,
  Plus,
  Copy,
  TrendingUp,
  Share2,
  Settings,
  Grid3X3,
  Check,
} from "lucide-react";
import { ConstLogoIcon } from "@const/ui";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { StudioPanel } from "./studio-panel";
import { AddSourceDialog } from "./add-source-dialog";

interface LearnWorkspaceProps {
  learnId: string;
  initialSourceModalOpen?: boolean;
  onBack: () => void;
  onCreateNew?: () => void;
  user?: any;
}

export function LearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  user,
}: LearnWorkspaceProps) {
  // Live notebook data from Dexie
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Dialog & Panel states
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("Notebook tanpa judul");

  useEffect(() => {
    if (learn?.title) {
      setTitleValue(learn.title);
    }
  }, [learn?.title]);

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim() || "Notebook tanpa judul";
    setTitleValue(trimmed);
    await localDb.updateLearn(learnId, { title: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setTitleValue(learn?.title || "Notebook tanpa judul");
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Top Workspace Header Bar */}
      <header className="h-14 px-4 bg-card/60 backdrop-blur-md border-b border-border/50 flex items-center justify-between shrink-0 z-10">
        {/* Left: Back button + Logo + Notebook Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Kembali ke Beranda"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ConstLogoIcon className="h-4 w-4" />
          </div>

          {/* Editable Title */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="text-sm font-medium text-foreground bg-muted/60 rounded-full px-3 py-1 outline-none border border-border/80 min-w-[200px]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium text-foreground hover:bg-muted/50 px-2.5 py-1 rounded-full transition-colors cursor-pointer text-left font-serif"
              title="Klik untuk mengubah judul"
            >
              {titleValue}
            </button>
          )}

          {learn?.projectPath && (
            <span
              className="hidden md:inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 max-w-[220px] truncate"
              title={learn.projectPath}
            >
              📁 {learn.projectPath.split(/[\\/]/).filter(Boolean).pop()}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* "+ Buat notebook" Pill Button */}
          <button
            type="button"
            onClick={onCreateNew || (() => setIsAddSourceOpen(true))}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground hover:bg-foreground/90 text-background text-xs font-medium transition-all shadow-xs active:scale-98 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Buat notebook</span>
          </button>

          {/* Salin */}
          <button
            type="button"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-xs text-foreground transition-all cursor-pointer"
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
            <span>Salin</span>
          </button>

          {/* Analytics */}
          <button
            type="button"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-xs text-foreground transition-all cursor-pointer"
          >
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span>Analytics</span>
          </button>

          {/* Bagikan */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-xs text-foreground transition-all cursor-pointer"
          >
            <Share2 className="h-3 w-3 text-muted-foreground" />
            <span>Bagikan</span>
          </button>

          {/* Setelan */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-xs text-foreground transition-all cursor-pointer"
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
            <span>Setelan</span>
          </button>

          {/* PRO Badge */}
          <span className="hidden lg:inline-flex text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            PRO
          </span>

          {/* 9-Dots Launcher */}
          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Aplikasi Const"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>

          {/* User Avatar */}
          <div className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "A"}
          </div>
        </div>
      </header>

      {/* 3-Column Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Sumber */}
        <SourcesPanel
          sourcesCount={learn?.sourcesCount || 0}
          onAddSource={() => setIsAddSourceOpen(true)}
          isCollapsed={isSourcesCollapsed}
          onToggleCollapse={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
        />

        {/* Center Column: Socratic Chat */}
        <ChatPanel
          learnId={learnId}
          workspacePath={learn?.projectPath}
          sourcesCount={learn?.sourcesCount || 0}
          onSelectPromptChip={(prompt) => {
            console.log("Selected prompt chip:", prompt);
          }}
        />

        {/* Right Column: Studio Tools */}
        <StudioPanel
          onSelectTool={(toolId) => {
            console.log("Selected studio tool:", toolId);
          }}
          onAddNote={() => {
            console.log("Add note clicked");
          }}
          isCollapsed={isStudioCollapsed}
          onToggleCollapse={() => setIsStudioCollapsed(!isStudioCollapsed)}
        />
      </div>

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        onSelectSource={(sourceType) => {
          console.log("Selected source type:", sourceType);
          setIsAddSourceOpen(false);
        }}
      />
    </div>
  );
}
