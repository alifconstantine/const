import React, { useState } from "react";
import {
  RotateCw,
  Plus,
  Play,
  Info,
  Compass,
  ShieldAlert,
  FileCode2,
  BookOpen,
} from "lucide-react";
import type { ScheduledTaskItem, ScheduledTaskSchedule } from "../../vite-env";
import { useTranslation } from "../../lib/i18n";

export interface StarterTemplate {
  title: string;
  description: string;
  instructions: string;
  schedule: ScheduledTaskSchedule;
  scheduleLabel: string;
  permissionPreset: "ask_before_changes" | "full_access" | "read-only" | "workspace-write" | "danger-full-access";
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    title: "Morning dev brief",
    description:
      "Summarize commits, module changes, CI status, and follow-ups since the previous workday, then produce no more than...",
    instructions:
      "Summarize commits, module changes, CI status, and follow-ups since the previous workday. Review repository history, flag any broken builds or failing tests, and highlight outstanding items.",
    schedule: { type: "weekdays", time: "09:00" },
    scheduleLabel: "Every weekday at 09:00",
    permissionPreset: "full_access",
  },
  {
    title: "Risk scan",
    description:
      "Inspect code changes from the last 24 hours for high-confidence risks involving runtime failures, data loss...",
    instructions:
      "Inspect git commits and pull requests from the last 24 hours. Analyze modified code paths for potential security vulnerabilities, regressions, data loss risks, or missing test coverage.",
    schedule: { type: "daily", time: "10:00" },
    scheduleLabel: "Daily at 10:00",
    permissionPreset: "full_access",
  },
  {
    title: "Release brief",
    description:
      "Organize PRs and commits merged this week into Features, Fixes, Experience improvements, and Engineering...",
    instructions:
      "Organize all pull requests and commits merged this week into clear changelog categories: Features, Bug Fixes, User Experience Improvements, and Internal Engineering. Prepare draft release notes.",
    schedule: { type: "weekly", dayOfWeek: 5, time: "16:00" },
    scheduleLabel: "Weekly on Fri at 16:00",
    permissionPreset: "full_access",
  },
  {
    title: "Documentation sync check",
    description:
      "Compare code, configuration, API, and documentation changes from the last seven days. Identify high-confidence...",
    instructions:
      "Compare recent code, configuration, and API modifications over the last seven days against the documentation in docs/ and README. Identify any outdated docs, missing parameter descriptions, or broken examples.",
    schedule: { type: "weekly", dayOfWeek: 3, time: "15:00" },
    scheduleLabel: "Weekly on Wed at 15:00",
    permissionPreset: "full_access",
  },
];

export interface ScheduledTasksDashboardProps {
  tasks: ScheduledTaskItem[];
  onCreateNew: () => void;
  onSelectTemplate: (template: StarterTemplate) => void;
  onSelectTask: (task: ScheduledTaskItem) => void;
  onRunNow: (taskId: string) => void;
  onRefresh?: () => void;
}

export function ScheduledTasksDashboard({
  tasks,
  onCreateNew,
  onSelectTemplate,
  onSelectTask,
  onRunNow,
  onRefresh,
}: ScheduledTasksDashboardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [keepAwake, setKeepAwake] = useState(() => {
    return localStorage.getItem("const_harness_keep_awake") !== "false";
  });

  const handleToggleKeepAwake = () => {
    setKeepAwake((prev) => {
      const next = !prev;
      localStorage.setItem("const_harness_keep_awake", String(next));
      return next;
    });
  };

  const formatSchedule = (schedule?: ScheduledTaskSchedule): string => {
    if (!schedule) return "No schedule";
    const type = schedule.type || (schedule as any).kind || "daily";
    switch (type) {
      case "hourly":
        return "Hourly";
      case "daily":
        return `Daily at ${schedule.time ?? "09:00"}`;
      case "weekdays":
        return `Weekdays at ${schedule.time ?? "09:00"}`;
      case "weekly": {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const day = days[schedule.dayOfWeek ?? 1];
        return `Weekly on ${day} at ${schedule.time ?? "09:00"}`;
      }
      case "monthly":
        return `Monthly on day ${schedule.dayOfMonth ?? 1} at ${schedule.time ?? "09:00"}`;
      case "custom":
        return `Every ${schedule.customInterval ?? 1} ${schedule.customUnit ?? "days"}`;
      default:
        return "Custom";
    }
  };

  const formatNextRunRelative = (nextRunAt?: number | string): string => {
    if (!nextRunAt) return "";
    const targetMs = typeof nextRunAt === "string" ? Date.parse(nextRunAt) : nextRunAt;
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return "due now";
    const diffHours = Math.round(diffMs / (1000 * 3600));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return `Next run in ${diffMins}m`;
    }
    if (diffHours < 24) {
      return `Next run in ${diffHours}h`;
    }
    const diffDays = Math.round(diffHours / 24);
    return `Next run in ${diffDays}d`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-7 flex flex-col select-none">
      {/* Page Heading & Actions */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">{t("scheduledTasks.title")}</h1>
          <p className="text-[13px] text-[#969696]">
            {t("scheduledTasks.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {onRefresh && (
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
              onClick={onRefresh}
              title={t("common.refresh")}
              aria-label={t("common.refresh")}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#161616] bg-[#d4d4d4] hover:bg-white transition-colors cursor-pointer h-8"
            onClick={onCreateNew}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("scheduledTasks.newTask")}</span>
          </button>
        </div>
      </div>

      {/* Info / Keep Awake Banner */}
      <div className="flex items-center justify-between bg-[#222222] border border-[#383838] rounded-xl px-4 py-3 mb-8">
        <div className="flex items-center gap-2.5 text-xs text-[#d4d4d4]">
          <Info className="w-4 h-4 text-[#969696] shrink-0" />
          <span>{t("scheduledTasks.keepAwake")}</span>
        </div>
        <button
          type="button"
          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer border ${
            keepAwake ? "bg-[#0066ff] border-[#0066ff]" : "bg-[#2b2b2b] border-[#383838]"
          }`}
          onClick={handleToggleKeepAwake}
          aria-label="Toggle keep awake"
        >
          <div
            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform ${
              keepAwake ? "translate-x-4 bg-white" : "bg-[#969696]"
            }`}
          />
        </button>
      </div>

      {/* Task Created Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-semibold text-white tracking-tight">{t("scheduledTasks.title")}</h2>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-[#222222] border border-dashed border-[#383838] rounded-xl p-8 text-center text-[#969696] text-xs flex flex-col gap-1">
            <span>{t("scheduledTasks.noTasks")}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tasks.map((task) => {
              const scheduleText = formatSchedule(task.schedule);
              const relTime = formatNextRunRelative(task.nextRunAt);
              const badgeText = relTime ? `${scheduleText} · ${relTime}` : scheduleText;
              const title = task.name || task.title;
              const promptText = task.prompt || task.instructions;

              return (
                <div
                  key={task.id}
                  className="bg-[#222222] hover:bg-[#262626] border border-[#383838] hover:border-[#484848] rounded-xl p-4 transition-colors cursor-pointer flex flex-col gap-2.5"
                  onClick={() => onSelectTask(task)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
                        onClick={() => onRunNow(task.id)}
                        title={t("scheduledTasks.runNow")}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t("scheduledTasks.runNow")}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#969696] line-clamp-2 leading-relaxed">
                    {promptText}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[#1b1b1b] border border-[#2e2e2e] text-[#d4d4d4]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{badgeText}</span>
                      </span>
                    </div>

                    <span className="text-[11px] text-[#5d5d5d]">
                      {task.runCount > 0
                        ? t("scheduledTasks.ranTimes").replace("{count}", String(task.runCount))
                        : t("scheduledTasks.notRunYet")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheduled Task Template Section */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-semibold text-white tracking-tight">{t("scheduledTasks.scheduledTemplateTitle")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {STARTER_TEMPLATES.map((tmpl, idx) => (
            <div
              key={tmpl.title}
              className="bg-[#222222] hover:bg-[#262626] border border-[#383838] hover:border-[#484848] rounded-xl p-4 transition-colors cursor-pointer flex flex-col justify-between min-h-[130px]"
              onClick={() => onSelectTemplate(tmpl)}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#969696]">
                    {idx === 0 && <Compass className="w-4 h-4" />}
                    {idx === 1 && <ShieldAlert className="w-4 h-4" />}
                    {idx === 2 && <FileCode2 className="w-4 h-4" />}
                    {idx === 3 && <BookOpen className="w-4 h-4" />}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{tmpl.title}</h3>
                </div>

                <p className="text-xs text-[#969696] line-clamp-2 leading-relaxed mb-3">
                  {tmpl.description}
                </p>
              </div>
              <div className="self-start text-[11px] text-[#5d5d5d] bg-[#1b1b1b] border border-[#2e2e2e] rounded px-2 py-0.5">
                {tmpl.scheduleLabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
