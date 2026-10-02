import React, { useState } from "react";
import { ArrowLeft, Play, Trash2, ExternalLink } from "lucide-react";
import type { ScheduledTaskItem, ScheduledTaskRunHistory } from "../../vite-env";

export interface ScheduledTaskHistoryProps {
  task: ScheduledTaskItem;
  historyList: ScheduledTaskRunHistory[];
  onRunNow: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onDeleteRun: (runId: string) => void;
  onBack: () => void;
  onSwitchToSettings: () => void;
}

export function ScheduledTaskHistory({
  task,
  historyList,
  onRunNow,
  onDeleteTask,
  onOpenSession,
  onBack,
  onSwitchToSettings,
}: ScheduledTaskHistoryProps): React.JSX.Element {
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
  const taskTitle = task.name || task.title;

  return (
    <>
      {/* Top-Left Corner Breadcrumb Navigation */}
      <div className="absolute top-3.5 left-6 z-20 flex items-center gap-1.5 text-[13px] select-none">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[#969696] hover:text-white hover:bg-[#222222] px-2 py-1 rounded-md transition-colors cursor-pointer"
          onClick={onBack}
          title="Back to Scheduled Tasks"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Scheduled Tasks</span>
        </button>
        <span className="text-[#5d5d5d] select-none">/</span>
        <span className="text-[#d4d4d4] font-medium px-1 truncate max-w-[200px]">{taskTitle}</span>
      </div>

      <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 py-12 flex flex-col select-none">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Edit scheduled task</h1>
          <p className="text-[13px] text-[#969696]">
            Adjust when this task runs, what it does, and how it works.
          </p>
        </div>

        {/* Sub-tabs & Top Actions */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center bg-[#222222] border border-[#383838] rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-[13px] font-medium text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer"
              onClick={onSwitchToSettings}
            >
              Settings
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[#2b2b2b] text-white cursor-default"
            >
              History
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
              onClick={() => onRunNow(task.id)}
              title="Run Now"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] hover:border-rose-900 text-[#969696] hover:text-rose-400 transition-colors cursor-pointer"
              onClick={() => {
                if (window.confirm(`Delete "${taskTitle}"?`)) {
                  onDeleteTask(task.id);
                }
              }}
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* History Content */}
        <div className="flex flex-col gap-4">
          {historyList.length === 0 ? (
            <div className="bg-[#222222] border border-dashed border-[#383838] rounded-xl p-10 text-center text-[#969696] text-xs">
              <span>No runs yet.</span>
            </div>
          ) : (
            <>
              <div className="bg-[#222222] border border-[#383838] rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#1b1b1b] border-b border-[#383838]">
                      <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                        Triggered
                      </th>
                      <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3.5 py-2.5 text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                        Duration
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
                            if (sid) onOpenSession(sid);
                          }}
                          title={sid ? "Click to open dedicated chat session" : undefined}
                        >
                          <td className="px-3.5 py-3 text-[#d4d4d4]">
                            {formatTimestamp(timeStr)}
                          </td>
                          <td className="px-3.5 py-3 text-[#969696]">
                            {run.source === "scheduled" ? "Scheduled" : "Manual"}
                          </td>
                          <td className="px-3.5 py-3">
                            {run.status === "completed" && (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Succeeded</span>
                              </span>
                            )}
                            {run.status === "failed" && (
                              <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Failure</span>
                              </span>
                            )}
                            {run.status === "skipped" && (
                              <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Skipped</span>
                              </span>
                            )}
                            {run.status === "in-progress" && (
                              <span className="inline-flex items-center gap-1.5 text-blue-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span>Running</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-[#d4d4d4] font-sans tabular-nums">
                            {formatDuration(run.durationMs)}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {sid && (
                              <button
                                type="button"
                                className="p-1 rounded text-[#969696] hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenSession(sid);
                                }}
                                title="Open chat session"
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
                    className="px-2.5 py-1 rounded-md text-xs bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] text-[#d4d4d4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    &larr; Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`min-w-6 h-6 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
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
                    className="px-2.5 py-1 rounded-md text-xs bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] text-[#d4d4d4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
