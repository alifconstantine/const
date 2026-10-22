import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "../../lib/i18n";
import {
  toast,
  cn,
  Switch,
} from "@const/ui";
import {
  Monitor,
  Globe,
  RotateCw,
  ShieldCheck,
  Laptop,
  CheckCircle2,
  XCircle,
  Layers,
  Terminal,
  MousePointer,
  Sparkles,
} from "lucide-react";
import type { UserConfig } from "../../vite-env";

interface CapabilitiesData {
  platform: string;
  supported?: boolean;
  provider?: string;
  engine?: string;
  tools?: string[];
  capabilities?: string[];
}

interface RunningAppItem {
  name: string;
  pid?: number;
  bundleId?: string;
  title?: string;
}

const COMPUTER_TOOL_LIST = [
  { name: "computer_list_apps", description: "Enumerate visible & running desktop applications" },
  { name: "computer_list_windows", description: "List windows for a specific target application" },
  { name: "computer_get_app_state", description: "Inspect accessibility tree & screenshot window" },
  { name: "computer_click", description: "Click UI elements by tree index or coordinate" },
  { name: "computer_set_value", description: "Directly set text value into input fields" },
  { name: "computer_type_text", description: "Simulate keystroke typing into focused element" },
  { name: "computer_press_key", description: "Press individual special keys (Enter, Esc, Tab)" },
  { name: "computer_hotkey", description: "Trigger keyboard shortcuts (CmdOrCtrl+S, Alt+F4)" },
  { name: "computer_paste_text", description: "Paste text via system clipboard" },
  { name: "computer_scroll", description: "Scroll content containers in any direction" },
  { name: "computer_drag", description: "Drag and drop between elements or coordinates" },
];

export function ComputerUseSettings() {
  const { t } = useTranslation();

  // Config toggles
  const [enableComputerUse, setEnableComputerUse] = useState<boolean>(true);
  const [enableBrowserUse, setEnableBrowserUse] = useState<boolean>(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);

  // Runtime info
  const [capabilities, setCapabilities] = useState<CapabilitiesData | null>(null);
  const [apps, setApps] = useState<RunningAppItem[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState<boolean>(false);

  // Load configuration
  useEffect(() => {
    let isMounted = true;
    if (window.electron?.getConfig) {
      window.electron
        .getConfig()
        .then((cfg: UserConfig) => {
          if (!isMounted) return;
          setEnableComputerUse(cfg.enableComputerUse ?? true);
          setEnableBrowserUse(cfg.enableBrowserUse ?? true);
          setIsLoadingConfig(false);
        })
        .catch(() => {
          if (isMounted) setIsLoadingConfig(false);
        });
    } else {
      setIsLoadingConfig(false);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch capabilities
  const fetchCapabilities = useCallback(async () => {
    if (window.electron?.computer?.getCapabilities) {
      try {
        const caps = await window.electron.computer.getCapabilities();
        if (caps && !(caps as any).error) {
          setCapabilities(caps);
        }
      } catch (err) {
        console.error("Failed to load computer capabilities:", err);
      }
    }
  }, []);

  // Fetch running applications
  const fetchRunningApps = useCallback(async () => {
    if (!window.electron?.computer?.listApps) return;
    setIsLoadingApps(true);
    try {
      const list = await window.electron.computer.listApps();
      setApps(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn("Failed to load running desktop apps:", err);
      setApps([]);
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    fetchCapabilities();
    fetchRunningApps();
  }, [fetchCapabilities, fetchRunningApps]);

  // Toggle handlers
  const handleToggleComputerUse = async (checked: boolean) => {
    setEnableComputerUse(checked);
    if (window.electron?.saveConfig) {
      try {
        await window.electron.saveConfig({ enableComputerUse: checked });
        toast.success(checked ? "Computer Use enabled" : "Computer Use disabled");
      } catch {
        toast.error("Failed to update Computer Use setting");
        setEnableComputerUse(!checked);
      }
    }
  };

  const handleToggleBrowserUse = async (checked: boolean) => {
    setEnableBrowserUse(checked);
    if (window.electron?.saveConfig) {
      try {
        await window.electron.saveConfig({ enableBrowserUse: checked });
        toast.success(checked ? "Browser Use enabled" : "Browser Use disabled");
      } catch {
        toast.error("Failed to update Browser Use setting");
        setEnableBrowserUse(!checked);
      }
    }
  };

  const platformName = capabilities?.platform || (typeof window !== "undefined" && window.electron?.platform) || "windows";
  const formattedPlatform =
    platformName === "win32" || platformName === "windows"
      ? "Windows (Win32 / UI Automation)"
      : platformName === "darwin"
        ? "macOS (Apple Accessibility AXUIElement)"
        : "Linux (AT-SPI2 / X11 / Wayland)";

  return (
    <div className="flex flex-col gap-6 max-w-2xl pb-10">
      {/* ------------------------------------------------------------- */}
      {/* 1. Master Toggle: Computer Use                                */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3.5 pr-2">
          <div className="w-10 h-10 rounded-xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center shrink-0 text-[#262626] dark:text-white mt-0.5">
            <Monitor className="w-5 h-5 text-[#262626] dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-[#262626] dark:text-white tracking-tight">
              {t("settings.computerUseMasterTitle")}
            </span>
            <p className="text-[12px] leading-relaxed text-[#737373] dark:text-[#969696] max-w-xl">
              {t("settings.computerUseMasterDesc")}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <Switch
            checked={enableComputerUse}
            onCheckedChange={handleToggleComputerUse}
            disabled={isLoadingConfig}
            className="data-[state=checked]:bg-[#262626] dark:data-[state=checked]:bg-white"
            aria-label="Toggle Computer Use"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Master Toggle: Browser Use                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3.5 pr-2">
          <div className="w-10 h-10 rounded-xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center shrink-0 text-[#262626] dark:text-white mt-0.5">
            <Globe className="w-5 h-5 text-[#262626] dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-[#262626] dark:text-white tracking-tight">
              {t("settings.browserUseMasterTitle")}
            </span>
            <p className="text-[12px] leading-relaxed text-[#737373] dark:text-[#969696] max-w-xl">
              {t("settings.browserUseMasterDesc")}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <Switch
            checked={enableBrowserUse}
            onCheckedChange={handleToggleBrowserUse}
            disabled={isLoadingConfig}
            className="data-[state=checked]:bg-[#262626] dark:data-[state=checked]:bg-white"
            aria-label="Toggle Browser Use"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Native Runtime System Status Card                          */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#dedee2] dark:border-[#383838]">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
            <span className="text-xs font-semibold text-[#262626] dark:text-white tracking-tight uppercase">
              {t("settings.computerSystemStatus")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchCapabilities();
              fetchRunningApps();
            }}
            className="p-1 rounded-md text-[#737373] hover:text-[#262626] dark:text-[#969696] dark:hover:text-white hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer outline-none"
            title={t("common.refresh")}
          >
            <RotateCw className={cn("w-3.5 h-3.5", isLoadingApps && "animate-spin")} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Platform */}
          <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#f9f9fb] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2f2f2f]">
            <span className="text-[11px] text-[#737373] dark:text-[#888888]">
              {t("settings.computerPlatformLabel")}
            </span>
            <span className="font-medium text-[#262626] dark:text-white truncate">
              {formattedPlatform}
            </span>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#f9f9fb] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2f2f2f]">
            <span className="text-[11px] text-[#737373] dark:text-[#888888]">
              {t("settings.computerStatusLabel")}
            </span>
            <div className="flex items-center gap-1.5 font-medium">
              {enableComputerUse ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("settings.computerReady")}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <span className="text-[#737373] dark:text-[#888888]">
                    {t("settings.computerDisabled")}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Engine */}
          <div className="sm:col-span-2 flex flex-col gap-1 p-2.5 rounded-lg bg-[#f9f9fb] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2f2f2f]">
            <span className="text-[11px] text-[#737373] dark:text-[#888888]">
              {t("settings.computerEngineLabel")}
            </span>
            <span className="font-mono text-[11px] text-[#555555] dark:text-[#b4b4b4]">
              {capabilities?.provider || capabilities?.engine || "const-computer-use (Win32 / P-Invoke / UI Automation)"}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Running Desktop Applications                               */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
            <span className="text-xs font-semibold text-[#262626] dark:text-white tracking-tight uppercase">
              {t("settings.computerActiveApplications")}
            </span>
          </div>
          <span className="text-[11px] text-[#737373] dark:text-[#888888]">
            {apps.length} detected
          </span>
        </div>

        {apps.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#737373] dark:text-[#888888]">
            {isLoadingApps ? "Detecting running windows..." : "No active desktop windows detected"}
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[#dedee2] dark:border-[#303030] divide-y divide-[#ededf0] dark:divide-[#2d2d2d]">
            {apps.slice(0, 15).map((app, idx) => (
              <div
                key={`${app.name}-${app.pid || idx}`}
                className="px-3 py-2 flex items-center justify-between text-xs hover:bg-[#f9f9fb] dark:hover:bg-[#262626] transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-mono text-[11px] text-[#262626] dark:text-white font-medium truncate">
                    {app.name}
                  </span>
                  {app.title && app.title !== app.name && (
                    <span className="text-[11px] text-[#737373] dark:text-[#969696] truncate">
                      — {app.title}
                    </span>
                  )}
                </div>
                {app.pid && (
                  <span className="font-mono text-[10px] text-[#737373] dark:text-[#888888] shrink-0">
                    PID {app.pid}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. Registered Tool Calls                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[#dedee2] dark:border-[#383838]">
          <Terminal className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
          <span className="text-xs font-semibold text-[#262626] dark:text-white tracking-tight uppercase">
            {t("settings.computerAvailableTools")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          {COMPUTER_TOOL_LIST.map((tool) => (
            <div
              key={tool.name}
              className="px-3 py-2 rounded-lg bg-[#f9f9fb] dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#2a2a2a] flex items-center justify-between text-xs gap-3"
            >
              <div className="flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-[#737373] dark:text-[#888888] shrink-0" />
                <span className="font-mono text-[11px] font-semibold text-[#262626] dark:text-white">
                  {tool.name}
                </span>
              </div>
              <span className="text-[11px] text-[#737373] dark:text-[#969696] text-right truncate">
                {tool.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. Safety & Privacy Policy Notice                             */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 sm:p-5 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#262626] dark:text-white tracking-tight">
            {t("settings.computerSafetyNotice")}
          </span>
          <p className="text-[11px] leading-relaxed text-[#737373] dark:text-[#969696]">
            {t("settings.computerSafetyDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
