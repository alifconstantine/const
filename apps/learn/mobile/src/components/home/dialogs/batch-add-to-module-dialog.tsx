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
import { Folder, Check, FolderPlus, Loader2, Search } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { ModuleIcon } from "../module-icon";

interface BatchAddToModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  collections: Array<{
    id: string;
    name: string;
    emoji?: string;
  }>;
  onAddToModule: (moduleId: string) => Promise<void>;
  onCreateNewModule?: () => void;
}

export function BatchAddToModuleDialog({
  open,
  onOpenChange,
  selectedCount,
  collections = [],
  onAddToModule,
  onCreateNewModule,
}: BatchAddToModuleDialogProps) {
  const { t, language } = useI18n();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCollections = collections.filter((c) =>
    searchQuery.trim() ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const handleSubmit = async () => {
    if (!selectedModuleId) return;
    setIsSubmitting(true);
    try {
      await onAddToModule(selectedModuleId);
      setSelectedModuleId(null);
      setSearchQuery("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to add learns to module:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedModuleId(null);
      setSearchQuery("");
    }
    onOpenChange(nextOpen);
  };

  const subtitleText =
    language === "id"
      ? `Pilih folder tujuan untuk ${selectedCount} materi yang dipilih.`
      : `Select a destination folder for ${selectedCount} selected items.`;

  const addButtonText =
    language === "id"
      ? isSubmitting ? "Menambahkan..." : "Masukkan ke Folder"
      : isSubmitting ? "Adding..." : "Add to Folder";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[92vw] max-w-[400px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg outline-none">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            {t("addToModule")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
            {subtitleText}
          </p>
        </DialogHeader>

        {collections.length > 3 && (
          <div className="relative my-2">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "id" ? "Cari folder..." : "Search folders..."}
              className="h-8 pl-8 pr-3 text-xs rounded-xl bg-secondary/40 border-border/70 placeholder:text-muted-foreground/50 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </div>
        )}

        <div className="py-2 space-y-1.5 max-h-[260px] overflow-y-auto">
          {filteredCollections.length === 0 ? (
            <div className="text-center py-6 px-4 bg-secondary/30 rounded-xl border border-dashed border-border/70">
              <p className="text-xs text-muted-foreground">
                {searchQuery ? t("noLearnsMatchSearch", { query: searchQuery }) : t("noCollectionsYet")}
              </p>
              {onCreateNewModule && !searchQuery && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onCreateNewModule();
                  }}
                  className="mt-3 rounded-full text-xs h-8 cursor-pointer"
                >
                  + {t("newCollection")}
                </Button>
              )}
            </div>
          ) : (
            filteredCollections.map((col) => {
              const isSelected = selectedModuleId === col.id;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedModuleId(col.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer outline-none ${
                    isSelected
                      ? "bg-secondary border-primary/50 text-foreground ring-1 ring-primary/30"
                      : "bg-secondary/30 border-border/60 active:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center shrink-0 text-foreground">
                      <ModuleIcon icon={col.emoji} className="w-3.5 h-3.5 text-foreground/90" />
                    </div>
                    <span className="text-xs font-medium truncate">{col.name}</span>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border/80 bg-background"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {collections.length > 0 && onCreateNewModule && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onCreateNewModule();
              }}
              className="text-xs text-muted-foreground hover:text-foreground active:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>+ {t("newCollection")}</span>
            </button>
          </div>
        )}

        <DialogFooter className="pt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-full cursor-pointer h-9 px-4 text-xs font-medium"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedModuleId || isSubmitting}
            className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium gap-1.5"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {addButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
