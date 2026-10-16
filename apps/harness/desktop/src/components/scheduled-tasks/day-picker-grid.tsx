import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "../../lib/i18n";

export interface DayPickerGridProps {
  value: number; // 1 to 31
  onChange: (day: number) => void;
}

export function DayPickerGrid({ value, onChange }: DayPickerGridProps): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{t("common.day")} {value}</span>
        <ChevronDown
          className={`w-3 h-3 text-[#969696] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-56 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-2.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[11px] font-medium text-[#969696] mb-2 text-center uppercase tracking-wider">
            {t("scheduledTasks.selectDayOfMonth")}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                className={`h-6 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                  d === value
                    ? "bg-[#0066ff] text-white font-medium"
                    : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                }`}
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
