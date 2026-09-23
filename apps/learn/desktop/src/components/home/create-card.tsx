import React from "react";
import { Plus } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface CreateCardProps {
  type: "learn" | "collection";
  onClick: () => void;
  className?: string;
  viewMode?: "grid" | "list";
}

export function CreateCard({ type, onClick, className = "", viewMode = "grid" }: CreateCardProps) {
  const { t } = useI18n();
  const label = type === "learn" ? t("createCardLearn") : t("createCardCollection");

  if (viewMode === "list") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-4 py-3 rounded-xl border border-dashed border-border/80 hover:border-foreground/40 bg-secondary/30 hover:bg-secondary/60 transition-all cursor-pointer flex items-center justify-center gap-2.5 group select-none shadow-none active:scale-[0.99] ${className}`}
      >
        <div className="h-6 w-6 rounded-lg bg-secondary/80 border border-border group-hover:bg-card group-hover:border-foreground/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all">
          <Plus className="h-3.5 w-3.5 stroke-[2.2]" />
        </div>
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[170px] w-full p-5 rounded-2xl border border-dashed border-border/80 hover:border-foreground/40 bg-secondary/30 hover:bg-secondary/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group select-none shadow-none active:scale-[0.99] ${className}`}
    >
      <div className="h-10 w-10 rounded-xl bg-secondary/80 border border-border group-hover:bg-card group-hover:border-foreground/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all mb-2.5 group-hover:scale-105 shadow-none">
        <Plus className="h-5 w-5 stroke-[2.2]" />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}
