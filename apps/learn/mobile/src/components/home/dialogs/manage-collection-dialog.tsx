import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from "@const/ui";
import { Folder, Check, Plus } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { ModuleIcon } from "../module-icon";

interface ManageCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnTitle: string;
  learnId: string;
  currentCollectionIds?: string[];
  collections: Array<{
    id: string;
    name: string;
    emoji?: string;
  }>;
  onToggle: (learnId: string, collectionId: string) => Promise<void>;
  onCreateNewCollection?: () => void;
}

export function ManageCollectionDialog({
  open,
  onOpenChange,
  learnTitle,
  learnId,
  currentCollectionIds = [],
  collections = [],
  onToggle,
  onCreateNewCollection,
}: ManageCollectionDialogProps) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentCollectionIds);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(currentCollectionIds);
  }, [currentCollectionIds]);

  const handleToggle = async (collectionId: string) => {
    const isSelected = selectedIds.includes(collectionId);
    const next = isSelected
      ? selectedIds.filter((id) => id !== collectionId)
      : [...selectedIds, collectionId];

    // Optimistic local update
    setSelectedIds(next);
    setLoadingId(collectionId);
    try {
      await onToggle(learnId, collectionId);
    } catch (err) {
      console.error("Failed to toggle collection:", err);
      // Revert if failed
      setSelectedIds(currentCollectionIds);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[400px] p-4 sm:p-5 rounded-2xl border border-border/80 bg-card text-card-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 overflow-hidden shadow-xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-sans text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary shrink-0" />
            <span>{t("manageCollectionsDialogTitle")}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground line-clamp-1 pt-0.5 font-sans">
            {t("manageCollectionsFor", { title: learnTitle })}
          </p>
        </DialogHeader>

        <div className="py-1.5 space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
          {collections.length === 0 ? (
            <div className="text-center py-8 px-4 bg-secondary/30 rounded-xl border border-dashed border-border/70">
              <p className="text-xs text-muted-foreground font-sans">
                {t("noCollectionsYet")}
              </p>
              {onCreateNewCollection && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onCreateNewCollection();
                  }}
                  className="mt-3 rounded-xl text-xs h-8 cursor-pointer border-border/70 font-sans"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t("newCollection")}
                </Button>
              )}
            </div>
          ) : (
            collections.map((col) => {
              const isSelected = selectedIds.includes(col.id);
              const isLoading = loadingId === col.id;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleToggle(col.id)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer select-none font-sans ${
                    isSelected
                      ? "bg-secondary/90 border-primary/50 text-foreground shadow-2xs"
                      : "bg-secondary/30 border-border/60 hover:bg-secondary/60 hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div className="h-7 w-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center shrink-0 text-foreground">
                      <ModuleIcon icon={col.emoji} className="w-3.5 h-3.5 text-foreground/90" />
                    </div>
                    <span className="text-xs font-medium truncate">{col.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                        isSelected
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-secondary text-muted-foreground/80 border border-border/50"
                      }`}
                    >
                      {isSelected ? t("inThisFolder") : t("notInFolder")}
                    </span>
                    <div
                      className={`h-5 w-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground shadow-2xs"
                          : "border-border/80 bg-background/80"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="pt-2 flex flex-row items-center justify-end">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl cursor-pointer h-8 px-4 text-xs font-medium w-full font-sans"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
