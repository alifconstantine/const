"use client";

import { useState, useMemo } from "react";
import { Button, Input, Sheet, SheetContent, SheetClose, SheetTitle, cn } from "@const/ui";
import { Search, Check, X } from "lucide-react";
import { BUILTIN_MODELS, type ModelSpec } from "@/lib/model-specs";

interface ModelSelectorPanelProps {
  open: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: ModelSpec) => void;
  customModels?: ModelSpec[];
}

export function ModelSelectorPanel({
  open,
  onClose,
  selectedModelId,
  onSelectModel,
  customModels = [],
}: ModelSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const allModels = useMemo(() => {
    return [...BUILTIN_MODELS, ...customModels];
  }, [customModels]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const q = searchQuery.toLowerCase();
    return allModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q)
    );
  }, [allModels, searchQuery]);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-card border-l border-border/80 shadow-2xl z-50 gap-0"
      >
        {/* Header (Clean Typography, No Icon) */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between">
          <SheetTitle className="font-sans text-base sm:text-lg font-semibold text-foreground">
            Select model
          </SheetTitle>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

      {/* Search Input */}
      <div className="p-4 sm:p-5 pb-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models..."
            className="pl-9 h-10 rounded-xl text-sm font-sans border-border/80 bg-background text-foreground placeholder:text-muted-foreground/70"
            autoFocus
          />
        </div>
      </div>

      {/* Models List - Only Model Name, Clear Readable Font! */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredModels.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground font-normal">
            No models found
          </div>
        ) : (
          filteredModels.map((m) => {
            const isSelected = m.modelId === selectedModelId || m.id === selectedModelId;
            return (
              <div
                key={m.id}
                onClick={() => {
                  onSelectModel(m);
                  onClose();
                }}
                className={cn(
                  "group flex items-center justify-between px-4 py-3.5 rounded-xl text-sm sm:text-base font-sans cursor-pointer transition-colors select-none",
                  isSelected
                    ? "bg-foreground text-background font-medium shadow-sm"
                    : "hover:bg-secondary/70 text-foreground"
                )}
              >
                <span className="truncate">{m.name}</span>
                {isSelected && (
                  <Check className="h-4 w-4 stroke-[2.5] shrink-0 ml-2" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 px-5 border-t border-border/70 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-sans text-xs text-muted-foreground">
          {filteredModels.length} models available
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-8 px-4 rounded-full text-xs font-medium cursor-pointer border-border/70"
        >
          Done
        </Button>
      </div>
    </SheetContent>
  </Sheet>
);
}
