import React, { useState } from "react";
import { Play, Trash2, ExternalLink } from "lucide-react";
import type { ScheduledTaskItem, ScheduledTaskRunHistory } from "../../vite-env";
import { SegmentedToggle } from "./segmented-toggle";
import { useTranslation } from "../../lib/i18n";

export interface ScheduledTaskHistoryContentProps {
  historyList: ScheduledTaskRunHistory[];
  onOpenSession?: (sessionId: string) => void;
  onDeleteRun?: (runId: string) => void;
}

export function ScheduledTaskHistoryContent({
  historyList,
  onOpenSession,
}: ScheduledTaskHistoryContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const formatDuration = (ms?: number): string => {
    if (ms === undefined) return "0s";
    if (ms < 1000) return `${ms}ms`;
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
  };

  const formatTimestamp = (ts: number | string): string => {
    try {
      const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const hr = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${yr}-${mo}-${da} ${hr}:${mi}`;
    } catch {
      return String(ts);
    }
  };

  const totalPages = Math.max(1, Math.ceil(historyList.length / pageSize));
  const paginatedList = historyList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (historyList.length === 0) {
    return (
      <div className="bg-[#222222] border border-dashed border-[#383838] rounded-xl p-10 text-center text-[#969696] text-xs">
        <span>{t("scheduledTasks.noHistory")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#222222] border border-[#383838] rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#1b1b1b] border-b border-[#383838]">
              <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                {t("common.triggered")}
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                {t("common.source")}
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                {t("common.status")}
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                {t("common.duration")}
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((run) => {
              const sid = run.sessionId || run.conversationId;
              const timeStr = (run as any).triggeredAt || run.startedAt;
              return (
                <tr
                  key={run.id}
                  className="hover:bg-[#262626] border-b border-[#2e2e2e] last:border-b-0 transition-colors cursor-pointer"
                  onClick={() => {
                    if (sid && onOpenSession) onOpenSession(sid);
                  }}
                  title={sid ? t("scheduledTasks.clickToOpenSession") : undefined}
                >
                  <td className="px-3.5 py-3 text-[#d4d4d4]">
                    {formatTimestamp(timeStr)}
                  </td>
                  <td className="px-3.5 py-3 text-[#969696]">
                    {run.source === "scheduled" ? t("common.scheduled") : t("common.manual")}
                  </td>
                  <td className="px-3.5 py-3">
                    {run.status === "completed" && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{t("common.succeeded")}</span>
                      </span>
                    )}
                    {run.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>{t("common.failure")}</span>
                      </span>
                    )}
                    {run.status === "skipped" && (
                      <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{t("common.skipped")}</span>
                      </span>
                    )}
                    {run.status === "in-progress" && (
                      <span className="inline-flex items-center gap-1.5 text-blue-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span>{t("common.running")}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-[#d4d4d4] font-sans tabular-nums">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {sid && onOpenSession && (
                      <button
                        type="button"
                        className="p-1 rounded text-[#969696] hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSession(sid);
                        }}
                        title={t("scheduledTasks.clickToOpenSession")}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="h-8 px-3 rounded-lg text-xs bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] text-[#d4d4d4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-1"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <span>&larr;</span>
            <span>{t("common.previous")}</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`min-w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer ${
                  p === currentPage
                    ? "bg-[#2b2b2b] border border-[#383838] text-white font-medium"
                    : "text-[#969696] hover:text-white hover:bg-[#222222]"
                }`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="h-8 px-3 rounded-lg text-xs bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] text-[#d4d4d4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-1"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <span>{t("common.next")}</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}

export interface ScheduledTaskHistoryProps {
  task: ScheduledTaskItem;
  historyList: ScheduledTaskRunHistory[];
  onRunNow: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onDeleteRun?: (runId: string) => void;
  onBack: () => void;
  onSwitchToSettings: () => void;
}

export function ScheduledTaskHistory({
  task,
  historyList,
  onRunNow,
  onDeleteTask,
  onOpenSession,
  onDeleteRun,
  onSwitchToSettings,
}: ScheduledTaskHistoryProps): React.JSX.Element {
  const { t } = useTranslation();
  const taskTitle = task.name || task.title;

  return (
    <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 py-12 flex flex-col select-none">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">{t("common.edit")}</h1>
        <p className="text-[13px] text-[#969696]">
          {t("scheduledTasks.subtitle")}
        </p>
      </div>

      {/* Sub-tabs & Top Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <SegmentedToggle
          value="history"
          onChange={(tab) => {
            if (tab === "settings") {
              onSwitchToSettings();
            }
          }}
          options={[
            { id: "settings", label: t("sidebar.settings") },
            { id: "history", label: t("scheduledTasks.history") },
          ]}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
            onClick={() => onRunNow(task.id)}
            title={t("scheduledTasks.runNow")}
            aria-label={t("scheduledTasks.runNow")}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-rose-900 text-[#969696] hover:text-rose-400 transition-colors cursor-pointer"
            onClick={() => {
              if (window.confirm(t("scheduledTasks.deleteTaskConfirm").replace("{title}", taskTitle || ""))) {
                onDeleteTask(task.id);
              }
            }}
            title={t("scheduledTasks.deleteScheduledTask")}
            aria-label={t("scheduledTasks.deleteScheduledTask")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* History Content */}
      <ScheduledTaskHistoryContent
        historyList={historyList}
        onOpenSession={onOpenSession}
        onDeleteRun={onDeleteRun}
      />
    </div>
  );
}
