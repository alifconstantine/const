import React, { useState } from "react";
import { Loader2, ChevronDown, Square } from "lucide-react";
import { cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type { BackgroundTaskItem } from "../../vite-env";

export interface AttachedTaskBannerProps {
  tasks: BackgroundTaskItem[];
  onSelectTask: (task: BackgroundTaskItem) => void;
  onStopTask: (taskId: string) => void;
  className?: string;
}

export function AttachedTaskBanner({
  tasks,
  onSelectTask,
  onStopTask,
  className = "",
}: AttachedTaskBannerProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!tasks || tasks.length === 0) return null;

  return (
    <div
      className={cn(
        "w-full bg-[#f8f8f8] dark:bg-[#1e1e1e] border-b border-[#e2e2e4] dark:border-[#383838] px-3.5 py-2 select-none font-sans text-xs flex flex-col gap-1.5 rounded-t-xl transition-all",
        className
      )}
    >
      {/* Header matching Image 3: "1 task running ⌄" */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 cursor-pointer py-0.5"
      >
        <span className="font-medium text-xs">
          {tasks.length} {tasks.length === 1 ? t("workbench.taskRunning") : t("workbench.tasksRunning")}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </div>

      {/* Task List */}
      {isExpanded && (
        <div className="flex flex-col gap-1 pt-0.5">
          {tasks.map((task) => {
            const isRunning = task.status === "running";
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="group flex items-center justify-between px-2.5 py-1.5 rounded bg-white dark:bg-[#282828] hover:bg-neutral-100 dark:hover:bg-[#333333] border border-[#e2e2e4] dark:border-[#383838] cursor-pointer transition-colors"
                title={t("workbench.viewInSidebar")}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-neutral-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs text-[#1c1c1e] dark:text-[#d4d4d4] group-hover:text-black dark:group-hover:text-white truncate">
                    {task.command}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400">
                    {t("workbench.viewInSidebar")}
                  </span>
                  {isRunning && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopTask(task.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                      title={t("workbench.terminateTask")}
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
