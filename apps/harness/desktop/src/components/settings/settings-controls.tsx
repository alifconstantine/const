import { useId, type ReactNode } from "react";
import {
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@const/ui";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "../../lib/i18n";

export const settingsButton =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[8px] bg-neutral-200/60 px-2.5 text-xs font-normal text-neutral-800 transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-40 dark:bg-[#2b2b2b] dark:text-[#d4d4d4] dark:hover:bg-[#383838]";
export const settingsPrimaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[8px] bg-neutral-900 px-3 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
export const settingsInput =
  "w-full rounded-[8px] border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none dark:border-[#383838] dark:bg-[#2b2b2b] dark:text-white dark:placeholder:text-[#969696] dark:focus:border-[#969696]";

export const settingsPanel =
  "settings-panel rounded-2xl border border-neutral-200/80 bg-neutral-50 px-4 py-1 dark:border-[#383838]/70 dark:bg-[#222222]";

export function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className="space-y-2">
      {title && (
        <h2
          id={id}
          className="text-[13px] font-normal text-neutral-900 dark:text-[#d4d4d4]"
        >
          {title}
        </h2>
      )}
      <div className={settingsPanel}>{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row flex min-h-12 flex-wrap items-center justify-between gap-x-5 gap-y-2 py-2">
      <div className="min-w-0 flex-1 basis-40">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-normal text-neutral-900 dark:text-white"
        >
          {label}
        </label>
        {hint && (
          <p className="mt-1 max-w-sm text-xs leading-snug text-neutral-500 dark:text-[#969696]">
            {hint}
          </p>
        )}
      </div>
      <div className="max-w-full shrink-0">{children}</div>
    </div>
  );
}

export function SettingsChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange(value: T): void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[8px] px-2.5 text-xs transition-colors",
            value === option.value
              ? "bg-neutral-200/70 font-medium text-neutral-900 dark:bg-[#383838] dark:text-white"
              : "text-neutral-500 hover:text-neutral-900 dark:text-[#969696] dark:hover:text-white",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange(value: string): void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="min-h-8 h-auto w-auto max-w-60 gap-2 rounded-[8px] border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-none dark:border-[#383838] dark:bg-[#2b2b2b]"
      >
        <SelectValue>
          {options.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-xl bg-white dark:bg-[#222222]">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="rounded-[8px] py-1.5 text-xs"
          >
            <span>{option.label}</span>
            {option.hint && (
              <span className="mt-1 block max-w-64 text-xs leading-relaxed text-neutral-500 dark:text-[#969696]">
                {option.hint}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SettingsStepper({
  label,
  value,
  min,
  max,
  defaultValue,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={label} className="flex items-center gap-1">
        <button
          type="button"
          className={`${settingsButton} px-2`}
          aria-label={t("settings.decreaseValue", { label })}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="size-3.5" />
        </button>
        <output className="min-w-12 text-center text-xs tabular-nums text-neutral-900 dark:text-white">
          {value}
          {unit}
        </output>
        <button
          type="button"
          className={`${settingsButton} px-2`}
          aria-label={t("settings.increaseValue", { label })}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        className={`${settingsButton} px-2`}
        disabled={value === defaultValue}
        title={t("common.reset")}
        aria-label={t("settings.resetValue", { label })}
        onClick={() => onChange(defaultValue)}
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
