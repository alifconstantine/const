import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!initialData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[400px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              {isEdit ? t("editCollectionDialogTitle") : t("createCollectionDialogTitle")}
            </DialogTitle>
          </DialogHeader>

          {/* Clean Modern Icon Selector (8 cols x 2 rows) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("collectionIcon")}
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-secondary/50 border border-border/60 justify-items-center">
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
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
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
            <label className="text-xs font-medium text-muted-foreground">
              {t("collectionNameLabel")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("collectionNamePlaceholder")}
              className="h-10 rounded-xl bg-secondary/40 border-border/70 text-sm focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
              required
            />
          </div>

          {/* Description input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t("collectionDescOptional")}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("collectionDescPlaceholder")}
              className="h-10 rounded-xl bg-secondary/40 border-border/70 text-sm focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2 flex flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-9 px-4 text-xs flex-1"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium flex-1"
            >
              {isSubmitting ? t("saving") : isEdit ? t("update") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
