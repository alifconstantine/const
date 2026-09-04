"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  cn,
} from "@const/ui";
import { Check, Lock } from "lucide-react";
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_OUTPUT } from "@/lib/model-specs";

export interface ModelConfigData {
  modelId: string;
  name?: string;
  contextWindow: string;
  maxOutputTokens: string;
  inputTypes: string[];
  outputTypes: string[];
}

interface ModelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  initialData?: Partial<ModelConfigData> | null;
  onSave: (data: ModelConfigData) => Promise<void> | void;
  isSaving?: boolean;
}

export function ModelConfigDialog({
  open,
  onOpenChange,
  title = "Add model",
  initialData,
  onSave,
  isSaving = false,
}: ModelConfigDialogProps) {
  const [modelId, setModelId] = useState("");
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [maxOutputTokens, setMaxOutputTokens] = useState(DEFAULT_MAX_OUTPUT);
  const [inputTypes, setInputTypes] = useState<string[]>(["text"]);
  const [outputTypes, setOutputTypes] = useState<string[]>(["text"]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setModelId(initialData?.modelId || "");
      setContextWindow(initialData?.contextWindow || DEFAULT_CONTEXT_WINDOW);
      setMaxOutputTokens(initialData?.maxOutputTokens || DEFAULT_MAX_OUTPUT);
      setInputTypes(
        initialData?.inputTypes && initialData.inputTypes.length > 0
          ? Array.from(new Set(["text", ...initialData.inputTypes]))
          : ["text"]
      );
      setOutputTypes(
        initialData?.outputTypes && initialData.outputTypes.length > 0
          ? Array.from(new Set(["text", ...initialData.outputTypes]))
          : ["text"]
      );
      setError(null);
    }
  }, [open, initialData]);

  const toggleInputType = (type: string) => {
    if (type === "text") return; // Text is locked
    setInputTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = modelId.trim();
    if (!cleanId) {
      setError("Model ID is required.");
      return;
    }

    try {
      await onSave({
        modelId: cleanId,
        name: initialData?.name || cleanId,
        contextWindow: contextWindow.trim() || DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: maxOutputTokens.trim() || DEFAULT_MAX_OUTPUT,
        inputTypes,
        outputTypes,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save model.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl bg-card border-border/80 shadow-2xl text-foreground font-sans">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold text-foreground">
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {/* 1. Model ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Model ID
            </label>
            <input
              type="text"
              placeholder="Model ID"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                if (error) setError(null);
              }}
              className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/80 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* 2. Context window */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Context window
            </label>
            <input
              type="text"
              value={contextWindow}
              onChange={(e) => setContextWindow(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/80 text-xs font-mono text-foreground outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* 3. Max output tokens */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Max output tokens
            </label>
            <input
              type="text"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/80 text-xs font-mono text-foreground outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* 4. Input types */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-muted-foreground">
              Input types
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Text (Locked) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/40 text-xs font-sans text-foreground opacity-90 cursor-not-allowed select-none">
                <div className="h-4 w-4 rounded bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
                <span>Text</span>
                <Lock className="h-3 w-3 text-muted-foreground" />
              </div>

              {/* Image (Toggleable) */}
              <button
                type="button"
                onClick={() => toggleInputType("image")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-sans cursor-pointer transition-colors select-none",
                  inputTypes.includes("image")
                    ? "border-foreground/30 bg-secondary/70 text-foreground"
                    : "border-border/60 bg-transparent text-muted-foreground hover:bg-secondary/30"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    inputTypes.includes("image")
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  )}
                >
                  {inputTypes.includes("image") && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                <span>Image</span>
              </button>

              {/* Video (Toggleable) */}
              <button
                type="button"
                onClick={() => toggleInputType("video")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-sans cursor-pointer transition-colors select-none",
                  inputTypes.includes("video")
                    ? "border-foreground/30 bg-secondary/70 text-foreground"
                    : "border-border/60 bg-transparent text-muted-foreground hover:bg-secondary/30"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    inputTypes.includes("video")
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  )}
                >
                  {inputTypes.includes("video") && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                <span>Video</span>
              </button>
            </div>
          </div>

          {/* 5. Output types */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-muted-foreground">
              Output types
            </label>
            <div className="flex items-center gap-2">
              {/* Text (Locked) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/40 text-xs font-sans text-foreground opacity-90 cursor-not-allowed select-none">
                <div className="h-4 w-4 rounded bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
                <span>Text</span>
                <Lock className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive font-sans pt-1">
              {error}
            </p>
          )}

          <DialogFooter className="pt-4 border-t border-border/60 flex flex-row items-center justify-end gap-2.5 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg text-xs h-9 px-4 border-border bg-secondary/30 hover:bg-secondary text-foreground cursor-pointer shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="rounded-lg text-xs h-9 px-5 bg-foreground text-background hover:bg-foreground/90 font-medium cursor-pointer shadow-none"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
