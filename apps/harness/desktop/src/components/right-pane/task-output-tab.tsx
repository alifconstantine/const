import React, { useState, useEffect, useRef } from "react";
import { Terminal, Square, Loader2 } from "lucide-react";
import type { RightPaneTab } from "./types";
import type { BackgroundTaskItem } from "../../vite-env";
import { useTranslation } from "../../lib/i18n";
import { ScrollArea, toast } from "@const/ui";

const MAX_LOG_LINES = 3000;

interface TaskOutputTabProps {
  tab: RightPaneTab;
  onStopTask?: (taskId: string, conversationId?: string) => void | Promise<void>;
}

export function TaskOutputTab({ tab, onStopTask }: TaskOutputTabProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<BackgroundTaskItem["status"]>();
  const isRunning = status === "running";
  const statusText = status === "running" ? t("common.running")
    : status === "completed" ? t("common.completed")
    : status === "failed" ? t("common.failed")
    : status === "killed" ? t("common.stopped") : "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const taskId = tab.taskId || tab.id;

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let ready = false;
    let sawStatusEvent = false;
    let pending: string[] = [];
    let pendingRevision: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLogs([]);
    setStatus(undefined);
    const conversationId = tab.conversationId;
    if (!conversationId) return;
    const flush = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const remaining = pendingRevision === undefined ? pending.length : Math.max(0, pendingRevision - revision);
      const newLines = remaining > 0 ? pending.slice(-remaining) : [];
      if (pendingRevision !== undefined) revision = Math.max(revision, pendingRevision);
      pending = [];
      pendingRevision = undefined;
      if (newLines.length) setLogs(previous => [...previous, ...newLines].slice(-MAX_LOG_LINES));
    };
    const unsubscribe = window.electron?.onBackgroundTaskEvent?.(event => {
      if (event.taskId !== taskId || event.conversationId !== conversationId) return;
      if (event.type === "output" && event.data !== undefined) {
        pending.push(...event.data.split("\n"));
        if (pending.length > MAX_LOG_LINES) pending = pending.slice(-MAX_LOG_LINES);
        pendingRevision = event.outputRevision;
        if (ready && timer === undefined) timer = setTimeout(flush, 75);
      } else if (event.type === "status" && event.status) {
        sawStatusEvent = true;
        if (ready) flush();
        setStatus(event.status);
      }
    });
    void (async () => {
      try {
        const snapshot = await window.electron?.getBackgroundTaskLogSnapshot?.(taskId, conversationId);
        if (disposed) return;
        if (snapshot && !Array.isArray(snapshot)) {
          setLogs(snapshot.logs.slice(-MAX_LOG_LINES));
          revision = snapshot.outputRevision;
          if (!sawStatusEvent) setStatus(snapshot.status);
        } else {
          const initialLogs = Array.isArray(snapshot) ? snapshot : await window.electron?.getBackgroundTaskLogs?.(taskId, conversationId);
          if (!disposed && initialLogs) setLogs(initialLogs.slice(-MAX_LOG_LINES));
          const tasks = await window.electron?.listBackgroundTasks?.(conversationId);
          if (!disposed && !sawStatusEvent) setStatus(tasks?.find(task => task.id === taskId)?.status);
        }
      } catch {
        // Live output remains usable if the initial snapshot cannot be loaded.
      } finally {
        if (!disposed) { ready = true; flush(); }
      }
    })();
    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [taskId, tab.conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStop = async () => {
    try {
      if (onStopTask) await onStopTask(taskId, tab.conversationId);
      else if (tab.conversationId && await window.electron?.killBackgroundTask?.(taskId, tab.conversationId)) setStatus("killed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  };

  const command = tab.command || tab.title || t("rightPane.taskOutput");

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
          ) : null}
        </div>
      </div>

      <ScrollArea
        viewportRef={scrollRef}
        className="flex-1 min-h-0 w-full font-mono text-xs leading-relaxed select-text"
        viewportClassName="p-4"
      >
        <div className="text-[#888888] pb-2 mb-2 border-b border-[#222222] flex items-center justify-between">
          <span>$ {command}</span>
          <span className="text-[11px] text-[#555555]">
            {statusText}
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
      </ScrollArea>
    </div>
  );
}
