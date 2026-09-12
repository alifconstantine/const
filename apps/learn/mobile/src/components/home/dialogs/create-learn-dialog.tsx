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
import { BookOpen } from "lucide-react";
const EMOJI_OPTIONS = [
  "🚀", "🧠", "💡", "🎨", "🏆", "📚", "💻", "🔬",
  "📐", "⚡", "🌐", "📝", "🧬", "🪐", "🎯", "🤖"
];

interface CreateLearnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections?: Array<{ id: string; name: string }>;
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
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(initialData?.emoji ?? "🚀");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialData?.collectionIds?.[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setDescription(initialData?.description ?? "");
      setSelectedEmoji(initialData?.emoji ?? "🚀");
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
        description: description.trim() || undefined,
        emoji: selectedEmoji,
        collectionId: selectedCollectionId,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save learn:", err);
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
              <BookOpen className="h-5 w-5 text-primary" />
              {isEdit ? "Edit Notebook" : "New Notebook"}
            </DialogTitle>
          </DialogHeader>

          {/* Emoji Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Choose Icon / Emoji
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-secondary/50 border border-border/60">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center text-base transition-all cursor-pointer ${
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

          {/* Title input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Notebook Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Machine Learning Systems"
              className="h-10 rounded-xl bg-secondary/40 border-border/70 text-sm focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
              required
            />
          </div>

          {/* Description input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Description (Optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary or topic notes"
              className="h-10 rounded-xl bg-secondary/40 border-border/70 text-sm focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Collection Assignment */}
          {!isEdit && collections.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Collection (Optional)
              </label>
              <select
                value={selectedCollectionId ?? ""}
                onChange={(e) =>
                  setSelectedCollectionId(e.target.value || undefined)
                }
                className="w-full h-10 px-3 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">No Collection</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-9 px-4 text-xs flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium flex-1"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
