import {
  MessageSquare,
  SquareTerminal,
  Globe,
  Layers,
} from "lucide-react";
import type { RightPaneTabType } from "./types";
import { useTranslation } from "../../lib/i18n";

interface OpenTabViewProps {
  onSelectTabType: (type: RightPaneTabType) => void;
}

export function OpenTabView({ onSelectTabType }: OpenTabViewProps) {
  const { t } = useTranslation();

  const tabOptions = [
    {
      type: "review" as RightPaneTabType,
      title: t("rightPane.reviewChangesDesc"),
      icon: Layers,
    },
    {
      type: "terminal" as RightPaneTabType,
      title: t("rightPane.terminal"),
      icon: SquareTerminal,
    },
    {
      type: "side_conversation" as RightPaneTabType,
      title: t("rightPane.sideChat"),
      icon: MessageSquare,
    },
    {
      type: "browser" as RightPaneTabType,
      title: t("rightPane.browser"),
      icon: Globe,
    },
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center px-6 py-8 select-none bg-[#141414] text-white">
      {/* Title & Subtitle matching Image 2 */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-[#ededed] mb-1.5 font-sans">
          {t("rightPane.openTab")}
        </h2>
        <p className="text-xs text-[#808080] font-normal">
          {t("rightPane.chooseTabDesc")}
        </p>
      </div>

      {/* Grid of 4 tab options matching Image 2 (3 columns on top row, 1 on second row) */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[420px]">
        {tabOptions.map((opt) => {
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
