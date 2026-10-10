import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  ScrollArea,
  Checkbox,
  Badge,
} from "@const/ui";
import { FolderInput, Search, X, CheckSquare, Square } from "lucide-react";
import { LocalLearn, LocalCollection } from "../../../lib/db";
import { useI18n } from "../../../lib/i18n";
import { LearnIcon } from "../learn-icon";

interface ImportLearnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: LocalCollection;
  allLearns: LocalLearn[];
  onImport: (learnIds: string[]) => Promise<void>;
}

export function ImportLearnsDialog({
  open,
  onOpenChange,
  collection,
  allLearns,
  onImport,
}: ImportLearnsDialogProps) {
  const { language, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset states when opening dialog
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedIds(new Set());
      setIsSubmitting(false);
    }
  }, [open]);

  // Filter available learns
  const filteredLearns = useMemo(() => {
    let list = allLearns.filter((l) => !l.isArchived);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allLearns, searchQuery]);

  // Unimported learns that can be selected
  const availableToImport = useMemo(() => {
    return filteredLearns.filter((l) => !l.collectionIds?.includes(collection.id));
  }, [filteredLearns, collection.id]);

  const handleToggleSelect = (learnId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(learnId)) {
        next.delete(learnId);
      } else {
        next.add(learnId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allAvailableIds = availableToImport.map((l) => l.id);
    const allSelected = allAvailableIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      // Unselect all in current available
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allAvailableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all available
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allAvailableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onImport(Array.from(selectedIds));
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to import learns into collection:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isId = language === "id";
  const allAvailableSelected =
    availableToImport.length > 0 &&
    availableToImport.every((l) => selectedIds.has(l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[480px] p-5 rounded-2xl border border-border/80 bg-card text-card-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 overflow-hidden shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          <DialogHeader className="pb-1">
            <DialogTitle className="font-sans text-base font-medium tracking-tight text-foreground flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-primary shrink-0" />
              <span>{t("importLearnsDialogTitle", { name: collection.name })}</span>
            </DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5 font-sans">
              {t("importLearnsDialogDesc")}
            </p>
          </DialogHeader>

          {/* Search bar & Select All actions */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchNotebooksPlaceholder")}
                className="h-8 pl-8 pr-7 text-[12px] rounded-xl bg-secondary/40 border-border/70 focus-visible:ring-1 focus-visible:ring-ring w-full font-sans"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {availableToImport.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5 font-sans">
                <span>
                  {selectedIds.size > 0
                    ? t("selectedCount", { count: selectedIds.size })
                    : t("notebooksAvailableToImport", { count: availableToImport.length })}
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1 font-medium text-primary hover:underline cursor-pointer"
                >
                  {allAvailableSelected ? (
                    <>
                      <Square className="h-3 w-3" />
                      <span>{t("deselectAll")}</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3 w-3" />
                      <span>{t("selectAll")}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Learn list in ScrollArea */}
          <ScrollArea className="max-h-[300px] rounded-xl border border-border/60 bg-secondary/20 p-1.5">
            {filteredLearns.length === 0 ? (
              <div className="text-center py-8 px-4 text-[12px] text-muted-foreground font-sans">
                {searchQuery
                  ? t("noLearnsMatchSearchQuery", { query: searchQuery })
                  : t("noLearnsAvailableToImport")}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLearns.map((learn) => {
                  const isAlreadyInCollection = learn.collectionIds?.includes(collection.id);
                  const isSelected = selectedIds.has(learn.id);

                  return (
                    <div
                      key={learn.id}
                      onClick={() => {
                        if (!isAlreadyInCollection) {
                          handleToggleSelect(learn.id);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all select-none ${
                        isAlreadyInCollection
                          ? "bg-secondary/15 border-transparent opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "bg-secondary/80 border-primary/50 cursor-pointer shadow-2xs"
                          : "bg-card/70 border-border/50 hover:bg-secondary/40 hover:border-border cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-border/40 text-foreground ${
                            isSelected ? "bg-primary/20 text-primary" : "bg-secondary/70"
                          }`}
                        >
                          <LearnIcon icon={learn.emoji} className="w-3.5 h-3.5 text-foreground/90" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-medium truncate ${
                              isSelected ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {learn.title}
                          </p>
                          {learn.description && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {learn.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isAlreadyInCollection ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-2 h-5 font-normal rounded-full font-sans"
                          >
                            {t("alreadyInFolder")}
                          </Badge>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(learn.id);
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(learn.id)}
                              className="h-4 w-4 rounded cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl cursor-pointer h-8 px-3.5 text-[12px] border-border/70"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={selectedIds.size === 0 || isSubmitting}
              className="rounded-xl cursor-pointer h-8 px-4 text-[12px] font-medium"
            >
              {isSubmitting
                ? t("saving")
                : t("addCountToFolder", { count: selectedIds.size })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
