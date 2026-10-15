import React, { useState } from "react";
import {
  X,
  Presentation,
  Check,
  FileText,
  Sliders,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreatePresentationSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    provider: "native";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    customInstructions?: string;
  }) => void;
}

export function CreatePresentationSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreatePresentationSheetProps) {
  const { t } = useI18n();

  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [customCount, setCustomCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  React.useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, sources]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleToggleAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds,
      provider: "native",
      lengthMode,
      slideCount: isCustomCount ? Number(customCount) || 10 : undefined,
      customInstructions: customInstructions.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[92vh] flex flex-col rounded-t-3xl bg-[#161616] text-[#e0e0e0] border-t border-[#262626] shadow-2xl animate-in slide-in-from-bottom duration-300 select-none pb-safe"
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#242424] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Presentation className="h-4 w-4 text-white shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                {t("createPresentationTitle")}
              </h2>
              <p className="text-[11px] text-[#888888]">
                {selectedSourceIds.length === sources.length
                  ? t("allSourcesCount", { count: sources.length })
                  : t("selectedOfTotalSources", {
                      selected: selectedSourceIds.length,
                      total: sources.length,
                    })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Section 1: Source Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {t("sourceMaterialScope")}
              </label>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-[#888888] italic p-3 rounded-xl bg-[#222222] border border-[#2b2b2b]">
                {t("noSourcesInNotebookDesc")}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-xl bg-[#222222] p-1.5 border border-[#2b2b2b]">
                {sources.map((s) => {
                  const isChecked = selectedSourceIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSource(s.id)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                        isChecked
                          ? "bg-[#2c2c2c] text-white font-medium"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                        <span className="truncate text-xs">{s.title}</span>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                          isChecked
                            ? "bg-white border-white text-black"
                            : "border-[#444449] bg-transparent"
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Slide Count / Length Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999] font-sans">
                {t("slideCountAndDepth")}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCount(!isCustomCount)}
                className="text-[11px] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-sans"
              >
                <Sliders className="h-3 w-3" />
                {isCustomCount ? t("presetMode") : t("customCount")}
              </button>
            </div>

            {!isCustomCount ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "auto" as const,
                    label: t("modeAdaptiveLabel"),
                    desc: t("modeAdaptiveDesc"),
                  },
                  {
                    id: "short" as const,
                    label: t("modeConciseLabel"),
                    desc: t("modeConciseDesc"),
                  },
                  {
                    id: "long" as const,
                    label: t("modeInDepthLabel"),
                    desc: t("modeInDepthDesc"),
                  },
                ].map((mode) => {
                  const isSelected = lengthMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setLengthMode(mode.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-sans",
                        isSelected
                          ? "bg-[#252525] border-white/40 text-white shadow"
                          : "bg-[#1f1f1f] border-[#2c2c2c] text-[#888888]"
                      )}
                    >
                      <div className="text-xs font-semibold">{mode.label}</div>
                      <div className="text-[10px] text-[#777777] mt-0.5 line-clamp-1">
                        {mode.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {[5, 8, 10, 12, 15].map((count) => {
                  const isSelected = customCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCustomCount(count)}
                      className={cn(
                        "flex-1 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer font-sans",
                        isSelected
                          ? "bg-[#252525] border-white text-white font-semibold shadow"
                          : "bg-[#1f1f1f] border-[#2c2c2c] text-[#999999]"
                      )}
                    >
                      {t("slidesCount", { count })}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Custom Guidance (Optional) */}
          <div className="space-y-1.5 pb-2">
            <label className="text-[11.5px] font-medium text-[#999999] font-sans">
              {t("customGuidanceOptional")}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t("presentationGuidancePlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder:text-[#666666] outline-none resize-none transition-colors font-sans"
            />
          </div>

          {/* Sticky Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-xs font-medium text-[#aaaaaa] hover:text-white transition-colors cursor-pointer font-sans"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98 font-sans"
            >
              <Presentation className="h-3.5 w-3.5" />
              <span>{t("createSlides")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
