import React, { useState, useEffect, useRef } from "react";
import { Terminal, Square, Loader2 } from "lucide-react";
import type { RightPaneTab } from "./types";
import { useTranslation } from "../../lib/i18n";

interface TaskOutputTabProps {
  tab: RightPaneTab;
  onStopTask?: (taskId: string) => void;
}

export function TaskOutputTab({ tab, onStopTask }: TaskOutputTabProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taskId = tab.taskId || tab.id;

  useEffect(() => {
    if (window.electron?.getBackgroundTaskLogs && taskId) {
      window.electron.getBackgroundTaskLogs(taskId).then((initialLogs) => {
        if (initialLogs && initialLogs.length > 0) {
          setLogs(initialLogs);
        }
      });
    }

    if (window.electron?.listBackgroundTasks) {
      window.electron.listBackgroundTasks().then((tasks) => {
        const found = tasks.find((t) => t.id === taskId);
        if (found) {
          setIsRunning(found.status === "running");
        }
      });
    }

    if (window.electron?.onBackgroundTaskEvent) {
      const unsubscribe = window.electron.onBackgroundTaskEvent((event) => {
        if (event.taskId === taskId) {
          if (event.type === "output" && event.data !== undefined) {
            setLogs((prev) => {
              const next = [...prev, event.data!];
              return next.length > 3000 ? next.slice(-3000) : next;
            });
          } else if (event.type === "status") {
            if (event.status === "completed" || event.status === "failed") {
              setIsRunning(false);
            }
          }
        }
      });
      return () => unsubscribe();
    }
  }, [taskId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStop = async () => {
    if (window.electron?.killBackgroundTask && taskId) {
      await window.electron.killBackgroundTask(taskId);
      setIsRunning(false);
      onStopTask?.(taskId);
    }
  };

  const command = tab.command || tab.title || "Background Task";

  return (
    <div className="flex-1 w-full h-full bg-[#141414] text-[#d4d4d4] flex flex-col min-h-0 font-sans select-none">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#262626] bg-[#1a1a1a]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-semibold text-[#888888]">{t("rightPane.taskOutput")}</span>
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 text-[#0066ff] animate-spin shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#5d5d5d] shrink-0" />
            )}
            <span className="text-sm font-mono font-medium text-white truncate">
              {command}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e81123]/15 hover:bg-[#e81123]/25 text-[#ff6b6b] border border-[#e81123]/30 text-xs font-medium transition-colors cursor-pointer"
              title={t("rightPane.stopTask")}
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{t("rightPane.stopTask")}</span>
            </button>
          ) : (
            <span className="text-xs text-[#777777] px-2 py-0.5 rounded bg-white/5">
              {t("rightPane.taskStopped")}
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 w-full p-4 overflow-y-auto font-mono text-xs leading-relaxed select-text"
      >
        <div className="text-[#888888] pb-2 mb-2 border-b border-[#222222] flex items-center justify-between">
          <span>$ {command}</span>
          <span className="text-[11px] text-[#555555]">
            {isRunning ? t("common.active") : t("rightPane.taskStopped")}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-4 text-[#666666] italic">
            {t("rightPane.noOutputLogs")}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {logs.map((line, idx) => (
              <div key={idx} className="flex gap-4 items-start group hover:bg-white/[0.02]">
                <span className="text-[#555555] select-none text-right min-w-[24px] shrink-0">
                  {idx + 1}
                </span>
                <span className="text-[#d4d4d4] break-all whitespace-pre-wrap flex-1">
                  {line}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}