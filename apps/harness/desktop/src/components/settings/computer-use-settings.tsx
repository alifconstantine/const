import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Switch, toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { settingsPanel } from "./settings-controls";

type ToggleKey = "enableComputerUse" | "enableBrowserUse";
type AutomationConfig = Record<ToggleKey, boolean>;

const COMPUTER_TOOLS = [
  ["computer_list_apps", "computerToolListApps"],
  ["computer_list_windows", "computerToolListWindows"],
  ["computer_get_app_state", "computerToolAppState"],
  ["computer_click", "computerToolClick"],
  ["computer_set_value", "computerToolSetValue"],
  ["computer_type_text", "computerToolTypeText"],
  ["computer_press_key", "computerToolPressKey"],
  ["computer_hotkey", "computerToolHotkey"],
  ["computer_paste_text", "computerToolPasteText"],
  ["computer_scroll", "computerToolScroll"],
  ["computer_drag", "computerToolDrag"],
] as const;

export function ComputerUseSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState<Set<ToggleKey>>(new Set());
  const savingRef = useRef(new Set<ToggleKey>());
  const mountedRef = useRef(false);
  const canConfigure = Boolean(
    window.electron?.getConfig && window.electron?.saveConfig,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    const getConfig = window.electron?.getConfig;
    if (!getConfig) {
      setLoading(false);
      return;
    }
    getConfig()
      .then((value) => {
        if (!cancelled)
          setConfig({
            enableComputerUse: value.enableComputerUse ?? true,
            enableBrowserUse: value.enableBrowserUse ?? true,
          });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleToggle = useCallback(
    async (key: ToggleKey, checked: boolean) => {
      const saveConfig = window.electron?.saveConfig;
      if (!config || !saveConfig || savingRef.current.has(key)) return;
      const previous = config[key];
      savingRef.current.add(key);
      setSaving(new Set(savingRef.current));
      setConfig((value) => (value ? { ...value, [key]: checked } : value));
      try {
        await saveConfig({ [key]: checked });
        if (mountedRef.current)
          toast.success(t("settings.computerSettingsSaved"));
      } catch {
        if (mountedRef.current) {
          setConfig((value) => (value ? { ...value, [key]: previous } : value));
          toast.error(t("settings.computerSettingsSaveFailed"));
        }
      } finally {
        savingRef.current.delete(key);
        if (mountedRef.current) setSaving(new Set(savingRef.current));
      }
    },
    [config, t],
  );

  return (
    <div className="flex flex-col gap-4 w-full min-w-0 pb-6">
      <div className={settingsPanel} aria-busy={loading}>
        {(
          [
            [
              "enableComputerUse",
              "computerUseMasterTitle",
              "computerUseMasterDesc",
            ],
            [
              "enableBrowserUse",
              "browserUseMasterTitle",
              "browserUseMasterDesc",
            ],
          ] as const
        ).map(([key, title, description]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-5 py-3"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <label
                htmlFor={`setting-${key}`}
                className="text-[13px] font-normal text-[#262626] dark:text-white cursor-pointer"
              >
                {t(`settings.${title}`)}
              </label>
              <p
                id={`description-${key}`}
                className="text-xs leading-snug text-[#737373] dark:text-[#969696]"
              >
                {t(`settings.${description}`)}
              </p>
            </div>
            <Switch
              id={`setting-${key}`}
              checked={config?.[key] ?? false}
              onCheckedChange={(checked) => void handleToggle(key, checked)}
              disabled={loading || !config || !canConfigure || saving.has(key)}
              aria-describedby={`description-${key}`}
              className="shrink-0"
            />
          </div>
        ))}
        {(loading || loadFailed || !canConfigure) && (
          <div
            className="flex flex-wrap items-center gap-3 text-xs text-[#737373] dark:text-[#969696]"
            role="status"
          >
            <span>
              {t(
                loading
                  ? "common.loading"
                  : loadFailed
                    ? "settings.computerSettingsLoadFailed"
                    : "settings.computerSettingsDesktopOnly",
              )}
            </span>
            {loadFailed && (
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                className="text-[#262626] dark:text-white underline underline-offset-4"
              >
                {t("common.retry")}
              </button>
            )}
          </div>
        )}
      </div>

      <details className={`${settingsPanel} group py-3`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-[#262626] dark:text-white [&::-webkit-details-marker]:hidden">
          {t("settings.computerAvailableTools")}
          <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-5 flex flex-col gap-4">
          {COMPUTER_TOOLS.map(([name, description]) => (
            <div
              key={name}
              className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <code className="text-[13px] text-[#262626] dark:text-white break-all">
                {name}
              </code>
              <span className="text-[13px] text-[#737373] dark:text-[#969696] sm:text-right">
                {t(`settings.${description}`)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
