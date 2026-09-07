import React, { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";

export interface TimePickerProps {
  value: string; // e.g. "09:00"
  onChange: (time: string) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hours, minutes] = (value || "09:00").split(":");
  const curHour = hours || "09";
  const curMinute = minutes || "00";

  const [inputVal, setInputVal] = useState(value || "09:00");

  useEffect(() => {
    setInputVal(value || "09:00");
  }, [value]);

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

  const handleHourSelect = (h: string) => {
    const formatted = `${h.padStart(2, "0")}:${curMinute}`;
    setInputVal(formatted);
    onChange(formatted);
  };

  const handleMinuteSelect = (m: string) => {
    const formatted = `${curHour}:${m.padStart(2, "0")}`;
    setInputVal(formatted);
    onChange(formatted);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
      onChange(val);
    }
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutesList = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Clock className="w-3.5 h-3.5 text-[#969696]" />
        <span>{value || "09:00"}</span>
        <ChevronDown
          className={`w-3 h-3 text-[#969696] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-2.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
          {/* Direct typing field */}
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[#383838]">
            <input
              type="text"
              className="w-16 bg-[#2b2b2b] border border-[#383838] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#5d5d5d] font-mono text-center"
              value={inputVal}
              onChange={handleDirectInput}
              maxLength={5}
              placeholder="09:00"
            />
            <span className="text-[11px] text-[#969696]">24h format</span>
          </div>

          {/* Symmetrical Dual Column Picker */}
          <div className="flex items-start gap-1">
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] font-medium text-[#969696] mb-1 text-center uppercase">Hour</div>
              <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                {hoursList.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`py-1 rounded text-xs text-center transition-colors cursor-pointer ${
                      h === curHour
                        ? "bg-[#0066ff] text-white font-medium"
                        : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                    }`}
                    onClick={() => handleHourSelect(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-[1px] h-36 bg-[#383838] mx-0.5" />

            <div className="flex-1 flex flex-col">
              <div className="text-[10px] font-medium text-[#969696] mb-1 text-center uppercase">Min</div>
              <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                {minutesList.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`py-1 rounded text-xs text-center transition-colors cursor-pointer ${
                      m === curMinute
                        ? "bg-[#0066ff] text-white font-medium"
                        : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                    }`}
                    onClick={() => handleMinuteSelect(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
