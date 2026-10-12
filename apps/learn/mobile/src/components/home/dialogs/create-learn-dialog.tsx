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
import { BookOpen, Check, ChevronDown, Folder } from "lucide-react";
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
  };
  onSubmit: (data: {
    id?: string;
    title: string;
    description?: string;
    emoji: string;
    collectionId?: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIconOpen, setIsIconOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const iconMenuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setSelectedEmoji(getInitialIcon(initialData?.emoji));
      setSelectedCollectionId(initialData?.collectionIds?.[0]);
      setIsIconOpen(false);
      setIsFolderOpen(false);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!isIconOpen && !isFolderOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isIconOpen && iconMenuRef.current && !iconMenuRef.current.contains(target)) {
        setIsIconOpen(false);
      }
      if (isFolderOpen && folderMenuRef.current && !folderMenuRef.current.contains(target)) {
        setIsFolderOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isIconOpen, isFolderOpen]);

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
          if (isIconOpen || isFolderOpen) {
            e.preventDefault();
            setIsIconOpen(false);
            setIsFolderOpen(false);
          }
        }}
        className="w-[94vw] max-w-[480px] p-5 rounded-2xl border-none bg-card text-card-foreground shadow-2xl outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0"
      >
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <span>{isEdit ? t("editLearnDialogTitle") : t("createLearnDialogTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Row 1: Title | Icon (wide multi-column dropdown with ScrollArea) */}
          <div className="grid grid-cols-[1fr_132px] sm:grid-cols-[1fr_148px] gap-2.5 items-start">
            {/* Title input (borderless) */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-foreground/80 flex items-center justify-between">
                <span>{t("learnTitleLabel")}</span>
                <span className="text-[11px] text-muted-foreground/60">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("learnTitlePlaceholder")}
                className="h-10 text-xs sm:text-sm rounded-xl bg-secondary/50 border-none text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-ring shadow-none"
                autoFocus
                required
              />
            </div>

            {/* Icon Dropdown */}
            <div className="space-y-1.5 relative" ref={iconMenuRef}>
              <label className="text-xs font-medium text-foreground/80 block">
                {t("learnIcon") || t("pickIconEmoji")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsFolderOpen(false);
                  setIsIconOpen((prev) => !prev);
                }}
                className={cn(
                  "h-10 w-full px-3 rounded-xl bg-secondary/50 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border-none text-xs text-foreground flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                  isIconOpen && "bg-zinc-500/15 dark:bg-white/[0.08] ring-1 ring-ring"
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
                <div className="absolute right-0 top-full mt-1.5 w-[280px] sm:w-[308px] rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 ease-out">
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
                              "flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl transition-colors cursor-pointer select-none",
                              isSelected
                                ? "bg-zinc-500/20 dark:bg-white/[0.12] text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] active:scale-95"
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

          {/* Folder (Collection) Assignment (borderless) */}
          {!isEdit && (
            <div className="space-y-1.5 relative" ref={folderMenuRef}>
              <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{t("collectionCategoryOptional")}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsIconOpen(false);
                  setIsFolderOpen((prev) => !prev);
                }}
                className={cn(
                  "w-full h-10 px-3 rounded-xl bg-secondary/50 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] border-none text-xs text-foreground flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                  isFolderOpen && "bg-zinc-500/15 dark:bg-white/[0.08] ring-1 ring-ring"
                )}
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
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden origin-top animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 ease-out">
                  <ScrollArea className="max-h-48 w-full" viewportClassName="p-1.5">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCollectionId(undefined);
                          setIsFolderOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer text-left",
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
                              "w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer text-left",
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
          )}

          {/* Dialog Footer (borderless) */}
          <DialogFooter className="pt-2 flex flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-10 px-4 text-xs flex-1 border-none bg-secondary/70 hover:bg-zinc-500/15 dark:hover:bg-white/[0.08] text-foreground shadow-none"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-10 px-5 text-xs font-medium flex-1 shadow-sm"
            >
              {isSubmitting ? t("saving") : isEdit ? t("update") : t("newLearn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
