import "./settings/settings.css";
import { SkillsSettings } from "./settings/skills-settings";
import { CONST_ROUTER_LLM_MODELS } from "../lib/models-config";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ScrollArea, Switch, toast, cn } from "@const/ui";
import {
  Settings2,
  Cable,
  UserRound,
  UserRoundPen,
  Keyboard,
  Palette,
  Box,
  Brain,
  Bot,
  BarChart3,
  Settings,
  RotateCcw,
  X,
  Sun,
  Moon,
  Search,
  Monitor,
  FolderOpen,
  Play,
  Pencil,
  Trash2,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useKeyboardShortcuts, type ShortcutItem } from "../lib/shortcuts";
import type { UserProfile } from "./sidebar";

import {
  useTheme,
  useConversationWidth,
  useInterfaceZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  ZOOM_STEP,
  useUiFontSize,
  DEFAULT_UI_FONT_SIZE,
  MIN_UI_FONT_SIZE,
  MAX_UI_FONT_SIZE,
  useCodeFontSize,
  DEFAULT_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  useDiffMarks,
} from "../lib/theme";
import { ModelSettings } from "./settings/model-settings";
import { MemorySettings } from "./settings/memory-settings";
import { ComputerUseSettings } from "./settings/computer-use-settings";
import { McpSettings } from "./settings/mcp-settings";

import { UsageStatsView } from "./settings/usage-stats-view";
import { ProfileSettings } from "./settings/profile-settings";
import { useTranslation, type SupportedLanguage } from "../lib/i18n";
import {
  SettingsSection,
  SettingsRow,
  SettingsChoice,
  SettingsSelect,
  SettingsStepper,
  settingsButton,
  settingsInput,
  settingsPrimaryButton,
} from "./settings/settings-controls";
import { playTaskCompletionSound } from "../lib/sound";

export interface SettingsViewProps {
  open?: boolean;
  onClose?: () => void;
  onBackToWorkspace?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
  currentProject?: string;
}

export const CONST_ROUTER_DEFAULT_URL = "https://router.const.web.id/v1";

export const BUILTIN_CONST_MODELS = CONST_ROUTER_LLM_MODELS;

export function SettingsView({
  open = true,
  onClose,
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
  currentProject,
}: SettingsViewProps) {
  // Normalize legacy and alias tab names
  const normalizedInitialTab = useMemo(() => {
    if (initialTab === "model" || initialTab === "models")
      return "model-settings";
    if (initialTab === "shortcuts") return "keyboard-shortcuts";
    if (initialTab === "user" || initialTab === "account") return "profile";
    if (initialTab === "data-and-stats" || initialTab === "usage")
      return "usage-stats";
    return initialTab || "general";
  }, [initialTab]);

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>(normalizedInitialTab);

  // Sync activeTab when initialTab prop changes
  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  const handleClose = () => {
    if (onClose) onClose();
    else if (onBackToWorkspace) onBackToWorkspace();
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef(false);

  // Keep keyboard focus inside Settings and return it to the workspace on close.
  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || recordingRef.current) return;
      if (event.key === "Escape") {
        if (
          document.querySelector(
            '[role="dialog"][data-state="open"], [role="listbox"]',
          )
        )
          return;
        event.preventDefault();
        handleClose();
      }
      if (event.key === "Tab") {
        if (
          document.querySelector(
            '[role="dialog"][data-state="open"], [role="listbox"]',
          )
        )
          return;
        const items = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), [tabindex="0"]',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose, onBackToWorkspace]);

  // Appearance & Theme settings
  const { t, language, setLanguage } = useTranslation();
  const [theme, setTheme] = useTheme();
  const [conversationWidth, setConversationWidth] = useConversationWidth();
  const [zoom, setZoom] = useInterfaceZoom();
  const [uiFontSize, setUiFontSize] = useUiFontSize();
  const [codeFontSize, setCodeFontSize] = useCodeFontSize();
  const [diffMarks, setDiffMarks] = useDiffMarks();

  // Local configuration
  const [activeModel, setActiveModel] = useState<string>(() => {
    const saved = localStorage.getItem("const_harness_active_model");
    if (
      !saved ||
      saved === "Const" ||
      saved === "gemini-3.6-flash" ||
      saved === "gemini-3.7-flash" ||
      saved === "qwen-3.8-27b"
    )
      return "gemini-3.8-flash";
    if (saved === "Gemini 3.8 Flash") return "gemini-3.8-flash";
    if (saved === "GLM 5.3 Flash") return "glm-5.3-flash";
    if (saved === "Deepseek v4.1 Flash") return "deepseek-v4.1-flash";
    if (saved === "Qwen 3.8 Omni Flash") return "qwen-3.8-omni-flash";
    if (saved === "GPT 6 Luna") return "gpt-6-luna";
    return saved;
  });

  // General Settings State
  const [defaultProjectLocation, setDefaultProjectLocation] = useState<string>(
    () => {
      return (
        localStorage.getItem("const_harness_default_project_location") || ""
      );
    },
  );

  const [defaultConfirmationMode, setDefaultConfirmationMode] = useState<
    "ask_before_changes" | "full_access" | "request_review"
  >(() => {
    return (
      (localStorage.getItem("const_harness_default_mode") as
        "ask_before_changes" | "full_access" | "request_review") ||
      "ask_before_changes"
    );
  });

  const [queueMode, setQueueMode] = useState<"queue" | "steer">(() => {
    return (
      (localStorage.getItem("const_harness_queue_mode") as "queue" | "steer") ||
      "queue"
    );
  });

  const [taskNotifications, setTaskNotifications] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_task_notifications") !== "false";
  });

  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_sound_alerts") !== "false";
  });

  const [autoUpdates, setAutoUpdates] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_auto_updates") !== "false";
  });

  const [launchOnStartup, setLaunchOnStartup] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_launch_on_startup") === "true";
  });

  const handleBrowseDefaultLocation = async () => {
    if (window.electron?.openDirectoryDialog) {
      const selected = await window.electron.openDirectoryDialog();
      if (selected) {
        setDefaultProjectLocation(selected);
        localStorage.setItem(
          "const_harness_default_project_location",
          selected,
        );
        if (window.electron?.saveConfig) {
          window.electron
            .saveConfig({ defaultProjectLocation: selected })
            .catch(() => {});
        }
      }
    }
  };

  const handleResetDefaultLocation = () => {
    setDefaultProjectLocation("");
    localStorage.removeItem("const_harness_default_project_location");
    if (window.electron?.saveConfig) {
      window.electron
        .saveConfig({ defaultProjectLocation: "" })
        .catch(() => {});
    }
  };

  const LANGUAGE_OPTIONS: { id: SupportedLanguage; native: string }[] = [
    { id: "en", native: "English (US)" },
    { id: "id", native: "Bahasa Indonesia" },
    { id: "ja", native: "日本語" },
    { id: "zh", native: "中文 (简体)" },
    { id: "es", native: "Español" },
  ];

  const handleSetLanguage = (lang: SupportedLanguage) => {
    setLanguage(lang);
    localStorage.setItem("const_app_language", lang);
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ language: lang }).catch(() => {});
    }
  };

  const handleSetDefaultMode = (
    mode: "ask_before_changes" | "full_access" | "request_review",
  ) => {
    setDefaultConfirmationMode(mode);
    localStorage.setItem("const_harness_default_mode", mode);
    window.dispatchEvent(
      new CustomEvent("const:default-mode-changed", { detail: mode }),
    );
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ defaultPermission: mode }).catch(() => {});
    }
  };

  const handleSetQueueMode = (mode: "queue" | "steer") => {
    setQueueMode(mode);
    localStorage.setItem("const_harness_queue_mode", mode);
    window.dispatchEvent(
      new CustomEvent("const:queue-mode-changed", { detail: mode }),
    );
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ queueMode: mode }).catch(() => {});
    }
  };

  const handleToggleTaskNotifications = (enabled: boolean) => {
    setTaskNotifications(enabled);
    localStorage.setItem("const_harness_task_notifications", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron
        .saveConfig({ taskNotifications: enabled })
        .catch(() => {});
    }
    if (
      enabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  };

  const handleToggleSoundAlerts = (enabled: boolean) => {
    setSoundAlerts(enabled);
    localStorage.setItem("const_harness_sound_alerts", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ soundAlerts: enabled }).catch(() => {});
    }
    if (enabled) {
      playTaskCompletionSound();
    }
  };

  const handleToggleAutoUpdates = (enabled: boolean) => {
    setAutoUpdates(enabled);
    localStorage.setItem("const_harness_auto_updates", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ autoCheckUpdates: enabled }).catch(() => {});
    }
  };

  const handleToggleLaunchOnStartup = (enabled: boolean) => {
    setLaunchOnStartup(enabled);
    localStorage.setItem("const_harness_launch_on_startup", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ launchOnStartup: enabled }).catch(() => {});
    }
  };

  const handleOpenDataFolder = async () => {
    try {
      if (!(await window.electron?.openConstFolder?.()))
        throw new Error("Unavailable");
    } catch {
      toast.error(t("settings.failedToOpenDataFolder"));
    }
  };

  // Reactive account quota.
  const quota = useQuery(api.router.quotas.getUserQuota, {});

  // Load native preferences on mount.
  useEffect(() => {
    if (window.electron?.getConfig) {
      let cancelled = false;
      window.electron
        .getConfig()
        .then((cfg) => {
          if (cancelled) return;
          if (cfg?.activeModel) {
            setActiveModel(cfg.activeModel);
          }
          if (cfg?.defaultProjectLocation !== undefined) {
            setDefaultProjectLocation(cfg.defaultProjectLocation);
          }
          if (cfg?.defaultPermission) {
            setDefaultConfirmationMode(cfg.defaultPermission);
          }
          if (cfg?.queueMode) {
            setQueueMode(cfg.queueMode);
          }
          if (cfg?.taskNotifications !== undefined) {
            setTaskNotifications(cfg.taskNotifications);
          }
          if (cfg?.autoCheckUpdates !== undefined) {
            setAutoUpdates(cfg.autoCheckUpdates);
          }
          if (cfg?.launchOnStartup !== undefined) {
            setLaunchOnStartup(cfg.launchOnStartup);
          }
          if (cfg?.soundAlerts !== undefined) {
            setSoundAlerts(cfg.soundAlerts);
          }
          if (cfg?.personalizationWorkRole !== undefined) {
            setWorkRole(cfg.personalizationWorkRole);
          }
          if (cfg?.personalizationCustomInstructions !== undefined) {
            setCustomInstructions(cfg.personalizationCustomInstructions);
          }
        })
        .catch(() => toast.error(t("settings.preferencesSaveFailed")));
      return () => {
        cancelled = true;
      };
    }
  }, []);

  // Personalization settings state
  const [workRole, setWorkRole] = useState<string>(() => {
    return localStorage.getItem("const_personalization_work_role") || "";
  });
  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    return (
      localStorage.getItem("const_personalization_custom_instructions") || ""
    );
  });
  const [isSavingPersonalization, setIsSavingPersonalization] = useState(false);

  const handleSavePersonalization = async () => {
    if (isSavingPersonalization) return;
    setIsSavingPersonalization(true);
    try {
      localStorage.setItem("const_personalization_work_role", workRole);
      localStorage.setItem(
        "const_personalization_custom_instructions",
        customInstructions,
      );
      await window.electron?.saveConfig?.({
        personalizationWorkRole: workRole,
        personalizationCustomInstructions: customInstructions,
      });
      toast.success(t("settings.personalizationSaved"));
    } catch {
      toast.error(t("settings.preferencesSaveFailed"));
    } finally {
      setIsSavingPersonalization(false);
    }
  };

  const handleSelectActiveModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_harness_active_model", modelId);
  };

  // Keyboard shortcut editing.
  const [shortcutsSearch, setShortcutsSearch] = useState<string>("");
  const { shortcuts, updateShortcut, deleteShortcut, resetAll } =
    useKeyboardShortcuts();
  const [recordingTarget, setRecordingTarget] = useState<{
    id: string;
    comboIndex: number;
    command: string;
    keys: string[];
  } | null>(null);

  recordingRef.current = Boolean(recordingTarget);

  const isMac = useMemo(() => {
    return (
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
    );
  }, []);

  const getCommandName = useCallback(
    (item: ShortcutItem) => {
      const camelId = item.id.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      const transKey = `shortcuts.${camelId}` as any;
      const translated = t(transKey);
      return translated && translated !== transKey ? translated : item.command;
    },
    [t],
  );

  const getScopeName = useCallback(
    (scope: string) => {
      const transKey = `shortcuts.scope${scope}` as any;
      const translated = t(transKey);
      return translated && translated !== transKey ? translated : scope;
    },
    [t],
  );

  // Listen to keyboard recording when changing keybindings
  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeyRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingTarget(null);
        return;
      }

      if (e.key === "Enter" && recordingTarget.keys.length > 0) {
        const item = shortcuts.find((s) => s.id === recordingTarget.id);
        if (item) {
          const nextCombos = [...item.keybindings];
          nextCombos[recordingTarget.comboIndex] = recordingTarget.keys;
          updateShortcut(recordingTarget.id, nextCombos);
          const cmdName = getCommandName(item);
          toast.success(
            t("shortcuts.updatedToast" as any, { command: cmdName }),
          );
        }
        setRecordingTarget(null);
        return;
      }

      const isModifier = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
      if (isModifier) return;

      const keys: string[] = [];
      if (e.ctrlKey || e.metaKey) keys.push(isMac ? "⌘" : "Ctrl");
      if (e.shiftKey) keys.push("Shift");
      if (e.altKey) keys.push("Alt");

      let keyName = e.key;
      if (keyName === " ") keyName = "Space";
      else if (keyName === "ArrowUp") keyName = "Up";
      else if (keyName === "ArrowDown") keyName = "Down";
      else if (keyName === "ArrowLeft") keyName = "Left";
      else if (keyName === "ArrowRight") keyName = "Right";
      else if (keyName.length === 1) keyName = keyName.toUpperCase();

      keys.push(keyName);
      setRecordingTarget((prev) => (prev ? { ...prev, keys } : null));
    };

    window.addEventListener("keydown", handleKeyRecord, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyRecord, { capture: true });
  }, [recordingTarget, shortcuts, updateShortcut, isMac, getCommandName, t]);

  const filteredShortcuts = useMemo(() => {
    if (!shortcutsSearch.trim()) return shortcuts;
    const q = shortcutsSearch.toLowerCase().trim();
    return shortcuts.filter((item) => {
      const cmdName = getCommandName(item).toLowerCase();
      const rawCmd = item.command.toLowerCase();
      const scopeName = getScopeName(item.scope).toLowerCase();
      const rawScope = item.scope.toLowerCase();
      const matchCombo = item.keybindings.some((combo) =>
        combo.some((k) => k.toLowerCase().includes(q)),
      );
      return (
        cmdName.includes(q) ||
        rawCmd.includes(q) ||
        scopeName.includes(q) ||
        rawScope.includes(q) ||
        matchCombo
      );
    });
  }, [shortcuts, shortcutsSearch, getCommandName, getScopeName]);

  // Const Harness Nav Categories
  const navCategories = [
    {
      label: t("settings.personal"),
      items: [
        { id: "general", label: t("settings.general"), icon: Settings2 },
        { id: "profile", label: t("settings.profile"), icon: UserRound },
        { id: "appearance", label: t("settings.appearance"), icon: Palette },
        { id: "model-settings", label: t("settings.models"), icon: Box },
        {
          id: "personalization",
          label: t("settings.personalization"),
          icon: UserRoundPen,
        },
        {
          id: "keyboard-shortcuts",
          label: t("settings.keyboardShortcuts"),
          icon: Keyboard,
        },
      ],
    },
    {
      label: t("settings.agentCapabilities"),
      items: [
        { id: "computer-use", label: t("settings.computerUse"), icon: Monitor },
        { id: "memory", label: t("settings.memory"), icon: Brain },
        { id: "subagents", label: t("settings.subagents"), icon: Bot },
        { id: "mcp-servers", label: t("settings.mcpServers"), icon: Cable },
      ],
    },
    {
      label: t("settings.usageStatistic"),
      items: [
        { id: "usage-stats", label: t("settings.usageStats"), icon: BarChart3 },
      ],
    },
  ];

  const tabTitle =
    navCategories
      .flatMap((category) => category.items)
      .find((item) => item.id === activeTab)?.label || t("settings.title");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xs select-none p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
    >
      <div
        ref={dialogRef}
        className="workspace-settings w-[1040px] max-w-[96vw] h-[720px] max-h-[90vh] bg-[#ffffff] dark:bg-[#161616] border border-[#dedee2] dark:border-[#383838] rounded-2xl flex overflow-hidden text-[#262626] dark:text-[#d4d4d4] font-sans outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 animate-in fade-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Left Sidebar inside Modal                                   */}
        <aside className="w-[208px] h-full flex flex-col shrink-0 bg-[#f8f9fa] dark:bg-[#222222] p-3 select-none">
          {/* Top Heading */}
          <div className="px-2.5 pt-2 pb-2 shrink-0 mb-1">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight">
              {t("settings.title")}
            </h2>
          </div>

          {/* Navigation Categories using Radix ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 w-full pr-1">
            <div className="flex flex-col gap-4 pt-1">
              {navCategories.map((cat) => (
                <div key={cat.label} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-[#969696] px-2.5 pt-1.5 pb-1">
                    {cat.label}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {cat.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "settings-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-medium transition-colors cursor-pointer text-left outline-none focus:outline-none",
                            isActive
                              ? "bg-neutral-200/80 dark:bg-[#383838] text-neutral-900 dark:text-white font-medium"
                              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-white/5",
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0 transition-colors",
                              isActive
                                ? "text-neutral-900 dark:text-white"
                                : "text-neutral-500 dark:text-[#969696]",
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
        {/* Right Main Content Area                                     */}
        <main className="flex-1 h-full flex flex-col min-w-0 bg-[#ffffff] dark:bg-[#161616] overflow-hidden">
          {/* Header Row: Title, Subtitle, and Top-Right Close Button 'X' */}
          <div className="flex-none px-6 sm:px-10 pt-6 pb-4 flex items-start justify-between gap-4 select-none">
            <div>
              <h1 className="text-[22px] font-normal tracking-tight text-neutral-900 dark:text-white">
                {tabTitle}
              </h1>
            </div>

            {/* Top-Right Close Button 'X' */}
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("common.close")}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222222] transition-colors cursor-pointer outline-none focus:outline-none shrink-0"
              title={`${t("common.close")} (Esc)`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Section Content wrapped in Radix ScrollArea */}
          <ScrollArea
            key={activeTab}
            className="settings-content flex-1 min-h-0 w-full px-6 sm:px-10 pb-4"
            thumbClassName="bg-black/15 dark:bg-white/20 hover:bg-black/25 dark:hover:bg-white/30"
          >
            {activeTab === "profile" ? (
              <ProfileSettings
                user={user}
                quota={quota}
                onSignOut={onSignOut}
                onSwitchAccount={onSwitchAccount}
              />
            ) : activeTab === "general" ? (
              <div className="w-full min-w-0 space-y-6 pb-6">
                <SettingsSection title={t("settings.workspaceAndExecution")}>
                  <SettingsRow label={t("settings.defaultProjectLocation")}>
                    <div className="flex max-w-full items-center gap-2">
                      <span
                        className="min-w-0 max-w-40 truncate text-xs text-neutral-500 dark:text-[#969696] select-text"
                        title={
                          defaultProjectLocation || "~/.const/harness/brain"
                        }
                      >
                        {defaultProjectLocation || "~/.const/harness/brain"}
                      </span>
                      {defaultProjectLocation && (
                        <button
                          type="button"
                          className={`${settingsButton} px-2`}
                          title={t("settings.resetDefaultLocation")}
                          onClick={handleResetDefaultLocation}
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={settingsButton}
                        onClick={handleBrowseDefaultLocation}
                      >
                        {t("settings.browse")}
                      </button>
                    </div>
                  </SettingsRow>
                  <SettingsRow label={t("settings.defaultPermission")}>
                    <SettingsSelect
                      label={t("settings.defaultPermission")}
                      value={defaultConfirmationMode}
                      onChange={(value) =>
                        handleSetDefaultMode(
                          value as typeof defaultConfirmationMode,
                        )
                      }
                      options={[
                        {
                          value: "ask_before_changes",
                          label: t("settings.askBeforeChanges"),
                          hint: t("settings.askBeforeChangesDesc"),
                        },
                        {
                          value: "full_access",
                          label: t("settings.fullMachine"),
                          hint: t("settings.fullMachineDesc"),
                        },
                        {
                          value: "request_review",
                          label: t("settings.requestReview"),
                          hint: t("settings.requestReviewDesc"),
                        },
                      ]}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.queueMessageTitle")}>
                    <SettingsChoice
                      label={t("settings.queueMessageTitle")}
                      value={queueMode}
                      onChange={handleSetQueueMode}
                      options={[
                        { value: "queue", label: t("settings.queueModeQueue") },
                        { value: "steer", label: t("settings.queueModeSteer") },
                      ]}
                    />
                  </SettingsRow>
                </SettingsSection>
                <SettingsSection title={t("settings.preferencesAndSystem")}>
                  <SettingsRow label={t("settings.interfaceLanguage")}>
                    <SettingsSelect
                      label={t("settings.interfaceLanguage")}
                      value={language}
                      onChange={(value) =>
                        handleSetLanguage(value as SupportedLanguage)
                      }
                      options={LANGUAGE_OPTIONS.map((option) => ({
                        value: option.id,
                        label: option.native,
                      }))}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label={t("settings.taskNotifications")}
                    htmlFor="settings-notifications"
                  >
                    <Switch
                      id="settings-notifications"
                      checked={taskNotifications}
                      onCheckedChange={handleToggleTaskNotifications}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label={t("settings.completionSounds")}
                    htmlFor="settings-sounds"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className={settingsButton}
                        title={t("settings.previewChime")}
                        onClick={() => playTaskCompletionSound()}
                      >
                        <Play className="size-3" />
                        {t("settings.test")}
                      </button>
                      <Switch
                        id="settings-sounds"
                        checked={soundAlerts}
                        onCheckedChange={handleToggleSoundAlerts}
                      />
                    </div>
                  </SettingsRow>
                  <SettingsRow
                    label={t("settings.autoUpdates")}
                    htmlFor="settings-updates"
                  >
                    <Switch
                      id="settings-updates"
                      checked={autoUpdates}
                      onCheckedChange={handleToggleAutoUpdates}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label={t("settings.launchOnStartup")}
                    htmlFor="settings-startup"
                  >
                    <Switch
                      id="settings-startup"
                      checked={launchOnStartup}
                      onCheckedChange={handleToggleLaunchOnStartup}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.localStorageTitle")}>
                    <button
                      type="button"
                      className={settingsButton}
                      onClick={handleOpenDataFolder}
                    >
                      <FolderOpen className="size-3.5" />
                      {t("settings.openFolder")}
                    </button>
                  </SettingsRow>
                </SettingsSection>
              </div>
            ) : activeTab === "keyboard-shortcuts" ? (
              /* Keyboard Shortcuts Tab (Matching ZCode UI & Hotkeys)      */
              <div className="flex flex-col gap-4 w-full pb-8 select-none">
                {/* Search Bar & Reset to defaults */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#888888] pointer-events-none" />
                    <input
                      type="text"
                      value={shortcutsSearch}
                      onChange={(e) => setShortcutsSearch(e.target.value)}
                      placeholder={t("shortcuts.searchPlaceholder")}
                      className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] text-[#262626] dark:text-[#ececec] placeholder-[#888888] dark:placeholder-[#737373] outline-none focus:border-[#737373] dark:focus:border-[#525256] transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-[#737373] dark:text-[#6e6e72]">
                      <Keyboard className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetAll();
                      toast.success(t("shortcuts.resetSuccess"));
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#737373] dark:text-[#969696] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0"
                    title={t("shortcuts.resetAllTooltip")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t("shortcuts.resetAll")}</span>
                  </button>
                </div>

                {/* Shortcuts Table */}
                <div className="rounded-xl bg-neutral-50 dark:bg-[#222222] overflow-hidden">
                  {/* Table Header */}
                  <div className="px-4 py-2.5 border-[#dedee2] dark:border-[#383838] bg-[#f0f0f4] dark:bg-[#282828] grid grid-cols-12 text-xs font-medium text-[#737373] dark:text-[#a0a0a5] select-none">
                    <div className="col-span-5">
                      {t("shortcuts.columnCommand")}
                    </div>
                    <div className="col-span-4 pl-1">
                      {t("shortcuts.columnKeybinding")}
                    </div>
                    <div className="col-span-2 text-left">
                      {t("shortcuts.columnScope")}
                    </div>
                    <div className="col-span-1 text-right pr-1">
                      {t("shortcuts.columnActions")}
                    </div>
                  </div>

                  {/* Table Body */}
                  {filteredShortcuts.length > 0 ? (
                    <div className="space-y-1">
                      {filteredShortcuts.map((item) => {
                        const cmdName = getCommandName(item);
                        return (
                          <div
                            key={item.id}
                            className="px-4 py-2.5 grid grid-cols-12 items-center text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                          >
                            {/* Command */}
                            <div className="col-span-5 text-[#262626] dark:text-[#ececec] font-normal text-xs sm:text-[13px] pr-2">
                              {cmdName}
                            </div>

                            {/* Keybinding */}
                            <div className="col-span-4 pl-1 flex flex-col gap-1.5">
                              {item.keybindings.length > 0 ? (
                                item.keybindings.map((combo, comboIdx) => (
                                  <div
                                    key={comboIdx}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="flex items-center gap-1">
                                      {combo.map((k, kIdx) => (
                                        <kbd
                                          key={kIdx}
                                          className="px-2 py-0.5 text-[11px] font-sans font-medium rounded-md bg-white dark:bg-[#2c2c2e] border border-[#dedee2] dark:border-[#3c3c40] text-[#262626] dark:text-[#f0f0f0] shadow-xs"
                                        >
                                          {isMac && k === "Ctrl" ? "⌘" : k}
                                        </kbd>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRecordingTarget({
                                          id: item.id,
                                          comboIndex: comboIdx,
                                          command: item.command,
                                          keys: [...combo],
                                        })
                                      }
                                      className="p-1 rounded text-[#737373] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                                      title={t("shortcuts.editTooltip", {
                                        command: cmdName,
                                      })}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRecordingTarget({
                                      id: item.id,
                                      comboIndex: 0,
                                      command: item.command,
                                      keys: [],
                                    })
                                  }
                                  className="text-xs text-[#888888] hover:text-[#555] dark:hover:text-[#aaa] italic text-left cursor-pointer"
                                >
                                  {t("shortcuts.recordShortcut")}
                                </button>
                              )}
                            </div>

                            {/* Scope */}
                            <div className="col-span-2 text-[#737373] dark:text-[#8e8e93] text-xs">
                              {getScopeName(item.scope)}
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex justify-end pr-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteShortcut(item.id);
                                  toast.info(
                                    t("shortcuts.clearedToast", {
                                      command: cmdName,
                                    }),
                                  );
                                }}
                                className="p-1.5 rounded-lg text-[#737373] dark:text-[#888888] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                                title={t("shortcuts.clearTooltip", {
                                  command: cmdName,
                                })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <Keyboard className="w-8 h-8 text-[#a3a3a3] dark:text-[#555555] mb-2" />
                      <p className="text-xs text-[#737373] dark:text-[#969696]">
                        {t("shortcuts.noMatches", { query: shortcutsSearch })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "appearance" ? (
              <div className="w-full min-w-0 space-y-6 pb-6">
                <SettingsSection title={t("settings.themeAndLayout")}>
                  <SettingsRow label={t("settings.appTheme")}>
                    <SettingsChoice
                      label={t("settings.appTheme")}
                      value={theme}
                      onChange={setTheme}
                      options={[
                        {
                          value: "system",
                          label: t("settings.themeSystem"),
                          icon: <Monitor className="size-3.5" />,
                        },
                        {
                          value: "light",
                          label: t("settings.themeLight"),
                          icon: <Sun className="size-3.5" />,
                        },
                        {
                          value: "dark",
                          label: t("settings.themeDark"),
                          icon: <Moon className="size-3.5" />,
                        },
                      ]}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.conversationWidth")}>
                    <SettingsChoice
                      label={t("settings.conversationWidth")}
                      value={conversationWidth}
                      onChange={setConversationWidth}
                      options={[
                        { value: "narrow", label: t("settings.widthNarrow") },
                        { value: "default", label: t("settings.widthDefault") },
                        { value: "wide", label: t("settings.widthWide") },
                      ]}
                    />
                  </SettingsRow>
                </SettingsSection>
                <SettingsSection title={t("settings.typographyAndCode")}>
                  <SettingsRow label={t("settings.uiFontSize")}>
                    <SettingsStepper
                      label={t("settings.uiFontSize")}
                      value={uiFontSize}
                      min={MIN_UI_FONT_SIZE}
                      max={MAX_UI_FONT_SIZE}
                      defaultValue={DEFAULT_UI_FONT_SIZE}
                      onChange={setUiFontSize}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.codeFontSize")}>
                    <SettingsStepper
                      label={t("settings.codeFontSize")}
                      value={codeFontSize}
                      min={MIN_CODE_FONT_SIZE}
                      max={MAX_CODE_FONT_SIZE}
                      defaultValue={DEFAULT_CODE_FONT_SIZE}
                      onChange={setCodeFontSize}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.diffMarksTitle")}>
                    <SettingsChoice
                      label={t("settings.diffMarksTitle")}
                      value={diffMarks}
                      onChange={setDiffMarks}
                      options={[
                        { value: "color", label: t("settings.diffMarksColor") },
                        {
                          value: "symbols",
                          label: t("settings.diffMarksSymbols"),
                        },
                      ]}
                    />
                  </SettingsRow>
                  <SettingsRow label={t("settings.windowScale")}>
                    <SettingsStepper
                      label={t("settings.windowScale")}
                      value={zoom}
                      min={MIN_ZOOM}
                      max={MAX_ZOOM}
                      defaultValue={DEFAULT_ZOOM}
                      step={ZOOM_STEP}
                      unit="%"
                      onChange={setZoom}
                    />
                  </SettingsRow>
                </SettingsSection>
              </div>
            ) : activeTab === "usage-stats" ? (
              /* Usage Stats Tab (matching user Image 1 & Image 2)          */
              <UsageStatsView
                quota={quota}
                activeModel={activeModel}
                user={user}
              />
            ) : activeTab === "personalization" ? (
              <div className="w-full min-w-0 space-y-5 pb-6">
                <SettingsRow
                  label={t("settings.workRole")}
                  htmlFor="settings-work-role"
                >
                  <input
                    id="settings-work-role"
                    value={workRole}
                    onChange={(event) => setWorkRole(event.target.value)}
                    className={`${settingsInput} w-64 max-w-full`}
                  />
                </SettingsRow>
                <div className="space-y-2">
                  <label
                    htmlFor="settings-instructions"
                    className="block text-[13px] text-neutral-900 dark:text-white"
                  >
                    {t("settings.customInstructions")}
                  </label>
                  <textarea
                    id="settings-instructions"
                    value={customInstructions}
                    onChange={(event) =>
                      setCustomInstructions(event.target.value)
                    }
                    placeholder={t("settings.customInstructionsPlaceholder")}
                    rows={4}
                    className={`${settingsInput} block resize-y min-h-28 max-h-72 leading-relaxed`}
                  />
                  <p className="text-xs text-neutral-500 dark:text-[#969696]">
                    {t("settings.instructionsHint")}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={settingsPrimaryButton}
                    disabled={isSavingPersonalization}
                    onClick={handleSavePersonalization}
                  >
                    {t(
                      isSavingPersonalization
                        ? "settings.saving"
                        : "common.save",
                    )}
                  </button>
                </div>
              </div>
            ) : activeTab === "model-settings" ? (
              /* Model Settings View (LLM, Speech, Image, Video)          */
              <ModelSettings
                quota={quota}
                onActiveModelChanged={(modelId) =>
                  handleSelectActiveModel(modelId)
                }
              />
            ) : activeTab === "computer-use" ? (
              /* Computer Use & Browser Settings View                      */
              <ComputerUseSettings />
            ) : activeTab === "mcp-servers" ? (
              <McpSettings workspacePath={currentProject} />
            ) : activeTab === "plugins" ? (
              <SkillsSettings
                key="plugins"
                workspacePath={currentProject}
                initialTab="plugins"
                isModal
              />
            ) : activeTab === "memory" ? (
              /* Memory Settings View                                      */
              <MemorySettings currentProject={currentProject} />
            ) : (
              /* Generic Placeholder for other capabilities                */
              /* (subagents, plugins, mcp-servers, skills)                 */
              (() => {
                const currentItem = navCategories
                  .flatMap((c) => c.items)
                  .find((i) => i.id === activeTab);
                const Icon = currentItem?.icon || Settings;
                return (
                  <div className="w-full min-w-0 flex flex-col gap-3 pt-6 pb-6">
                    <div className="p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#262626] dark:text-white">
                        <Icon className="w-6 h-6 text-[#262626] dark:text-white" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h3 className="text-sm font-medium text-[#262626] dark:text-white capitalize">
                          {currentItem?.label || activeTab.replace(/-/g, " ")}
                        </h3>
                        <p className="text-xs text-[#737373] dark:text-[#969696] max-w-md">
                          {t("settings.capabilityUpcoming")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </ScrollArea>
        </main>
      </div>

      {/* Keybinding Recording Modal */}
      {recordingTarget &&
        (() => {
          const targetItem = shortcuts.find((s) => s.id === recordingTarget.id);
          const cmdName = targetItem
            ? getCommandName(targetItem)
            : recordingTarget.command;
          return (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
              onClick={() => setRecordingTarget(null)}
            >
              <div
                className="w-[420px] max-w-[95vw] bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[#262626] dark:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("shortcuts.changeKeybinding")}
                    </h3>
                    <p className="text-xs text-[#737373] dark:text-[#969696] mt-0.5">
                      {cmdName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecordingTarget(null)}
                    className="p-1 rounded-lg text-[#737373] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-h-[76px] rounded-xl border border-dashed border-[#737373]/40 dark:border-[#555555]/50 bg-black/5 dark:bg-white/5 flex items-center justify-center p-3 select-none">
                  {recordingTarget.keys.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      {recordingTarget.keys.map((k, idx) => (
                        <kbd
                          key={idx}
                          className="px-2.5 py-1 text-xs font-sans font-medium rounded-lg bg-white dark:bg-[#2c2c2e] border border-[#dedee2] dark:border-[#3c3c40] text-[#262626] dark:text-white shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[#737373] dark:text-[#969696] animate-pulse">
                      {t("shortcuts.pressKeysPrompt")}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[#737373] dark:text-[#888888]">
                  {t("shortcuts.pressKeysHint")}
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-[#dedee2] dark:border-[#383838]">
                  <button
                    type="button"
                    onClick={() => setRecordingTarget(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#737373] dark:text-[#969696] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const item = shortcuts.find(
                        (s) => s.id === recordingTarget.id,
                      );
                      if (item) {
                        const nextCombos = [...item.keybindings];
                        if (recordingTarget.keys.length > 0) {
                          nextCombos[recordingTarget.comboIndex] =
                            recordingTarget.keys;
                        }
                        updateShortcut(recordingTarget.id, nextCombos);
                        toast.success(
                          t("shortcuts.updatedToast", { command: cmdName }),
                        );
                      }
                      setRecordingTarget(null);
                    }}
                    disabled={recordingTarget.keys.length === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#171717] dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
                  >
                    {t("shortcuts.saveKeybinding")}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
