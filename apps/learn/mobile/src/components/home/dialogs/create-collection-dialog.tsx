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
const COLLECTION_EMOJIS = ["📁", "📚", "🔬", "💻", "🎯", "🚀", "🧪", "📊", "🎨", "⚡", "🧠", "💡"];

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
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(initialData?.emoji ?? "📁");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setDescription(initialData?.description ?? "");
      setSelectedEmoji(initialData?.emoji ?? "📁");
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
      <DialogContent className="w-[92vw] max-w-[400px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              {isEdit ? t("editCollectionDialogTitle") : t("createCollectionDialogTitle")}
            </DialogTitle>
          </DialogHeader>

          {/* Emoji Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("collectionIcon")}
            </label>
            <div className="grid grid-cols-6 gap-2 p-2 rounded-xl bg-secondary/50 border border-border/60">
              {COLLECTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer ${
                    selectedEmoji === emoji
                      ? "bg-background border-2 border-primary shadow-xs scale-105"
                      : "hover:bg-background/60"
                  }`}
                >
                  {emoji}
                </button>
              ))}
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
