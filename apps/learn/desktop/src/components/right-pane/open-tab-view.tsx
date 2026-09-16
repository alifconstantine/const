import React from "react";
import {
  Layers,
  FileText,
  Globe,
} from "lucide-react";
import type { RightPaneTabType } from "./types";
import { useI18n } from "../../lib/i18n";

interface OpenTabViewProps {
  onSelectTabType: (type: RightPaneTabType) => void;
}

interface TabOption {
  type: RightPaneTabType;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OpenTabView({ onSelectTabType }: OpenTabViewProps) {
  const { language } = useI18n();

  const tabOptions: TabOption[] = [
    {
      type: "review",
      title: language === "id" ? "Tinjau Perubahan" : "Review Changes",
      description:
        language === "id"
          ? "Lihat berkas yang dimodifikasi oleh AI"
          : "Inspect files modified by the AI",
      icon: Layers,
    },
    {
      type: "file_preview",
      title: language === "id" ? "Pratinjau Berkas" : "File Preview",
      description:
        language === "id"
          ? "Buka dan baca dokumen atau kode"
          : "View document or source code",
      icon: FileText,
    },
    {
      type: "browser",
      title: language === "id" ? "Peramban Web" : "Web Browser",
      description:
        language === "id"
          ? "Riset dan jelajahi referensi web"
          : "Research and browse web references",
      icon: Globe,
    },
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center px-6 py-8 select-none bg-background text-foreground">
      {/* Title & Subtitle */}
      <div className="text-center mb-6">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground mb-1 font-sans">
          {language === "id" ? "Buka Tab Baru" : "Open Tab"}
        </h2>
        <p className="text-xs text-muted-foreground font-normal">
          {language === "id"
            ? "Pilih jenis tab yang ingin dibuka di panel samping."
            : "Choose a tab type to open in the side panel."}
        </p>
      </div>

      {/* Grid of Tab Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[440px]">
        {tabOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onSelectTabType(opt.type)}
              className="group flex flex-col items-center justify-center h-[100px] p-3 rounded-xl bg-card hover:bg-secondary/70 border border-border hover:border-border/80 transition-all cursor-pointer active:scale-[0.98] shadow-xs text-center"
            >
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors mb-2 shrink-0" />
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
                {opt.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
