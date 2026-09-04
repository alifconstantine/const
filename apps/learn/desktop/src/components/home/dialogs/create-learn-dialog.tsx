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
import { BookOpen, Folder, FolderOpen, X } from "lucide-react";

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
    projectPath?: string;
  };
  onSubmit: (data: {
    id?: string;
    title: string;
    description?: string;
    emoji: string;
    collectionId?: string;
    projectPath?: string;
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
  const [projectPath, setProjectPath] = useState<string>(initialData?.projectPath ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setDescription(initialData?.description ?? "");
      setSelectedEmoji(initialData?.emoji ?? "🚀");
      setSelectedCollectionId(initialData?.collectionIds?.[0]);
      setProjectPath(initialData?.projectPath ?? "");
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
        description: description.trim() || undefined,
        emoji: selectedEmoji,
        collectionId: selectedCollectionId,
        projectPath: projectPath.trim() || undefined,
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
      <DialogContent className="sm:max-w-[440px] p-6 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {isEdit ? "Ubah Detail Learn" : "Buat Learn Baru"}
            </DialogTitle>
          </DialogHeader>

          {/* Emoji Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Pilih Ikon / Emoji
            </label>
            <div className="grid grid-cols-8 gap-2 p-2 rounded-xl bg-secondary/50 border border-border/60">
              {EMOJI_OPTIONS.map((emoji) => (
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

          {/* Title input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Judul Learn
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kimi K3 Architecture & Pre-training"
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
              placeholder="Catatan ringkas atau topik materi"
              className="h-10 rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Project Folder / Workspace Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-primary" />
                <span>Folder Proyek (Workspace)</span>
              </label>
              {projectPath && (
                <button
                  type="button"
                  onClick={() => setProjectPath("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Gunakan Global</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-10 px-3 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground flex items-center overflow-hidden"
                title={projectPath || "Di luar proyek (Global Workspace di ~/.const/learn/)"}
              >
                <span className="truncate">
                  {projectPath ? projectPath : "Di luar proyek (Global Workspace)"}
                </span>
              </div>

              {window.electron?.openDirectoryDialog && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectFolder}
                  className="rounded-xl h-10 px-3 text-xs gap-1.5 shrink-0 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>Pilih Folder</span>
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              {projectPath
                ? "Agent dapat membaca, menganalisis, dan mengeksekusi perintah di dalam folder proyek ini."
                : "Akan disimpan secara global di ~/.const/learn/. Pilih folder jika Anda ingin menganalisis kode/berkas proyek tertentu."}
            </p>
          </div>

          {/* Collection Assignment */}

          {!isEdit && collections.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Kategori Koleksi (Opsional)
              </label>
              <select
                value={selectedCollectionId ?? ""}
                onChange={(e) =>
                  setSelectedCollectionId(e.target.value || undefined)
                }
                className="w-full h-10 px-3 rounded-xl bg-secondary/40 border border-border/70 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Tanpa Koleksi</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              disabled={!title.trim() || isSubmitting}
              className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium"
            >
              {isSubmitting ? "Menyimpan..." : isEdit ? "Perbarui" : "Buat Learn"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
