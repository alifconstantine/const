import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from "@const/ui";
import { Folder, Check } from "lucide-react";
import { useI18n } from "../../../lib/i18n";

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
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggle = async (collectionId: string) => {
    setLoadingId(collectionId);
    try {
      await onToggle(learnId, collectionId);
    } catch (err) {
      console.error("Failed to toggle collection:", err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[400px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            {t("manageCollectionsDialogTitle")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground line-clamp-1 pt-1">
            {t("manageCollectionsFor", { title: learnTitle })}
          </p>
        </DialogHeader>

        <div className="py-2 space-y-1.5 max-h-[260px] overflow-y-auto">
          {collections.length === 0 ? (
            <div className="text-center py-6 px-4 bg-secondary/30 rounded-xl border border-dashed border-border/70">
              <p className="text-xs text-muted-foreground">
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
                  className="mt-3 rounded-full text-xs h-8 cursor-pointer"
                >
                  + {t("newCollection")}
                </Button>
              )}
            </div>
          ) : (
            collections.map((col) => {
              const isSelected = currentCollectionIds.includes(col.id);
              const isLoading = loadingId === col.id;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleToggle(col.id)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-secondary border-foreground/30 text-foreground"
                      : "bg-secondary/30 border-border/60 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{col.emoji || "📁"}</span>
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

        <DialogFooter className="pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full cursor-pointer h-9 px-5 text-xs font-medium w-full"
          >
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
