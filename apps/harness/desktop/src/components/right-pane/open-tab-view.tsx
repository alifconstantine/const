import {
  MessageSquare,
  FileText,
  SquareTerminal,
  Globe,
  Layers,
} from "lucide-react";
import type { RightPaneTabType } from "./types";

interface OpenTabViewProps {
  onSelectTabType: (type: RightPaneTabType) => void;
}

interface TabOption {
  type: RightPaneTabType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_OPTIONS: TabOption[] = [
  {
    type: "review",
    title: "Review changes",
    icon: Layers,
  },
  {
    type: "terminal",
    title: "Terminal",
    icon: SquareTerminal,
  },
  {
    type: "side_conversation",
    title: "Side chat",
    icon: MessageSquare,
  },
  {
    type: "browser",
    title: "Browser",
    icon: Globe,
  },
];

export function OpenTabView({ onSelectTabType }: OpenTabViewProps) {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center px-6 py-8 select-none bg-[#141414] text-white">
      {/* Title & Subtitle matching Image 2 */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-[#ededed] mb-1.5 font-sans">
          Open tab
        </h2>
        <p className="text-xs text-[#808080] font-normal">
          Choose a tab to open in the side pane.
        </p>
      </div>

      {/* Grid of 4 tab options matching Image 2 (3 columns on top row, 1 on second row) */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[420px]">
        {TAB_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onSelectTabType(opt.type)}
              className="group flex flex-col items-center justify-center h-[96px] p-3 rounded-xl bg-[#212121] hover:bg-[#2b2b2b] border border-[#2f2f2f]/60 hover:border-[#424242] transition-all cursor-pointer active:scale-[0.98] shadow-sm text-center"
            >
              <Icon className="w-5 h-5 text-[#8e8e8e] group-hover:text-white transition-colors mb-2" />
              <span className="text-xs font-medium text-[#d4d4d4] group-hover:text-white transition-colors leading-tight">
                {opt.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
