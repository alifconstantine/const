import React, { useState, useEffect } from "react";
import { Bot, Sparkles, Cpu, Zap, Code2, Check, ExternalLink, ShieldCheck, ArrowRight } from "lucide-react";
import { toast, cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { BUILTIN_MODELS } from "../../settings/settings-view";

interface ModelsViewProps {
  onOpenSettings?: () => void;
}

export function ModelsView({ onOpenSettings }: ModelsViewProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [activeModel, setActiveModel] = useState<string>(() => {
    return (
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash"
    );
  });

  useEffect(() => {
    if (window.electron?.config?.get) {
      window.electron.config
        .get()
        .then((cfg: any) => {
          if (cfg?.activeModel) {
            setActiveModel(cfg.activeModel);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("const_learn_active_model", modelId);
    }
    if (window.electron?.config?.save) {
      window.electron.config.save({ activeModel: modelId }).catch(() => {});
    }
    toast.success(
      isIndo
        ? `Model aktif berhasil diubah ke ${modelId}`
        : `Active model changed to ${modelId}`
    );
  };

  const getModelIcon = (id: string) => {
    if (id.includes("3.8")) return Sparkles;
    if (id.includes("3.7")) return Cpu;
    if (id.includes("coding")) return Code2;
    if (id.includes("fast")) return Zap;
    return Bot;
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-start justify-between pb-6 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif text-2xl font-normal tracking-tight text-foreground">
                {isIndo ? "Katalog Model AI" : "AI Models Catalog"}
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                Const AI Engine
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {isIndo
                ? "Pilih model inferensi kecerdasan buatan untuk riset grounded, sintesis materi pembelajaran, serta pembuatan artefak kuis, peta pikiran, dan presentasi."
                : "Select the AI inference engine powering grounded research, study synthesis, and studio artifact generation."}
            </p>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer shadow-2xs"
            >
              <span>{t("settings")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Current Active Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-secondary/50 border border-border/80 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center font-bold">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {isIndo ? "Model Sedang Digunakan:" : "Currently Active Model:"}
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {activeModel}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {isIndo ? "Aktif" : "Active"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isIndo
                  ? "Semua percakapan dan studio generator akan otomatis menggunakan model ini."
                  : "All chat interactions and studio tools will use this model by default."}
              </p>
            </div>
          </div>
        </div>

        {/* Models Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {BUILTIN_MODELS.map((model) => {
            const isSelected = activeModel === model.id;
            const Icon = getModelIcon(model.id);

            return (
              <div
                key={model.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-2xs group relative overflow-hidden",
                  isSelected
                    ? "bg-card border-foreground/30 shadow-md ring-1 ring-foreground/20"
                    : "bg-card/70 border-border/80 hover:border-border hover:bg-card"
                )}
              >
                {/* Top Info */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl border flex items-center justify-center transition-colors shrink-0",
                          isSelected
                            ? "bg-foreground text-background border-foreground"
                            : "bg-secondary/80 border-border text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground tracking-tight">
                          {model.name}
                        </h3>
                        <span className="text-[10.5px] font-mono text-muted-foreground">
                          {model.id}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="px-2.5 py-1 rounded-full bg-foreground text-background text-[11px] font-semibold flex items-center gap-1 shrink-0">
                        <Check className="h-3 w-3" />
                        {isIndo ? "Dipilih" : "Selected"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className="px-3 py-1 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer active:scale-95 shrink-0"
                      >
                        {isIndo ? "Pilih" : "Select"}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mt-3">
                    {isIndo ? model.descId : model.descEn}
                  </p>
                </div>

                {/* Specs & Capabilities Badges */}
                <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[10px] border border-border/60">
                      {model.contextWindow}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[10px] border border-border/60">
                      {model.maxOutput}
                    </span>
                  </div>

                  {model.supportsThinking && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium text-[10px] border border-indigo-500/20">
                      {isIndo ? "Penalaran Dinamis" : "Reasoning"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
