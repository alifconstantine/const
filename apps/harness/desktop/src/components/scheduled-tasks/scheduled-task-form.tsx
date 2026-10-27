import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Folder,
  FolderPlus,
  MessageSquare,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Trash2,
  Plus,
  Play,
  Info,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { ScheduledTaskItem, ScheduledTaskSchedule, ScheduledTaskRunHistory } from "../../vite-env";
import { CustomDropdown } from "./custom-dropdown";
import { TimePicker } from "./time-picker";
import { DayPickerGrid } from "./day-picker-grid";
import { CustomRepeatModal, type CustomRepeatConfig } from "./custom-repeat-modal";
import { SegmentedToggle } from "./segmented-toggle";
import { ScheduledTaskHistoryContent } from "./scheduled-task-history";
import { useTranslation } from "../../lib/i18n";

export interface ScheduledTaskFormData {
  name: string;
  prompt: string;
  schedule: ScheduledTaskSchedule;
  workspacePath?: string;
  permissionPreset?: "ask_before_changes" | "full_access" | "read-only" | "workspace-write" | "danger-full-access";
  model?: string;
}

export interface ScheduledTaskFormProps {
  initialValues?: Partial<ScheduledTaskItem>;
  task?: ScheduledTaskItem;
  isEditing?: boolean;
  activeSubTab?: "settings" | "history";
  onSubTabChange?: (tab: "settings" | "history") => void;
  onSubmit: (data: ScheduledTaskFormData) => void;
  onCancel: () => void;
  onSwitchToHistory?: () => void;
  onSwitchToSettings?: () => void;
  onNameChange?: (name: string) => void;
  historyList?: ScheduledTaskRunHistory[];
  onRunNow?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onOpenSession?: (sessionId: string) => void;
  onDeleteRun?: (runId: string) => void;
}

interface ModelItem {
  id: string;
  name: string;
  desc?: string;
  provider: string;
  providerName: string;
  supportsThinking?: boolean;
}

const isConstProvider = (p?: string) => {
  if (!p) return true;
  const clean = p.toLowerCase().trim();
  return (
    clean === "const" ||
    clean === "const-engine" ||
    clean === "const engine" ||
    clean === "const router" ||
    clean === "native" ||
    clean.startsWith("const")
  );
};

function formatTokenDisplay(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export function ScheduledTaskForm({
  initialValues,
  task,
  isEditing = false,
  activeSubTab: propActiveSubTab,
  onSubTabChange,
  onSubmit,
  onCancel,
  onSwitchToHistory,
  onSwitchToSettings,
  onNameChange,
  historyList,
  onRunNow,
  onDeleteTask,
  onOpenSession,
  onDeleteRun,
}: ScheduledTaskFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValues?.name || initialValues?.title || "");
  const [prompt, setPrompt] = useState(initialValues?.prompt || initialValues?.instructions || "");
  const [hasSchedule, setHasSchedule] = useState(Boolean(initialValues?.schedule));

  const [scheduleType, setScheduleType] = useState<ScheduledTaskSchedule["type"]>(
    initialValues?.schedule?.type || (initialValues?.schedule as any)?.kind || "daily"
  );
  const [scheduleTime, setScheduleTime] = useState(initialValues?.schedule?.time ?? "09:00");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(
    initialValues?.schedule?.dayOfWeek ?? 1
  );
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(
    initialValues?.schedule?.dayOfMonth ?? 1
  );
  const [customConfig, setCustomConfig] = useState<CustomRepeatConfig>({
    frequency: initialValues?.schedule?.customInterval ?? 1,
    unit: initialValues?.schedule?.customUnit ?? "days",
    endsNever: initialValues?.schedule?.endsType !== "date",
    endDate: initialValues?.schedule?.endDate,
  });
  const [showCustomModal, setShowCustomModal] = useState(false);

  // 1. Workspace / Project State (matching ChatCard)
  const [workspacePath, setWorkspacePath] = useState(
    initialValues?.workspacePath || localStorage.getItem("const_harness_current_project") || ""
  );
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [searchWorkspace, setSearchWorkspace] = useState("");
  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("const_harness_workspaces");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // 2. Permission Indicator state
  const [isAccessInfoOpen, setIsAccessInfoOpen] = useState(false);
  const accessInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialValues?.name || initialValues?.title) {
      onNameChange?.(initialValues.name || initialValues.title || "");
    }
  }, [initialValues, onNameChange]);

  // Scheduled tasks run unattended with full access
  const mode = "full_access";

  // 3. Model Selector State (matching ChatCard)
  const quota = useQuery(api.router.quotas.getUserQuota, {});
  const [models, setModels] = useState<ModelItem[]>([
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      desc: "Advanced frontier thinking & max depth",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "glm-5.3-flash",
      name: "GLM 5.3 Flash",
      desc: "Ultra-fast response model optimized for real-time coding and execution",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "deepseek-v4.1-flash",
      name: "Deepseek v4.1 Flash",
      desc: "High-performance MoE reasoning model specializing in algorithmic coding",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "qwen-3.8-omni-flash",
      name: "Qwen 3.8 Omni Flash",
      desc: "Native omni-modal foundation model strong across multilingual tasks and code",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "gpt-6-luna",
      name: "GPT 6 Luna",
      desc: "Frontier reasoning powerhouse with nuanced writing and problem solving",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "combo/auto",
      name: "combo/auto",
      desc: "Virtual Combo auto router with dynamic reasoning",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "combo/fast",
      name: "combo/fast",
      desc: "Virtual Combo fast chain optimized for sub-second latency",
      provider: "const",
      providerName: "Const",
      supportsThinking: false,
    },
    {
      id: "combo/coding",
      name: "combo/coding",
      desc: "Virtual Combo coding chain optimized for high-depth reasoning",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
  ]);

  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({
    const: true,
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = initialValues?.model || localStorage.getItem("const_harness_active_model");
    if (!saved || saved === "Const") return "Gemini 3.8 Flash";
    if (saved === "gemini-3.8-flash") return "Gemini 3.8 Flash";
    if (saved === "glm-5.3-flash") return "GLM 5.3 Flash";
    if (saved === "deepseek-v4.1-flash") return "Deepseek v4.1 Flash";
    if (saved === "qwen-3.8-omni-flash") return "Qwen 3.8 Omni Flash";
    if (saved === "gpt-6-luna") return "GPT 6 Luna";
    return saved;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [internalSubTab, setInternalSubTab] = useState<"settings" | "history">("settings");
  const activeSubTab = propActiveSubTab ?? internalSubTab;

  const handleSubTabChange = (tab: "settings" | "history") => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
    if (tab === "history" && onSwitchToHistory) {
      onSwitchToHistory();
    }
    if (tab === "settings" && onSwitchToSettings) {
      onSwitchToSettings();
    }
  };

  // Load models from engine
  useEffect(() => {
    if (window.electron?.getModels) {
      window.electron.getModels().then((items: any[]) => {
        if (items && items.length > 0) {
          const mapped = items.map((m: any) => {
            const isConst = isConstProvider(m.provider);
            const name = m.displayName || m.name || m.id;
            return {
              id: m.id,
              name,
              provider: isConst ? "const" : m.provider || "custom",
              providerName: isConst ? "Const" : m.providerName || "Custom",
              supportsThinking: Boolean(m.supportsThinking),
            };
          });
          setModels(mapped);
          setSelectedModel((prev) => {
            const current = prev || localStorage.getItem("const_harness_active_model");
            if (!current || current === "gemini-3.8-flash") {
              const foundDefault = mapped.find((m: any) => m.id === "gemini-3.8-flash");
              return foundDefault ? foundDefault.name : "Gemini 3.8 Flash";
            }
            const found = mapped.find((m: any) => m.id === current || m.name === current);
            return found ? found.name : current;
          });
        }
      }).catch(() => {});
    }
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setIsProjectOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
      if (accessInfoRef.current && !accessInfoRef.current.contains(e.target as Node)) {
        setIsAccessInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const groupedModels = useMemo(() => {
    const map = new Map<string, { providerId: string; providerName: string; items: ModelItem[] }>();
    for (const m of models) {
      const isConst = isConstProvider(m.provider);
      const pid = isConst ? "const" : m.provider || "custom";
      const pname = isConst ? "Const" : m.providerName || "Custom";
      if (!map.has(pid)) {
        map.set(pid, { providerId: pid, providerName: pname, items: [] });
      }
      map.get(pid)!.items.push(m);
    }
    return Array.from(map.values());
  }, [models]);

  const handleOpenFolder = async () => {
    if (!window.electron?.openDirectoryDialog) return;
    const selected = await window.electron.openDirectoryDialog();
    if (selected) {
      setWorkspacePath(selected);
      const updated = Array.from(new Set([selected, ...workspaces]));
      setWorkspaces(updated);
      localStorage.setItem("const_harness_workspaces", JSON.stringify(updated));
      setIsProjectOpen(false);
    }
  };

  const filteredWorkspaces = useMemo(() => {
    if (!searchWorkspace.trim()) return workspaces;
    const q = searchWorkspace.toLowerCase();
    return workspaces.filter((w) => w.toLowerCase().includes(q));
  }, [workspaces, searchWorkspace]);

  const displayWorkspaceName = useMemo(() => {
    if (!workspacePath || workspacePath === "Outside Project") {
      return t("scheduledTasks.workOutsideProject");
    }
    return workspacePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || workspacePath;
  }, [workspacePath, t]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    const schedule: ScheduledTaskSchedule = {
      type: scheduleType,
      kind: scheduleType,
      ...(scheduleType !== "hourly" && scheduleType !== "custom" ? { time: scheduleTime } : {}),
      ...(scheduleType === "weekly" ? { dayOfWeek: scheduleDayOfWeek } : {}),
      ...(scheduleType === "monthly" ? { dayOfMonth: scheduleDayOfMonth } : {}),
      ...(scheduleType === "custom"
        ? {
            customInterval: customConfig.frequency,
            customUnit: customConfig.unit,
            time: scheduleTime,
            endsType: customConfig.endsNever ? "never" : "date",
            endDate: customConfig.endDate,
          }
        : {}),
    };

    onSubmit({
      name: name.trim(),
      prompt: prompt.trim(),
      schedule,
      workspacePath: workspacePath === "Outside Project" ? "" : workspacePath,
      permissionPreset: mode,
      model: models.find((m) => m.name === selectedModel || m.id === selectedModel)?.id || selectedModel || "gemini-3.8-flash",
    });
  };

  const scheduleTypeOptions = [
    { value: "hourly", label: t("scheduledTasks.hourly") },
    { value: "daily", label: t("scheduledTasks.daily") },
    { value: "weekdays", label: t("scheduledTasks.weekdays") },
    { value: "weekly", label: t("scheduledTasks.weekly") },
    { value: "monthly", label: t("scheduledTasks.monthly") },
    { value: "custom", label: t("scheduledTasks.custom") },
  ];

  const weekDayOptions = [
    { value: "1", label: t("scheduledTasks.monday") },
    { value: "2", label: t("scheduledTasks.tuesday") },
    { value: "3", label: t("scheduledTasks.wednesday") },
    { value: "4", label: t("scheduledTasks.thursday") },
    { value: "5", label: t("scheduledTasks.friday") },
    { value: "6", label: t("scheduledTasks.saturday") },
    { value: "0", label: t("scheduledTasks.sunday") },
  ];

  const getSummaryText = (): string => {
    if (!hasSchedule) return t("scheduledTasks.noSchedule");
    switch (scheduleType) {
      case "hourly":
        return t("scheduledTasks.everyHour");
      case "daily":
        return t("scheduledTasks.everyDayAt").replace("{time}", scheduleTime);
      case "weekdays":
        return t("scheduledTasks.everyWeekdayAt").replace("{time}", scheduleTime);
      case "weekly": {
        const days = [
          t("scheduledTasks.sun"),
          t("scheduledTasks.mon"),
          t("scheduledTasks.tue"),
          t("scheduledTasks.wed"),
          t("scheduledTasks.thu"),
          t("scheduledTasks.fri"),
          t("scheduledTasks.sat"),
        ];
        return t("scheduledTasks.weeklyOnAt")
          .replace("{day}", days[scheduleDayOfWeek] || "")
          .replace("{time}", scheduleTime);
      }
      case "monthly":
        return t("scheduledTasks.monthlyOnDayAt")
          .replace("{day}", String(scheduleDayOfMonth))
          .replace("{time}", scheduleTime);
      case "custom": {
        const unitName =
          customConfig.unit === "minutes"
            ? t("scheduledTasks.minutes")
            : customConfig.unit === "hours"
            ? t("scheduledTasks.hours")
            : customConfig.unit === "days"
            ? t("scheduledTasks.days")
            : customConfig.unit === "weeks"
            ? t("scheduledTasks.weeks")
            : t("scheduledTasks.months");
        return t("scheduledTasks.everyCustomAt")
          .replace("{freq}", String(customConfig.frequency))
          .replace("{unit}", unitName)
          .replace("{time}", scheduleTime);
      }
      default:
        return t("scheduledTasks.custom");
    }
  };

  return (
    <>
      {/* Main Page Content */}
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-7 flex flex-col select-none">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">
            {isEditing ? t("common.edit") : t("scheduledTasks.newTask")}
          </h1>
          <p className="text-[13px] text-[#969696]">
            {t("scheduledTasks.subtitle")}
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <SegmentedToggle
            value={activeSubTab}
            onChange={handleSubTabChange}
            options={[
              { id: "settings", label: t("sidebar.settings") },
              { id: "history", label: t("scheduledTasks.history") },
            ]}
          />

          <div className="flex items-center gap-2">
            {activeSubTab === "settings" ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                <button
                  type="button"
                  className="h-8 px-3.5 flex items-center justify-center rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] transition-colors cursor-pointer"
                  onClick={onCancel}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="h-8 px-3.5 flex items-center justify-center rounded-lg text-xs font-medium text-[#161616] bg-[#d4d4d4] hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => handleSubmit()}
                  disabled={!name.trim() || !prompt.trim()}
                >
                  {isEditing ? t("common.save") : t("scheduledTasks.newTask")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                {isEditing && (task?.id || initialValues?.id) && (
                  <>
                    {onRunNow && (
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
                        onClick={() => onRunNow((task?.id || initialValues?.id)!)}
                        title={t("scheduledTasks.runNow")}
                        aria-label={t("scheduledTasks.runNow")}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                    {onDeleteTask && (
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-rose-900 text-[#969696] hover:text-rose-400 transition-colors cursor-pointer"
                        onClick={() => {
                          const titleToDelete = name || initialValues?.name || initialValues?.title || "this task";
                          if (window.confirm(`Delete "${titleToDelete}"?`)) {
                            onDeleteTask((task?.id || initialValues?.id)!);
                          }
                        }}
                        title={t("scheduledTasks.deleteScheduledTask")}
                        aria-label={t("scheduledTasks.deleteScheduledTask")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    className="h-8 px-3.5 flex items-center justify-center rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] transition-colors cursor-pointer"
                    onClick={onCancel}
                  >
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Content: History or Settings Form */}
        {activeSubTab === "history" ? (
          <div className="animate-in fade-in duration-200">
            {isEditing && historyList ? (
              <ScheduledTaskHistoryContent
                historyList={historyList}
                onOpenSession={onOpenSession}
                onDeleteRun={onDeleteRun}
              />
            ) : (
              <div className="bg-[#222222] border border-dashed border-[#383838] rounded-xl p-10 text-center text-[#969696] text-xs">
                <span>{t("scheduledTasks.noHistory")}</span>
              </div>
            )}
          </div>
        ) : (
          /* Form Fields */
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Field: Task Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">{t("scheduledTasks.taskName")}</label>
              <input
                type="text"
                className="w-full bg-[#2b2b2b] border border-[#383838] rounded-lg px-3 py-2 text-[13px] text-white outline-none placeholder:text-[#5d5d5d] transition-colors"
                placeholder={t("scheduledTasks.taskNamePlaceholder")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  onNameChange?.(e.target.value);
                }}
                required
              />
            </div>

            {/* Field: Schedule Bar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">{t("scheduledTasks.recurrence")}</label>
              {!hasSchedule ? (
                <div
                  className="inline-flex items-center gap-2 bg-[#222222] hover:bg-[#262626] border border-dashed border-[#383838] hover:border-[#5d5d5d] text-[#969696] hover:text-white rounded-lg px-3.5 py-2 text-xs transition-colors cursor-pointer w-fit"
                  onClick={() => setHasSchedule(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("scheduledTasks.recurrence")}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 bg-[#222222] border border-[#383838] rounded-lg p-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Schedule Kind Dropdown */}
                    <CustomDropdown
                      value={scheduleType || "daily"}
                      options={scheduleTypeOptions}
                      onChange={(val) => {
                        setScheduleType(val as ScheduledTaskSchedule["type"]);
                        if (val === "custom") {
                          setShowCustomModal(true);
                        }
                      }}
                    />

                    {/* If Custom: button opening CustomRepeatModal */}
                    {scheduleType === "custom" && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] transition-colors cursor-pointer"
                        onClick={() => setShowCustomModal(true)}
                      >
                        <span>
                          {t("scheduledTasks.everyInterval")
                            .replace("{freq}", String(customConfig.frequency))
                            .replace(
                              "{unit}",
                              customConfig.unit === "minutes"
                                ? t("scheduledTasks.minutes")
                                : customConfig.unit === "hours"
                                ? t("scheduledTasks.hours")
                                : customConfig.unit === "days"
                                ? t("scheduledTasks.days")
                                : customConfig.unit === "weeks"
                                ? t("scheduledTasks.weeks")
                                : t("scheduledTasks.months")
                            )}
                        </span>
                        <ChevronDown className="w-3 h-3 text-[#969696]" />
                      </button>
                    )}

                    {/* If Weekly: Day dropdown */}
                    {scheduleType === "weekly" && (
                      <>
                        <span className="text-xs text-[#969696]">{t("scheduledTasks.on")}</span>
                        <CustomDropdown
                          value={String(scheduleDayOfWeek)}
                          options={weekDayOptions}
                          onChange={(val) => setScheduleDayOfWeek(parseInt(val, 10))}
                        />
                      </>
                    )}

                    {/* If Monthly: Day grid picker */}
                    {scheduleType === "monthly" && (
                      <>
                        <span className="text-xs text-[#969696]">{t("scheduledTasks.dayLabel")}</span>
                        <DayPickerGrid
                          value={scheduleDayOfMonth}
                          onChange={setScheduleDayOfMonth}
                        />
                      </>
                    )}

                    {/* Time picker for non-hourly */}
                    {scheduleType !== "hourly" && (
                      <>
                        <span className="text-xs text-[#969696]">{t("scheduledTasks.at")}</span>
                        <TimePicker
                          value={scheduleTime}
                          onChange={setScheduleTime}
                        />
                      </>
                    )}

                    {/* Schedule Summary Preview */}
                    <span className="text-xs text-[#5d5d5d] ml-1">
                      {getSummaryText()}
                    </span>
                  </div>

                  {/* Reset / Remove Schedule Button */}
                  <button
                    type="button"
                    className="p-1.5 rounded text-[#969696] hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    onClick={() => setHasSchedule(false)}
                    title={t("scheduledTasks.removeSchedule")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Field: Instructions with Bottom Toolbar (Workspace, Permission, Model - exactly matching ChatCard) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">{t("workbench.editPrompt")}</label>
              <div className="bg-[#2b2b2b] border border-[#383838] rounded-xl transition-colors flex flex-col">
                <textarea
                  className="w-full min-h-[140px] bg-transparent text-[13px] text-white placeholder:text-[#5d5d5d] p-3 outline-none resize-y font-sans leading-relaxed rounded-t-xl"
                  placeholder={t("scheduledTasks.promptPlaceholder")}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                />

                {/* Embedded Toolbar matching ChatCard */}
                <div className="flex items-center justify-between p-2 bg-[#222222] border-t border-[#383838] gap-2 flex-wrap text-xs rounded-b-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Workspace / Project Selector (exact ChatCard pattern) */}
                    <div className="relative" ref={projectMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProjectOpen((prev) => !prev);
                          setIsModelOpen(false);
                          setIsAccessInfoOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
                        title={workspacePath || t("workbench.outsideWorkspace")}
                      >
                        <Folder className="w-3.5 h-3.5 text-[#969696]" />
                        <span className="truncate max-w-[160px]">{displayWorkspaceName}</span>
                        <ChevronDown className="w-3 h-3 text-[#969696] ml-0.5" />
                      </button>

                      {isProjectOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-64 sm:w-72 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                          {workspaces.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-[#383838]">
                                <Search className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                                <input
                                  type="text"
                                  value={searchWorkspace}
                                  onChange={(e) => setSearchWorkspace(e.target.value)}
                                  placeholder={t("scheduledTasks.searchWorkspaces")}
                                  className="w-full bg-transparent text-xs text-white placeholder:text-[#5d5d5d] outline-none"
                                  autoFocus
                                />
                              </div>

                              <ScrollArea className="max-h-48 pr-1" thumbClassName="bg-white/20 hover:bg-white/30">
                                <div className="flex flex-col gap-0.5 py-0.5">
                                  {filteredWorkspaces.map((ws) => {
                                    const wsName =
                                      ws.replace(/\\/g, "/").split("/").filter(Boolean).pop() || ws;
                                    return (
                                      <button
                                        key={ws}
                                        type="button"
                                        onClick={() => {
                                          setWorkspacePath(ws);
                                          setIsProjectOpen(false);
                                        }}
                                        className="w-full px-2.5 py-1.5 flex items-center justify-between text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] rounded-lg transition-colors cursor-pointer"
                                        title={ws}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <Folder className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                                          <div className="flex flex-col text-left truncate">
                                            <span className="truncate">{wsName}</span>
                                            <span className="text-[10px] text-[#777777] truncate">{ws}</span>
                                          </div>
                                        </div>
                                        {workspacePath === ws && (
                                          <Check className="w-3.5 h-3.5 text-white shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </ScrollArea>

                              <div className="h-[1px] bg-[#383838] my-1" />
                            </>
                          )}

                          <button
                            type="button"
                            onClick={handleOpenFolder}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] rounded-lg transition-colors cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                            <span>{t("workbench.openFolder")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setWorkspacePath("");
                              setIsProjectOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] rounded-lg transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                              <span>{t("workbench.outsideWorkspace")}</span>
                            </div>
                            {!workspacePath && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. Permission Indicator: Scheduled tasks run unattended with Full Access (Info button in white) */}
                    <div className="relative" ref={accessInfoRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccessInfoOpen((prev) => !prev);
                          setIsProjectOpen(false);
                          setIsModelOpen(false);
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-white hover:text-white transition-colors cursor-pointer"
                        title={t("scheduledTasks.fullAccessDesc")}
                        aria-label="Full access info"
                      >
                        <Info className="w-3.5 h-3.5 text-white" />
                      </button>

                      {isAccessInfoOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-2.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-white mb-1">
                            <Info className="w-3.5 h-3.5 text-white shrink-0" />
                            <span>{t("workbench.modeFullAccess")}</span>
                          </div>
                          <p className="text-[11px] text-[#969696] leading-relaxed">
                            {t("scheduledTasks.fullAccessDesc")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Model Selector (exact ChatCard pattern) */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelOpen((prev) => !prev);
                        setIsProjectOpen(false);
                        setIsAccessInfoOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>{models.find((m) => m.name === selectedModel || m.id === selectedModel)?.name || selectedModel || "Gemini 3.8 Flash"}</span>
                      <ChevronDown className="w-3 h-3 text-[#969696] ml-0.5" />
                    </button>

                    {isModelOpen && (
                      <div className="absolute bottom-full mb-2 right-0 w-72 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-2 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium tracking-wider text-[#969696] border-b border-[#383838] mb-1">
                          <span className="uppercase tracking-wider">{t("workbench.models")}</span>
                          {quota && (
                            <span className="text-[10px] text-[#4ade80] font-sans tabular-nums">
                              {t("workbench.tokensLeft").replace("{tokens}", formatTokenDisplay(quota.remainingTokens))}
                            </span>
                          )}
                        </div>

                        <ScrollArea className="max-h-56 pr-1" thumbClassName="bg-white/20 hover:bg-white/30">
                          <div className="flex flex-col gap-1 pr-0.5">
                            {groupedModels.map((group) => {
                              const isExpanded = Boolean(expandedProviders[group.providerId]);
                              return (
                                <div key={group.providerId} className="flex flex-col">
                                  {isExpanded && (
                                    <div className="pl-2.5 pr-1 py-0.5 border-l border-[#383838] ml-2 mb-1 flex flex-col gap-0.5">
                                      {group.items.map((m) => {
                                        const isSelected =
                                          selectedModel === m.name || selectedModel === m.id;
                                        return (
                                          <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedModel(m.name);
                                              setIsModelOpen(false);
                                            }}
                                            className={`w-full px-2 py-1.5 flex items-center justify-between text-xs rounded-lg transition-colors cursor-pointer ${
                                              isSelected
                                                ? "bg-[#2b2b2b] text-white font-medium"
                                                : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                                            }`}
                                          >
                                            <span className="truncate">{m.name}</span>
                                            {isSelected && (
                                              <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedProviders((prev) => ({
                                        ...prev,
                                        [group.providerId]: !prev[group.providerId],
                                      }))
                                    }
                                    className="w-full px-2 py-1 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] rounded-lg transition-colors cursor-pointer"
                                  >
                                    <span>{group.providerName}</span>
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-[#969696]" />
                                    ) : (
                                      <ChevronUp className="w-3.5 h-3.5 text-[#969696]" />
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Custom Repeat Modal */}
      {showCustomModal && (
        <CustomRepeatModal
          initialConfig={customConfig}
          onConfirm={(cfg) => {
            setCustomConfig(cfg);
            setShowCustomModal(false);
          }}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </>
  );
}
