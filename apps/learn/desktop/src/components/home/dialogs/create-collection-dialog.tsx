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
      <DialogContent className="sm:max-w-[420px] p-6 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              {isEdit ? "Ubah Koleksi" : "Buat Koleksi Baru"}
            </DialogTitle>
          </DialogHeader>

          {/* Emoji Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Ikon Koleksi
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
                      : "hover:bg-background/60 hover:scale-105"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Nama Koleksi
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kecerdasan Buatan, Riset Fisika"
              className="h-10 rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
              required
            />
          </div>

          {/* Description input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Deskripsi (Opsional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kategori materi untuk topik tertentu"
              className="h-10 rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full cursor-pointer h-9 px-4 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium"
            >
              {isSubmitting ? "Menyimpan..." : isEdit ? "Perbarui" : "Buat Koleksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
