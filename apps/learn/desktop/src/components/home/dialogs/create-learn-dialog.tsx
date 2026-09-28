import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@const/ui";
import { BookOpen, Check, Folder, FolderOpen, Hand, ShieldAlert, X } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { LEARN_ICONS, LEGACY_EMOJI_TO_LEARN_ICON } from "../learn-icon";
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
  const { t } = useI18n();
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

  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setSelectedEmoji(getInitialIcon(initialData?.emoji));
      setSelectedCollectionId(initialData?.collectionIds?.[0]);
      setProjectPath(initialData?.projectPath ?? "");
      setPermissionMode(initialData?.permissionMode ?? "ask_before_changes");
    }
  }, [open, initialData]);

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

  const isEdit = !!initialData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[440px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        <form onSubmit={handleSubmit} className="space-y-3.5 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-serif text-base font-medium tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>{isEdit ? t("editLearnDialogTitle") : t("createLearnDialogTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Clean Modern Icon Selector (8 cols x 2 rows) */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              {t("learnIcon") || t("pickIconEmoji")}
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-secondary/40 border border-border/60 w-full justify-items-center">
              {LEARN_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedEmoji === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedEmoji(item.id)}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-foreground text-background shadow-xs scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border/50"
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title input */}
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("learnTitleLabel")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("learnTitlePlaceholder")}
              className="h-8 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full min-w-0 px-3 placeholder:text-muted-foreground/50"
              autoFocus
              required
            />
          </div>

          {/* Project Folder / Workspace Selection */}
          <div className="space-y-1">
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

            <div className="flex items-center gap-1.5 w-full min-w-0">
              <div
                className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-secondary/40 border border-border/70 text-[12px] text-foreground flex items-center overflow-hidden"
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
                  className="rounded-xl h-8 px-2.5 text-[12px] gap-1.5 shrink-0 cursor-pointer border-border/70"
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

          {/* Permission Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-muted-foreground block">
              {t("permissionModeLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPermissionMode("ask_before_changes")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  permissionMode === "ask_before_changes"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/70 bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Hand className="h-4 w-4 text-foreground shrink-0" />
                  {permissionMode === "ask_before_changes" && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </div>
                <div>
                  <div className="text-[12px] font-medium text-foreground">
                    {t("askBeforeChanges")}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
                    {t("askBeforeChangesDesc")}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPermissionMode("full_access")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  permissionMode === "full_access"
                    ? "border-amber-500/60 bg-amber-500/10 shadow-xs"
                    : "border-border/70 bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                  {permissionMode === "full_access" && (
                    <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
                <div>
                  <div className="text-[12px] font-medium text-foreground">
                    {t("fullAccess")}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
                    {t("fullAccessDesc")}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Collection Assignment */}
          {!isEdit && collections.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                {t("collectionCategoryOptional")}
              </label>
              <Select
                value={selectedCollectionId || "none"}
                onValueChange={(val) =>
                  setSelectedCollectionId(val === "none" ? undefined : val)
                }
              >
                <SelectTrigger className="w-full h-8 px-2.5 rounded-xl bg-secondary/40 border border-border/70 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <SelectValue placeholder={t("noCollection")} />
                </SelectTrigger>
                <SelectContent className="max-h-56 z-50 rounded-xl border-border bg-popover text-popover-foreground shadow-lg">
                  <SelectItem value="none" className="text-xs py-2 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{t("noCollection")}</span>
                    </div>
                  </SelectItem>
                  {collections.map((col) => (
                    <SelectItem key={col.id} value={col.id} className="text-xs py-2 cursor-pointer">
                      <div className="flex items-center gap-2 min-w-0">
                        <ModuleIcon icon={col.emoji} className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                        <span className="truncate">{col.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-8 px-3.5 text-[12px] border-border/70"
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
