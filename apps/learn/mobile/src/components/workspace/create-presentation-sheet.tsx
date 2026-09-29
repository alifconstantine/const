import React, { useState, useMemo } from "react";
import {
  X,
  Presentation,
  Check,
  FileText,
  Sliders,
} from "lucide-react";
import { BrandLogo, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreatePresentationSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    provider: "native" | "canva" | "slides";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    customInstructions?: string;
  }) => void;
}

const getProviders = (isIndo: boolean) => [
  {
    id: "native" as const,
    name: "Const Native",
    tagline: isIndo
      ? "1920×1080 Canvas Deck & Cloud Sandbox PDF"
      : "1920×1080 Canvas Deck & Cloud Sandbox PDF",
    badge: isIndo ? "Direkomendasikan" : "Recommended",
    logoId: null,
  },
  {
    id: "canva" as const,
    name: "Canva MCP",
    tagline: isIndo
      ? "Template Canva & Desain Interaktif"
      : "Editable Canva Design & Live Templates",
    badge: "Canva AI",
    logoId: "canva",
  },
  {
    id: "slides" as const,
    name: "Google Slides",
    tagline: isIndo
      ? "Slide Cloud di Google Drive & PPTX"
      : "Interactive Presentation Embed & PPTX",
    badge: "Google Suite",
    logoId: "google-slides",
  },
];

export function CreatePresentationSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreatePresentationSheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";
  const providers = useMemo(() => getProviders(isIndo), [isIndo]);

  const [provider, setProvider] = useState<"native" | "canva" | "slides">("native");
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
      provider,
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
                {isIndo ? "Buat Slide Presentasi" : "Create Presentation Slides"}
              </h2>
              <p className="text-[11px] text-[#888888]">
                {selectedSourceIds.length === sources.length
                  ? isIndo
                    ? `Semua sumber (${sources.length} sumber)`
                    : `All sources (${sources.length})`
                  : isIndo
                  ? `${selectedSourceIds.length} dari ${sources.length} sumber dipilih`
                  : `${selectedSourceIds.length} of ${sources.length} sources selected`}
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
                {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
              </label>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? (isIndo ? "Batal Semua" : "Deselect All")
                  : (isIndo ? "Pilih Semua" : "Select All")}
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-[#888888] italic p-3 rounded-xl bg-[#222222] border border-[#2b2b2b]">
                {isIndo
                  ? "Belum ada sumber. Tambahkan sumber terlebih dahulu."
                  : "No sources found. Add sources first."}
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

          {/* Section 2: Presentation Engine (Native, Canva, Google Slides) */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Pilih Engine Presentasi" : "Presentation Engine"}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {providers.map((p) => {
                const isSelected = provider === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      "p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all",
                      isSelected
                        ? "bg-[#252525] border-white/40 shadow-sm text-white"
                        : "bg-[#181818] border-[#262626] hover:bg-[#1e1e1e] text-[#888888]"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-[#2c2c2c]" : "bg-[#202020]"
                      )}
                    >
                      {p.logoId ? (
                        <BrandLogo id={p.logoId} size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                      ) : (
                        <Presentation className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">
                          {p.name}
                        </span>
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10 text-[#888888]">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#888888] truncate mt-0.5">
                        {p.tagline}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-white bg-white text-black"
                          : "border-[#444449] bg-transparent"
                      )}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Slide Count / Length Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {isIndo ? "Jumlah Slide & Kedalaman" : "Slide Count & Depth"}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCount(!isCustomCount)}
                className="text-[11px] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sliders className="h-3 w-3" />
                {isCustomCount
                  ? isIndo
                    ? "Mode Preset"
                    : "Preset Mode"
                  : isIndo
                  ? "Atur Jumlah Angka"
                  : "Custom Count"}
              </button>
            </div>

            {!isCustomCount ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "auto" as const, label: isIndo ? "Otomatis" : "Auto", desc: isIndo ? "Adaptif" : "Adaptive" },
                  { id: "short" as const, label: isIndo ? "Singkat" : "Short", desc: isIndo ? "3-5 Slide" : "3-5 Slides" },
                  { id: "long" as const, label: isIndo ? "Panjang" : "Long", desc: isIndo ? "8-12 Slide" : "8-12 Slides" },
                ].map((m) => {
                  const isSelected = lengthMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLengthMode(m.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#252525] border-white/40 text-white shadow"
                          : "bg-[#1f1f1f] border-[#2c2c2c] text-[#888888] hover:border-[#383838]"
                      )}
                    >
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[9px] text-[#888888] mt-0.5">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-center justify-between gap-3">
                <span className="text-xs text-[#888888]">
                  {isIndo ? "Jumlah target slide:" : "Target slide count:"}
                </span>
                <input
                  type="number"
                  min={3}
                  max={25}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(3, Math.min(25, Number(e.target.value) || 10)))}
                  className="w-16 px-2 py-1 rounded-lg bg-[#141414] border border-[#333333] text-white text-xs text-center font-sans tabular-nums font-bold focus:outline-none focus:border-white/50"
                />
              </div>
            )}
          </div>

          {/* Section 4: Custom Prompt / Guidance */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Instruksi Khusus (Opsional)" : "Custom Guidance (Optional)"}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Tekankan pada aspek arsitektur teknis, gunakan palet warna biru korporat..."
                  : "E.g., Emphasize architectural trade-offs, use clean blue color palette..."
              }
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder:text-[#666666] focus:outline-none focus:border-[#444444] resize-none font-sans"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 pb-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <Presentation className="h-4 w-4" />
              <span>{isIndo ? "Buat Presentation Slides" : "Create Presentation Slides"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
