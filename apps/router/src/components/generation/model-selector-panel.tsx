"use client";

import { useState, useMemo } from "react";
import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  ScrollArea,
  cn,
} from "@const/ui";
import { Search, Check, X, Layers } from "lucide-react";
import { BUILTIN_MODELS, type ModelSpec } from "@/lib/model-specs";

interface ModelSelectorPanelProps {
  open: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: ModelSpec) => void;
  customModels?: ModelSpec[];
  comboModels?: ModelSpec[];
}

export function ModelSelectorPanel({
  open,
  onClose,
  selectedModelId,
  onSelectModel,
  customModels = [],
  comboModels = [],
}: ModelSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const standardModels = useMemo(() => {
    return [...BUILTIN_MODELS, ...customModels].filter(
      (m) => m.category === "llm",
    );
  }, [customModels]);

  const filteredCombos = useMemo(() => {
    if (!searchQuery.trim()) return comboModels;
    const q = searchQuery.toLowerCase();
    return comboModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        (m.comboSlug && m.comboSlug.toLowerCase().includes(q)),
    );
  }, [comboModels, searchQuery]);

  const filteredStandardModels = useMemo(() => {
    if (!searchQuery.trim()) return standardModels;
    const q = searchQuery.toLowerCase();
    return standardModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        (m.providerName && m.providerName.toLowerCase().includes(q)),
    );
  }, [standardModels, searchQuery]);

  const totalCount = filteredCombos.length + filteredStandardModels.length;

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-card border-l border-border/80 shadow-2xl z-50 gap-0"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between">
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
        <div className="p-4 sm:p-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models or combos..."
              className="pl-9 h-10 rounded-xl text-sm font-sans border-border/80 bg-background text-foreground placeholder:text-muted-foreground/70"
              autoFocus
            />
          </div>
        </div>

        {/* Models List with ScrollArea */}
        <ScrollArea className="flex-1 p-3">
          {totalCount === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground font-normal">
              No models or combos found
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Virtual Combos Section */}
              {filteredCombos.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 flex items-center justify-between text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Virtual Combos
                    </span>
                    <span className="text-[10px] font-normal normal-case opacity-70">
                      Multi-model failover
                    </span>
                  </div>
                  {filteredCombos.map((m) => {
                    const isSelected =
                      m.modelId === selectedModelId ||
                      m.id === selectedModelId ||
                      m.modelId === `combo/${selectedModelId}`;

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m);
                          onClose();
                        }}
                        className={cn(
                          "group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors select-none",
                          isSelected
                            ? "bg-foreground text-background font-medium shadow-sm"
                            : "hover:bg-secondary/70 text-foreground",
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm sm:text-base font-medium">
                              {m.name}
                            </span>
                            {m.modelsCount !== undefined && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0",
                                  isSelected
                                    ? "bg-background/20 text-background"
                                    : "bg-secondary text-muted-foreground",
                                )}
                              >
                                {m.modelsCount}{" "}
                                {m.modelsCount === 1 ? "model" : "models"}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs truncate font-mono mt-0.5",
                              isSelected
                                ? "text-background/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {m.modelId}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 stroke-[2.5] shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Free & paid models Section */}
              {filteredStandardModels.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                    Standard Models
                  </div>
                  {filteredStandardModels.map((m) => {
                    const isSelected =
                      m.modelId === selectedModelId || m.id === selectedModelId;

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m);
                          onClose();
                        }}
                        className={cn(
                          "group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors select-none",
                          isSelected
                            ? "bg-foreground text-background font-medium shadow-sm"
                            : "hover:bg-secondary/70 text-foreground",
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate text-sm sm:text-base font-medium">
                            {m.name} {m.tier === "free" ? " · Free" : " · Paid"}
                          </span>
                          <span
                            className={cn(
                              "text-xs truncate font-mono mt-0.5",
                              isSelected
                                ? "text-background/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {m.providerName} • {m.modelId}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 stroke-[2.5] shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3.5 px-5 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-sans text-xs text-muted-foreground">
            {totalCount} options available ({filteredCombos.length} combos,{" "}
            {filteredStandardModels.length} models)
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
