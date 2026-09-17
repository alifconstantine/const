import React, { useState, useEffect } from "react";
import { X, Box, Check, Sparkles, Cpu, Zap, Code2 } from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";

export interface ModelOption {
  id: string;
  name: string;
  contextWindow: string;
  maxOutput: string;
  supportsThinking?: boolean;
  descEn: string;
  descId: string;
  icon?: React.ElementType;
}

export const LEARN_MODELS: ModelOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Advanced reasoning model for complex subject synthesis.",
    descId: "Model penalaran tingkat lanjut untuk sintesis materi kompleks.",
    icon: Sparkles,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Hybrid frontier model with dynamic reasoning depth.",
    descId: "Model frontier hybrid dengan kedalaman penalaran dinamis.",
    icon: Cpu,
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Fast multimodal reasoning model for exploration and study research.",
    descId: "Model reasoning multimodal cepat untuk eksplorasi dan riset materi belajar.",
    icon: Zap,
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Intelligent dynamic router balancing latency and accuracy.",
    descId: "Dynamic router cerdas yang menyeimbangkan latensi dan keakuratan jawaban.",
    icon: Box,
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    descEn: "Sub-second response speed for quick dialogues and rapid summaries.",
    descId: "Kecepatan respons sub-detik untuk dialog cepat dan ringkasan kilat.",
    icon: Zap,
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Specialized model for coding education, syntax, and debugging.",
    descId: "Model khusus untuk pembelajaran pemrograman, sintaks, dan debugging kode.",
    icon: Code2,
  },
];

interface ModelSelectionSheetProps {
  open: boolean;
  onClose: () => void;
  onModelSelected?: (modelId: string) => void;
}

export function ModelSelectionSheet({
  open,
  onClose,
  onModelSelected,
}: ModelSelectionSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [activeModel, setActiveModel] = useState<string>(() => {
    return (
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash"
    );
  });

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem("const_learn_active_model");
      if (stored) setActiveModel(stored);
    }
  }, [open]);

  const handleSelect = (modelId: string) => {
    setActiveModel(modelId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("const_learn_active_model", modelId);
    }
    onModelSelected?.(modelId);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
          open ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-card text-card-foreground border-t border-border rounded-t-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none transition-transform duration-300 ease-out safe-area-bottom",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Model AI Selection"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Box className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                {isIndo ? "Pilih Model AI" : "AI Models"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isIndo ? "Model aktif untuk riset dan materi studio" : "Active model for chat and studio generation"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {LEARN_MODELS.map((model) => {
            const isSelected = activeModel === model.id;
            const Icon = model.icon || Box;

            return (
              <button
                key={model.id}
                type="button"
                onClick={() => handleSelect(model.id)}
                className={cn(
                  "w-full text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 active:scale-[0.99]",
                  isSelected
                    ? "bg-secondary/70 border-foreground/30 shadow-xs ring-1 ring-foreground/20"
                    : "bg-secondary/30 border-border hover:bg-secondary/50"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5",
                    isSelected
                      ? "bg-foreground text-background border-foreground"
                      : "bg-secondary border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {model.name}
                    </span>
                    {isSelected ? (
                      <span className="px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-semibold flex items-center gap-1 shrink-0">
                        <Check className="h-3 w-3" />
                        {isIndo ? "Aktif" : "Active"}
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-mono text-muted-foreground shrink-0">
                        {model.contextWindow}
                      </span>
                    )}
                  </div>

                  <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                    {isIndo ? model.descId : model.descEn}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground border border-border/60">
                      {model.maxOutput}
                    </span>
                    {model.supportsThinking && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium border border-indigo-500/20">
                        {isIndo ? "Penalaran Dinamis" : "Reasoning"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{isIndo ? "Tersinkronisasi otomatis" : "Auto-saved locally"}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {isIndo ? "Selesai" : "Done"}
          </button>
        </div>
      </div>
    </>
  );
}
