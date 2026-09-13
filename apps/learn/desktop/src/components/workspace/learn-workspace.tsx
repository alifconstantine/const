import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import {
  ArrowLeft,
  Check,
  Sun,
  Moon,
  Laptop,
  LogOut,
  ArrowLeftRight,
  User as UserIcon,
  Settings,
} from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  useTheme,
} from "@const/ui";
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
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export function LearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  user,
  onSignOut,
  onSwitchAccount,
}: LearnWorkspaceProps) {
  const [theme, setTheme] = useTheme();

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
        {/* Left: Back button + Notebook Title (No Logo, Clean Sans-Serif) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Kembali ke Beranda"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

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
                className="text-sm font-medium text-foreground bg-muted/60 rounded-full px-3 py-1 outline-none border border-border/80 min-w-[200px] font-sans"
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
              className="text-sm font-semibold text-foreground hover:bg-muted/50 px-2.5 py-1 rounded-full transition-colors cursor-pointer text-left font-sans tracking-tight"
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

        {/* Right: User Account Only */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none"
                aria-label="Account menu"
              >
                <Avatar className="h-7 w-7 rounded-full border border-border/70 transition-transform active:scale-95">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Avatar"}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-foreground text-background font-sans text-xs font-semibold">
                    {user === undefined ? (
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"
                    )}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md">
              {(user?.name || user?.email) && (
                <>
                  <div className="px-2.5 py-2">
                    {user.name && (
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Tema Aplikasi (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                  <span>Tema aplikasi</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[140px] p-1.5 shadow-md">
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("system")}
                  >
                    <div className="flex items-center gap-2">
                      <Laptop className="h-3.5 w-3.5" />
                      <span>Sistem</span>
                    </div>
                    {theme === "system" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("light")}
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" />
                      <span>Terang</span>
                    </div>
                    {theme === "light" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("dark")}
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" />
                      <span>Gelap</span>
                    </div>
                    {theme === "dark" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  // Settings placeholder: intentionally does nothing
                }}
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {onSwitchAccount && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={onSwitchAccount}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Switch account</span>
                </DropdownMenuItem>
              )}

              {onSignOut && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive focus:text-destructive"
                  onClick={onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 3-Column Floating Cards Body Layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-2.5 gap-2 sm:gap-2.5 bg-background">
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
