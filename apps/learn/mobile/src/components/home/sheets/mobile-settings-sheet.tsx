import React from "react";
import { X, Settings, Sun, Moon, Laptop, Globe, Check } from "lucide-react";
import { useTheme, cn } from "@const/ui";
import { useI18n, LANGUAGE_OPTIONS } from "../../../lib/i18n";

interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSettingsSheet({ open, onClose }: MobileSettingsSheetProps) {
  const { t, language, setLanguage } = useI18n();
  const [theme, setTheme] = useTheme();
  const isIndo = language === "id";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
          open ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-card text-card-foreground border-t border-border rounded-t-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none transition-transform duration-300 ease-out safe-area-bottom",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Settings className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                {t("settings")}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isIndo ? "Preferensi tampilan dan bahasa" : "Display and language preferences"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Theme setting */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              {t("theme")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "system", label: t("themeSystem"), icon: Laptop },
                { value: "light", label: t("themeLight"), icon: Sun },
                { value: "dark", label: t("themeDark"), icon: Moon },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = theme === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value as any)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer text-xs font-medium",
                      isSelected
                        ? "bg-secondary text-foreground border-foreground/30 shadow-xs font-semibold"
                        : "bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language setting */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              <span>{t("language")}</span>
            </label>
            <div className="space-y-1.5">
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = language === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLanguage(opt.code)}
                    className={cn(
                      "w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-xs",
                      isSelected
                        ? "bg-secondary text-foreground border-foreground/30 shadow-xs font-semibold"
                        : "bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-foreground" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Const Learn Mobile v0.0.1</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {isIndo ? "Selesai" : "Done"}
          </button>
        </div>
      </div>
    </>
  );
}
