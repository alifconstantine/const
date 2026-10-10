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
import { BookOpen, Folder } from "lucide-react";
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
  const { t } = useI18n();

  const getInitialIcon = (raw?: string) => {
    if (!raw) return "book";
    return LEGACY_EMOJI_TO_LEARN_ICON[raw] || raw;
  };

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(getInitialIcon(initialData?.emoji));
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialData?.collectionIds?.[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setSelectedEmoji(getInitialIcon(initialData?.emoji));
      setHoveredEmoji(null);
      setSelectedCollectionId(initialData?.collectionIds?.[0]);
    }
  }, [open, initialData]);

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
  const activeIconDef = LEARN_ICONS.find((i) => i.id === (hoveredEmoji || selectedEmoji));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[420px] p-5 rounded-2xl border-none bg-card text-card-foreground shadow-2xl outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <span>{isEdit ? t("editLearnDialogTitle") : t("createLearnDialogTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Clean Modern Icon Selector (8 cols x 2 rows, borderless) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/80 block">
                {t("learnIcon") || t("pickIconEmoji")}
              </label>
              <span className="text-[11px] text-muted-foreground/80 font-sans capitalize">
                {activeIconDef?.label}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-secondary/50 border-none justify-items-center">
              {LEARN_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedEmoji === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedEmoji(item.id)}
                    onMouseEnter={() => setHoveredEmoji(item.id)}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-foreground text-background shadow-xs scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/10 hover:scale-105 active:scale-95 border-none"
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

          {/* Title input (borderless) */}
          <div className="space-y-1.5">
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

          {/* Folder (Collection) Assignment (borderless) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{t("collectionCategoryOptional")}</span>
              </label>
              {collections.length > 0 ? (
                <Select
                  value={selectedCollectionId || "none"}
                  onValueChange={(val) =>
                    setSelectedCollectionId(val === "none" ? undefined : val)
                  }
                >
                  <SelectTrigger className="w-full h-10 px-3 rounded-xl bg-secondary/50 border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-none">
                    <SelectValue placeholder={t("noCollection")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 z-50 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg">
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
              ) : (
                <div className="h-10 px-3 rounded-xl bg-secondary/30 border-none text-xs text-muted-foreground flex items-center gap-2 select-none">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <span>{t("noCollection")}</span>
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
              className="rounded-full cursor-pointer h-10 px-4 text-xs flex-1 border-none bg-secondary/70 hover:bg-secondary text-foreground shadow-none"
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
