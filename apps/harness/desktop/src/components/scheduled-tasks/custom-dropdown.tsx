import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export function CustomDropdown({
  value,
  options,
  onChange,
  icon,
  placeholder = "Select...",
  className,
}: CustomDropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

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

  return (
    <div ref={containerRef} className={`relative inline-block ${className || ""}`}>
      <button
        type="button"
        className="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          {icon || selectedOption?.icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#969696] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[150px] max-h-56 overflow-y-auto bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 text-left select-none animate-in fade-in zoom-in-95 duration-100">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs rounded-lg transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#2b2b2b] text-white font-medium"
                    : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  {option.icon}
                  <span>{option.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
