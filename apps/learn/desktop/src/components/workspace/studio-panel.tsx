import React from "react";
import {
  PanelRightClose,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  FileText,
  HelpCircle,
  Award,
  BarChart3,
  Table2,
  ChevronRight,
  Plus,
  PenTool,
} from "lucide-react";

interface StudioTool {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
}

const STUDIO_TOOLS: StudioTool[] = [
  { id: "audio_summary", name: "Ringkasan Audio", icon: AudioLines, iconColor: "text-indigo-400" },
  { id: "slides", name: "Slide Presentasi", icon: Presentation, iconColor: "text-amber-400" },
  { id: "video_summary", name: "Ringkasan Video", icon: Video, iconColor: "text-emerald-400" },
  { id: "mind_map", name: "Peta Pikiran", icon: GitFork, iconColor: "text-purple-400" },
  { id: "report", name: "Laporan", icon: FileText, iconColor: "text-blue-400" },
  { id: "flashcards", name: "Kartu tanya...", icon: HelpCircle, iconColor: "text-orange-400" },
  { id: "quiz", name: "Kuis", icon: Award, iconColor: "text-green-400" },
  { id: "infographic", name: "Infografis", icon: BarChart3, iconColor: "text-pink-400" },
  { id: "data_table", name: "Tabel Data", icon: Table2, iconColor: "text-cyan-400" },
];

interface StudioPanelProps {
  onSelectTool?: (toolId: string) => void;
  onAddNote?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export function StudioPanel({
  onSelectTool,
  onAddNote,
  onToggleCollapse,
  isCollapsed = false,
}: StudioPanelProps) {
  if (isCollapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-4 bg-[#141416] text-muted-foreground">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
          title="Buka Panel Studio"
        >
          <PanelRightClose className="h-4 w-4 rotate-180" />
        </button>
        <div className="mt-6 [writing-mode:vertical-lr] text-xs font-medium tracking-wider text-muted-foreground/80">
          STUDIO
        </div>
      </div>
    );
  }

  return (
    <aside className="w-[340px] xl:w-[360px] h-full flex flex-col bg-[#141416] text-foreground p-4 shrink-0 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-medium text-foreground">Studio</span>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-7 w-7 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Sembunyikan Panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3x3 Grid of Studio Tools */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {STUDIO_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool?.(tool.id)}
              className="p-2.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] border border-white/5 transition-all flex flex-col justify-between h-20 text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`h-4 w-4 ${tool.iconColor}`} />
                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[11px] font-normal text-foreground leading-tight line-clamp-2">
                {tool.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty State Studio Output (Zero Dummy Data) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 min-h-[180px]">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground/60 mb-3">
          <PenTool className="h-5 w-5 stroke-[1.5]" />
        </div>
        <h3 className="text-xs font-medium text-foreground mb-1">
          Output studio akan disimpan di sini.
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[260px]">
          Setelah menambahkan sumber, klik untuk menambahkan Ringkasan Audio, Panduan Belajar, Peta Pikiran, dan banyak lagi.
        </p>
      </div>

      {/* "+ Tambahkan catatan" Button */}
      <div className="pt-3 flex justify-center">
        <button
          type="button"
          onClick={onAddNote}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white hover:bg-white/90 text-black text-xs font-medium transition-all shadow-md active:scale-98 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Tambahkan catatan</span>
        </button>
      </div>
    </aside>
  );
}
