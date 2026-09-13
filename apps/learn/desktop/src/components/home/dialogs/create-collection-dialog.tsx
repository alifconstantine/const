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
      <DialogContent className="w-full max-w-[400px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit} className="space-y-3.5 w-full min-w-0">
          <DialogHeader className="pb-0.5">
            <DialogTitle className="font-serif text-base font-medium tracking-tight text-foreground flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-primary shrink-0" />
              <span>{isEdit ? "Ubah Koleksi" : "Buat Koleksi Baru"}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Emoji Picker */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              Ikon Koleksi
            </label>
            <div className="grid grid-cols-6 gap-1 p-1.5 rounded-xl bg-secondary/40 border border-border/60 w-full justify-items-center">
              {COLLECTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer ${
                    selectedEmoji === emoji
                      ? "bg-background border border-primary shadow-xs"
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
            <label className="text-[12px] font-medium text-muted-foreground">
              Nama Koleksi
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kecerdasan Buatan, Riset Fisika"
              className="h-8 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full min-w-0 px-3 placeholder:text-muted-foreground/50"
              autoFocus
              required
            />
          </div>

          {/* Description input */}
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              Deskripsi (Opsional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kategori materi untuk topik tertentu"
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
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-8 px-4 text-[12px] font-medium"
            >
              {isSubmitting ? "Menyimpan..." : isEdit ? "Perbarui" : "Buat Koleksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
