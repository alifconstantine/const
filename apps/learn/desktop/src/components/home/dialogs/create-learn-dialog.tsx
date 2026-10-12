import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  ScrollArea,
  cn,
  toast,
} from "@const/ui";
import {
  BookOpen,
  Check,
  ChevronDown,
  Folder,
  FolderOpen,
  Hand,
  ShieldAlert,
  X,
} from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import {
  LEARN_ICONS,
  LEGACY_EMOJI_TO_LEARN_ICON,
  getLearnIconDef,
  getLearnIconLabel,
} from "../learn-icon";
import { ModuleIcon } from "../module-icon";

interface CreateLearnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections?: Array<{ id: string; name: string; emoji?: string }>;
  initialData?: {
    id: string;
    title: string;
    description?: string;
    emoji?: string;
    collectionIds?: string[];
    projectPath?: string;
    permissionMode?: "ask_before_changes" | "full_access";
  };
  onSubmit: (data: {
    id?: string;
    title: string;
    description?: string;
    emoji: string;
    collectionId?: string;
    projectPath?: string;
    permissionMode?: "ask_before_changes" | "full_access";
  }) => Promise<void>;
}

export function CreateLearnDialog({
  open,
  onOpenChange,
  collections = [],
  initialData,
  onSubmit,
}: CreateLearnDialogProps) {
  const { t, language } = useI18n();
  const getInitialIcon = (raw?: string) => {
    if (!raw) return "book";
    return LEGACY_EMOJI_TO_LEARN_ICON[raw] || raw;
  };

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(getInitialIcon(initialData?.emoji));
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialData?.collectionIds?.[0]
  );
  const [projectPath, setProjectPath] = useState<string>(initialData?.projectPath ?? "");
  const [permissionMode, setPermissionMode] = useState<"ask_before_changes" | "full_access">(
    initialData?.permissionMode ?? "ask_before_changes"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isIconOpen, setIsIconOpen] = useState(false);
  const [isPermissionOpen, setIsPermissionOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const iconMenuRef = useRef<HTMLDivElement>(null);
  const permissionMenuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setSelectedEmoji(getInitialIcon(initialData?.emoji));
      setSelectedCollectionId(initialData?.collectionIds?.[0]);
      setProjectPath(initialData?.projectPath ?? "");
      setPermissionMode(initialData?.permissionMode ?? "ask_before_changes");
      setIsIconOpen(false);
      setIsPermissionOpen(false);
      setIsFolderOpen(false);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!isIconOpen && !isPermissionOpen && !isFolderOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isIconOpen && iconMenuRef.current && !iconMenuRef.current.contains(target)) {
        setIsIconOpen(false);
      }
      if (
        isPermissionOpen &&
        permissionMenuRef.current &&
        !permissionMenuRef.current.contains(target)
      ) {
        setIsPermissionOpen(false);
      }
      if (isFolderOpen && folderMenuRef.current && !folderMenuRef.current.contains(target)) {
        setIsFolderOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isIconOpen, isPermissionOpen, isFolderOpen]);

  const handleSelectFolder = async () => {
    if (window.electron?.openDirectoryDialog) {
      const selected = await window.electron.openDirectoryDialog();
      if (selected) {
        setProjectPath(selected);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: initialData?.id,
        title: title.trim(),
        description: initialData?.description,
        emoji: selectedEmoji,
        collectionId: selectedCollectionId,
        projectPath: projectPath.trim() || undefined,
        permissionMode,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save learn:", err);
      toast.error(t("failedSaveLearn"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(initialData?.id);
  const selectedIconDef = getLearnIconDef(selectedEmoji);
  const SelectedIconComponent = selectedIconDef.icon;
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (isIconOpen || isPermissionOpen || isFolderOpen) {
            e.preventDefault();
            setIsIconOpen(false);
            setIsPermissionOpen(false);
            setIsFolderOpen(false);
          }
        }}
        className={cn(
          "w-full p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0",
          isEdit ? "max-w-[500px]" : "max-w-[540px]"
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-serif text-base font-medium tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>{isEdit ? t("editLearnDialogTitle") : t("createLearnDialogTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Row 1: Title | Icon (wide multi-column dropdown with ScrollArea) */}
          <div className="grid grid-cols-[1fr_148px] gap-3 items-start">
            {/* Title Input */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-[12px] font-medium text-muted-foreground block">
                {t("learnTitleLabel")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("learnTitlePlaceholder")}
                className="h-9 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full min-w-0 px-3 placeholder:text-muted-foreground/50"
                autoFocus
                required
              />
            </div>

            {/* Icon Dropdown */}
            <div className="space-y-1.5 relative" ref={iconMenuRef}>
              <label className="text-[12px] font-medium text-muted-foreground block">
                {t("learnIcon")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsPermissionOpen(false);
                  setIsFolderOpen(false);
                  setIsIconOpen((prev) => !prev);
                }}
                className={cn(
                  "h-9 w-full px-3 rounded-xl bg-secondary/40 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border border-border/70 text-[12px] text-foreground flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                  isIconOpen && "border-foreground/30 bg-zinc-500/15 dark:bg-white/[0.08]"
                )}
                title={getLearnIconLabel(selectedEmoji, language)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SelectedIconComponent className="h-4 w-4 text-foreground shrink-0" />
                  <span className="truncate font-medium">
                    {getLearnIconLabel(selectedEmoji, language)}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150",
                    isIconOpen && "rotate-180"
                  )}
                />
              </button>

              {isIconOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-[300px] sm:w-[320px] rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 ease-out">
                  <ScrollArea className="h-[180px] w-full" viewportClassName="p-2 pr-3">
                    <div className="grid grid-cols-4 gap-1.5">
                      {LEARN_ICONS.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = selectedEmoji === item.id;
                        const itemLabel = getLearnIconLabel(item.id, language);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedEmoji(item.id);
                              setIsIconOpen(false);
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl transition-colors cursor-pointer select-none border",
                              isSelected
                                ? "bg-zinc-500/20 dark:bg-white/[0.12] text-foreground border-border/80 font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border-transparent"
                            )}
                            title={itemLabel}
                            aria-label={itemLabel}
                          >
                            <IconComponent className="h-4 w-4 shrink-0" />
                            <span className="text-[10px] leading-tight truncate max-w-full">
                              {itemLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {!isEdit && (
            <>
              {/* Row 2: Project Folder / Workspace Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{t("workspacePathLabel")}</span>
                  </label>
                  {projectPath && (
                    <button
                      type="button"
                      onClick={() => setProjectPath("")}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      <span>{t("resetDefault")}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full min-w-0">
                  <div
                    className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-secondary/40 border border-border/70 text-[12px] text-foreground flex items-center overflow-hidden"
                    title={projectPath || t("workspacePathPlaceholder")}
                  >
                    <span className="truncate">
                      {projectPath ? projectPath : t("workspacePathPlaceholder")}
                    </span>
                  </div>

                  {window.electron?.openDirectoryDialog && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectFolder}
                      className="rounded-xl h-9 px-3 text-[12px] gap-1.5 shrink-0 cursor-pointer border-border/70 bg-secondary/40 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] text-foreground"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t("selectFolder")}</span>
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-normal">
                  {projectPath
                    ? t("agentWorkspaceNotice")
                    : t("defaultWorkspaceNotice")}
                </p>
              </div>

              {/* Row 3: Permission (Dropdown like harness desktop) | Folder (Optional) */}
              <div className="grid grid-cols-2 gap-3 items-start">
                {/* Permission Mode Dropdown */}
                <div className="space-y-1.5 min-w-0 relative" ref={permissionMenuRef}>
                  <label className="text-[12px] font-medium text-muted-foreground block">
                    {t("permissionModeLabel")}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsIconOpen(false);
                      setIsFolderOpen(false);
                      setIsPermissionOpen((prev) => !prev);
                    }}
                    className={cn(
                      "w-full h-9 px-3 rounded-xl border text-[12px] flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                      permissionMode === "full_access"
                        ? "bg-[#e79737]/10 border-[#e79737]/40 text-[#e79737] hover:bg-[#e79737]/15"
                        : "bg-secondary/40 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border-border/70 text-foreground",
                      isPermissionOpen && "border-foreground/30"
                    )}
                    title={
                      permissionMode === "full_access"
                        ? t("fullAccess")
                        : t("askBeforeChanges")
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {permissionMode === "full_access" ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-[#e79737] shrink-0" />
                      ) : (
                        <Hand className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {permissionMode === "full_access"
                          ? t("fullAccess")
                          : t("askBeforeChanges")}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                        permissionMode === "full_access"
                          ? "text-[#e79737]"
                          : "text-muted-foreground",
                        isPermissionOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isPermissionOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-32px)] bg-popover border border-border rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 text-left select-none origin-top-left animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 ease-out">
                      {/* 1. Ask before changes */}
                      <button
                        type="button"
                        onClick={() => {
                          setPermissionMode("ask_before_changes");
                          setIsPermissionOpen(false);
                        }}
                        className={cn(
                          "w-full p-2.5 flex items-start gap-2.5 rounded-xl text-left transition-colors cursor-pointer group",
                          permissionMode === "ask_before_changes"
                            ? "bg-zinc-500/15 dark:bg-white/[0.08] hover:bg-zinc-500/20 dark:hover:bg-white/[0.12]"
                            : "hover:bg-zinc-500/15 dark:hover:bg-white/[0.08]"
                        )}
                      >
                        <Hand className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-foreground">
                            {t("askBeforeChanges")}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {t("askBeforeChangesDesc")}
                          </div>
                        </div>
                        {permissionMode === "ask_before_changes" && (
                          <Check className="w-3.5 h-3.5 text-foreground shrink-0 ml-auto mt-0.5" />
                        )}
                      </button>

                      {/* 2. Full access */}
                      <button
                        type="button"
                        onClick={() => {
                          setPermissionMode("full_access");
                          setIsPermissionOpen(false);
                        }}
                        className={cn(
                          "w-full p-2.5 flex items-start gap-2.5 rounded-xl text-left transition-colors cursor-pointer group",
                          permissionMode === "full_access"
                            ? "bg-zinc-500/15 dark:bg-white/[0.08] hover:bg-zinc-500/20 dark:hover:bg-white/[0.12]"
                            : "hover:bg-zinc-500/15 dark:hover:bg-white/[0.08]"
                        )}
                      >
                        <ShieldAlert className="w-4 h-4 text-[#e79737] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-foreground">
                            {t("fullAccess")}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {t("fullAccessDesc")}
                          </div>
                        </div>
                        {permissionMode === "full_access" && (
                          <Check className="w-3.5 h-3.5 text-[#e79737] shrink-0 ml-auto mt-0.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Folder (Optional) Dropdown */}
                <div className="space-y-1.5 min-w-0 relative" ref={folderMenuRef}>
                  <label className="text-[12px] font-medium text-muted-foreground block">
                    {t("collectionCategoryOptional")}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsIconOpen(false);
                      setIsPermissionOpen(false);
                      setIsFolderOpen((prev) => !prev);
                    }}
                    className={cn(
                      "w-full h-9 px-3 rounded-xl bg-secondary/40 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border border-border/70 text-[12px] text-foreground flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                      isFolderOpen && "border-foreground/30 bg-zinc-500/15 dark:bg-white/[0.08]"
                    )}
                    title={selectedCollection ? selectedCollection.name : t("noCollection")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedCollection ? (
                        <ModuleIcon
                          icon={selectedCollection.emoji}
                          className="w-3.5 h-3.5 text-foreground/80 shrink-0"
                        />
                      ) : (
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {selectedCollection ? selectedCollection.name : t("noCollection")}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150",
                        isFolderOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isFolderOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full min-w-[200px] rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 ease-out">
                      <ScrollArea className="max-h-48 w-full" viewportClassName="p-1.5">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(undefined);
                              setIsFolderOpen(false);
                            }}
                            className={cn(
                              "w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer text-left",
                              !selectedCollectionId
                                ? "bg-zinc-500/15 dark:bg-white/[0.08] text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-zinc-500/15 dark:hover:bg-white/[0.08]"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{t("noCollection")}</span>
                            </div>
                            {!selectedCollectionId && (
                              <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                            )}
                          </button>

                          {collections.map((col) => {
                            const isSelected = selectedCollectionId === col.id;
                            return (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCollectionId(col.id);
                                  setIsFolderOpen(false);
                                }}
                                className={cn(
                                  "w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer text-left",
                                  isSelected
                                    ? "bg-zinc-500/15 dark:bg-white/[0.08] text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-500/15 dark:hover:bg-white/[0.08]"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <ModuleIcon
                                    icon={col.emoji}
                                    className="w-3.5 h-3.5 text-foreground/80 shrink-0"
                                  />
                                  <span className="truncate">{col.name}</span>
                                </div>
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-8 px-3.5 text-[12px] border-border/70 bg-secondary/40 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] text-foreground"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-8 px-4 text-[12px] font-medium"
            >
              {isSubmitting ? t("saving") : isEdit ? t("update") : t("newLearn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
