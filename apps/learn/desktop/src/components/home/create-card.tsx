import React from "react";
import { Plus } from "lucide-react";

interface CreateCardProps {
  type: "learn" | "collection";
  onClick: () => void;
  className?: string;
}

export function CreateCard({ type, onClick, className = "" }: CreateCardProps) {
  const label = type === "learn" ? "Buat notebook baru" : "Buat koleksi baru";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[170px] w-full p-5 rounded-2xl border border-dashed border-border/70 hover:border-foreground/40 bg-card/40 hover:bg-card/90 transition-all cursor-pointer flex flex-col items-center justify-center text-center group select-none ${className}`}
    >
      <div className="h-11 w-11 rounded-full bg-secondary/80 group-hover:bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all mb-3 group-hover:scale-105 shadow-xs">
        <Plus className="h-5 w-5 stroke-[2.2]" />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}
