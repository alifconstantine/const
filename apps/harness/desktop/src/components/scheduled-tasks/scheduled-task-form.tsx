import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Folder,
  FolderPlus,
  MessageSquare,
  Search,
  Check,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Settings,
  Trash2,
  Plus,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { ScheduledTaskItem, ScheduledTaskSchedule } from "../../vite-env";
import { CustomDropdown } from "./custom-dropdown";
import { TimePicker } from "./time-picker";
import { DayPickerGrid } from "./day-picker-grid";
import { CustomRepeatModal, type CustomRepeatConfig } from "./custom-repeat-modal";

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
  isEditing?: boolean;
  onSubmit: (data: ScheduledTaskFormData) => void;
  onCancel: () => void;
  onSwitchToHistory?: () => void;
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
  isEditing = false,
  onSubmit,
  onCancel,
  onSwitchToHistory,
}: ScheduledTaskFormProps): React.JSX.Element {
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

  // 2. Permission Mode: Scheduled tasks run unattended with full access
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
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      desc: "Hybrid frontier reasoning model",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      desc: "Frontier multimodal reasoning & code generation",
      provider: "const",
      providerName: "Const",
      supportsThinking: true,
    },
    {
      id: "qwen-3.8-27b",
      name: "Qwen 3.8 27B",
      desc: "Open-weight reasoning powerhouse with deep thinking capabilities",
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
    if (!saved || saved === "Const" || saved === "gemini-3.6-flash") return "Gemini 3.8 Flash";
    if (saved === "gemini-3.8-flash") return "Gemini 3.8 Flash";
    if (saved === "gemini-3.7-flash") return "Gemini 3.7 Flash";
    return saved;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [activeSubTab, setActiveSubTab] = useState<"settings" | "history">("settings");

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
            if (!current || current === "gemini-3.8-flash" || current === "gemini-3.6-flash") {
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
      return "Work outside a project";
    }
    return workspacePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || workspacePath;
  }, [workspacePath]);

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
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekdays", label: "Weekdays" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "custom", label: "Custom" },
  ];

  const weekDayOptions = [
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
    { value: "0", label: "Sunday" },
  ];

  const getSummaryText = (): string => {
    if (!hasSchedule) return "No schedule";
    switch (scheduleType) {
      case "hourly":
        return "Every hour";
      case "daily":
        return `Every day at ${scheduleTime}`;
      case "weekdays":
        return `Every weekday at ${scheduleTime}`;
      case "weekly": {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return `Weekly on ${days[scheduleDayOfWeek]} at ${scheduleTime}`;
      }
      case "monthly":
        return `Monthly on day ${scheduleDayOfMonth} at ${scheduleTime}`;
      case "custom":
        return `Every ${customConfig.frequency} ${customConfig.unit} at ${scheduleTime}`;
      default:
        return "Custom";
    }
  };

  return (
    <>
      {/* Top-Left Corner Breadcrumb Navigation */}
      <div className="absolute top-3.5 left-6 z-20 flex items-center gap-1.5 text-[13px] select-none">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[#969696] hover:text-white hover:bg-[#222222] px-2 py-1 rounded-md transition-colors cursor-pointer"
          onClick={onCancel}
          title="Back to Scheduled Tasks"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Scheduled Tasks</span>
        </button>
        <span className="text-[#5d5d5d] select-none">/</span>
        <span className="text-[#d4d4d4] font-medium px-1">
          {isEditing ? name || "Edit task" : "New task"}
        </span>
      </div>

      {/* Main Page Content */}
      <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 py-12 flex flex-col select-none">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">
            {isEditing ? "Edit scheduled task" : "New scheduled task"}
          </h1>
          <p className="text-[13px] text-[#969696]">
            Configure when this task runs, what it does, and how it works.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center bg-[#222222] border border-[#383838] rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                activeSubTab === "settings"
                  ? "bg-[#2b2b2b] text-white"
                  : "text-[#969696] hover:text-[#d4d4d4]"
              }`}
              onClick={() => setActiveSubTab("settings")}
            >
              Settings
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                activeSubTab === "history"
                  ? "bg-[#2b2b2b] text-white"
                  : "text-[#969696] hover:text-[#d4d4d4]"
              }`}
              onClick={() => {
                if (isEditing && onSwitchToHistory) {
                  onSwitchToHistory();
                } else {
                  setActiveSubTab("history");
                }
              }}
            >
              History
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] transition-colors cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </button>
            {activeSubTab === "settings" && (
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#161616] bg-[#d4d4d4] hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => handleSubmit()}
                disabled={!name.trim() || !prompt.trim()}
              >
                {isEditing ? "Save changes" : "Create scheduled task"}
              </button>
            )}
          </div>
        </div>

        {/* If History sub-tab active on a new task with no runs yet */}
        {activeSubTab === "history" ? (
          <div className="bg-[#222222] border border-dashed border-[#383838] rounded-xl p-10 text-center text-[#969696] text-xs">
            <span>No runs yet.</span>
          </div>
        ) : (
          /* Form Fields */
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Field: Task Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">Task title</label>
              <input
                type="text"
                className="w-full bg-[#2b2b2b] border border-[#383838] rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-[#5d5d5d] placeholder:text-[#5d5d5d] transition-colors"
                placeholder="Untitled Scheduled Task"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Field: Schedule Bar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">Schedule</label>
              {!hasSchedule ? (
                <div
                  className="inline-flex items-center gap-2 bg-[#222222] hover:bg-[#262626] border border-dashed border-[#383838] hover:border-[#5d5d5d] text-[#969696] hover:text-white rounded-lg px-3.5 py-2 text-xs transition-colors cursor-pointer w-fit"
                  onClick={() => setHasSchedule(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add schedule</span>
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
                          Every {customConfig.frequency} {customConfig.unit}
                        </span>
                        <ChevronDown className="w-3 h-3 text-[#969696]" />
                      </button>
                    )}

                    {/* If Weekly: Day dropdown */}
                    {scheduleType === "weekly" && (
                      <>
                        <span className="text-xs text-[#969696]">on</span>
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
                        <span className="text-xs text-[#969696]">day</span>
                        <DayPickerGrid
                          value={scheduleDayOfMonth}
                          onChange={setScheduleDayOfMonth}
                        />
                      </>
                    )}

                    {/* Time picker for non-hourly */}
                    {scheduleType !== "hourly" && (
                      <>
                        <span className="text-xs text-[#969696]">at</span>
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
                    title="Remove schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Field: Instructions with Bottom Toolbar (Workspace, Permission, Model - exactly matching ChatCard) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#969696]">Instructions</label>
              <div className="bg-[#2b2b2b] border border-[#383838] rounded-xl overflow-hidden focus-within:border-[#5d5d5d] transition-colors flex flex-col">
                <textarea
                  className="w-full min-h-[140px] bg-transparent text-[13px] text-white placeholder:text-[#5d5d5d] p-3 outline-none resize-y font-sans leading-relaxed"
                  placeholder="e.g. Review commits from the last 24 hours and summarize likely bugs and fixes"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                />

                {/* Embedded Toolbar matching ChatCard */}
                <div className="flex items-center justify-between p-2 bg-[#222222] border-t border-[#383838] gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Workspace / Project Selector (exact ChatCard pattern) */}
                    <div className="relative" ref={projectMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProjectOpen((prev) => !prev);
                          setIsModelOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
                        title={workspacePath || "Work outside a project"}
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
                                  placeholder="Search workspaces"
                                  className="w-full bg-transparent text-xs text-white placeholder:text-[#5d5d5d] outline-none"
                                  autoFocus
                                />
                              </div>

                              <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 py-0.5">
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

                              <div className="h-[1px] bg-[#383838] my-1" />
                            </>
                          )}

                          <button
                            type="button"
                            onClick={handleOpenFolder}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] rounded-lg transition-colors cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                            <span>Open folder</span>
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
                              <span>Work outside a project</span>
                            </div>
                            {!workspacePath && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. Permission Indicator: Scheduled tasks run unattended with Full Access */}
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] border bg-[#2b2b2b] border-[#e79737]/40 text-[#e79737] select-none"
                      title="Scheduled tasks run autonomously in the background with Full Access"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-[#e79737]" />
                      <span>Full access</span>
                    </div>
                  </div>

                  {/* 3. Model Selector (exact ChatCard pattern) */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelOpen((prev) => !prev);
                        setIsProjectOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>{models.find((m) => m.name === selectedModel || m.id === selectedModel)?.name || selectedModel || "Gemini 3.8 Flash"}</span>
                      <ChevronDown className="w-3 h-3 text-[#969696] ml-0.5" />
                    </button>

                    {isModelOpen && (
                      <div className="absolute bottom-full mb-2 right-0 w-72 bg-[#222222] border border-[#383838] rounded-xl shadow-2xl p-2 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium tracking-wider text-[#969696] border-b border-[#383838] mb-1">
                          <span className="uppercase tracking-wider">Models</span>
                          {quota && (
                            <span className="text-[10px] text-[#4ade80] font-mono">
                              {formatTokenDisplay(quota.remainingTokens)} left
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-0.5">
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
