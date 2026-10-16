import React, { useState } from "react";
import { X } from "lucide-react";
import { CustomDropdown } from "./custom-dropdown";
import { useTranslation } from "../../lib/i18n";

export interface CustomRepeatConfig {
  frequency: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months";
  endsNever: boolean;
  endDate?: string;
}

export interface CustomRepeatModalProps {
  initialConfig?: CustomRepeatConfig;
  onConfirm: (config: CustomRepeatConfig) => void;
  onClose: () => void;
}

export function CustomRepeatModal({
  initialConfig,
  onConfirm,
  onClose,
}: CustomRepeatModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [frequency, setFrequency] = useState(initialConfig?.frequency ?? 1);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days" | "weeks" | "months">(
    initialConfig?.unit ?? "days"
  );
  const [endsNever, setEndsNever] = useState(initialConfig?.endsNever ?? true);
  const [endDate, setEndDate] = useState(
    initialConfig?.endDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );

  const unitOptions = [
    { value: "minutes", label: t("scheduledTasks.minutes") },
    { value: "hours", label: t("scheduledTasks.hours") },
    { value: "days", label: t("scheduledTasks.days") },
    { value: "weeks", label: t("scheduledTasks.weeks") },
    { value: "months", label: t("scheduledTasks.months") },
  ];

  const handleConfirm = () => {
    onConfirm({
      frequency: Math.max(1, frequency),
      unit,
      endsNever,
      endDate: endsNever ? undefined : endDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#222222] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#383838]">
          <h3 className="text-sm font-semibold text-white">{t("scheduledTasks.custom")}</h3>
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#969696] hover:text-white hover:bg-[#2b2b2b] transition-colors cursor-pointer"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex flex-col gap-4 text-xs">
          {/* Repetition frequency */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#969696]">{t("scheduledTasks.repetitionFrequency")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-20 bg-[#2b2b2b] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#5d5d5d]"
                min={1}
                max={365}
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value, 10) || 1)}
              />
              <CustomDropdown
                value={unit}
                options={unitOptions}
                onChange={(val) => setUnit(val as typeof unit)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Ends options */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#969696]">{t("scheduledTasks.ends")}</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-[#d4d4d4] cursor-pointer">
                <input
                  type="radio"
                  name="repeatEnds"
                  className="accent-[#0066ff]"
                  checked={endsNever}
                  onChange={() => setEndsNever(true)}
                />
                <span>{t("scheduledTasks.neverEnds")}</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[#d4d4d4] cursor-pointer">
                <input
                  type="radio"
                  name="repeatEnds"
                  className="accent-[#0066ff]"
                  checked={!endsNever}
                  onChange={() => setEndsNever(false)}
                />
                <span>{t("scheduledTasks.endsOnDate")}</span>
              </label>

              {!endsNever && (
                <div className="mt-1">
                  <input
                    type="date"
                    className="w-full bg-[#2b2b2b] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#5d5d5d]"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#383838] bg-[#1b1b1b]">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] transition-colors cursor-pointer"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#161616] bg-[#d4d4d4] hover:bg-white transition-colors cursor-pointer"
            onClick={handleConfirm}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
