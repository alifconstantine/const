import React from "react";
import { Plus } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface CreateCardProps {
  type: "learn" | "collection";
  onClick: () => void;
  className?: string;
}

export function CreateCard({ type, onClick, className = "" }: CreateCardProps) {
  const { t } = useI18n();
  const label = type === "learn" ? t("createCardLearn") : t("createCardCollection");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[170px] w-full p-5 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b0] dark:hover:border-[#555555] bg-white/40 dark:bg-[#222222]/40 hover:bg-white dark:hover:bg-[#222222] transition-all cursor-pointer flex flex-col items-center justify-center text-center group select-none shadow-none ${className}`}
    >
      <div className="h-10 w-10 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] group-hover:bg-[#dedee2] dark:group-hover:bg-[#383838] flex items-center justify-center text-[#737373] dark:text-[#969696] group-hover:text-[#262626] dark:group-hover:text-white transition-all mb-2.5 group-hover:scale-105 shadow-none">
        <Plus className="h-5 w-5 stroke-[2.2]" />
      </div>
      <span className="text-xs font-medium text-[#737373] dark:text-[#969696] group-hover:text-[#262626] dark:group-hover:text-white transition-colors">
        {label}
      </span>
    </button>
  );
}
