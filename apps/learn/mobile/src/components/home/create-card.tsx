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
      className={`w-full px-4 py-3.5 rounded-2xl border border-dashed border-border/80 hover:border-border bg-card hover:bg-secondary/50 active:bg-secondary/70 active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 group select-none shadow-2xs ${className}`}
    >
      <div className="h-7 w-7 rounded-lg bg-secondary/80 group-hover:bg-secondary border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all">
        <Plus className="h-4 w-4 stroke-[2.2]" />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}
