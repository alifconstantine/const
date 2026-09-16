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
      className={`min-h-[170px] w-full p-5 rounded-2xl border border-dashed border-border hover:border-foreground/30 bg-card/60 hover:bg-secondary/50 transition-all cursor-pointer flex flex-col items-center justify-center text-center group select-none shadow-none ${className}`}
    >
      <div className="h-10 w-10 rounded-xl bg-secondary border border-border group-hover:bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all mb-2.5 group-hover:scale-105 shadow-none">
        <Plus className="h-5 w-5 stroke-[2.2]" />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}
