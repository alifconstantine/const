import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  toast,
} from "@const/ui";
import { FolderPlus } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { MODULE_ICONS, LEGACY_EMOJI_TO_ICON } from "../module-icon";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
  };
  onSubmit: (data: {
    id?: string;
    name: string;
    description?: string;
    emoji: string;
  }) => Promise<void>;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: CreateCollectionDialogProps) {
  const { t } = useI18n();
  const resolveIconId = (emoji?: string) => {
    if (!emoji) return "folder";
    return LEGACY_EMOJI_TO_ICON[emoji] || emoji;
  };

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(resolveIconId(initialData?.emoji));
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setDescription(initialData?.description ?? "");
      setSelectedEmoji(resolveIconId(initialData?.emoji));
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: initialData?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        emoji: selectedEmoji,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save collection:", err);
      toast.error(t("failedSaveCollection"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!initialData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[420px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-serif text-base font-medium tracking-tight text-foreground flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-primary shrink-0" />
              <span>{isEdit ? t("editCollectionDialogTitle") : t("createCollectionDialogTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Clean Modern Icon Selector (8 cols x 2 rows) */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              {t("collectionIcon")}
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-secondary/40 border border-border/60 w-full justify-items-center">
              {MODULE_ICONS.map((item) => {
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

          {/* Name input */}
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("collectionNameLabel")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("collectionNamePlaceholder")}
              className="h-8 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full min-w-0 px-3 placeholder:text-muted-foreground/50"
              autoFocus
              required
            />
          </div>

          {/* Description input */}
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("collectionDescOptional")}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("collectionDescPlaceholder")}
              className="h-8 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full min-w-0 px-3 placeholder:text-muted-foreground/50"
            />
          </div>

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
              disabled={!name.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-8 px-4 text-[12px] font-medium"
            >
              {isSubmitting ? t("saving") : isEdit ? t("update") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
