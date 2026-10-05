import React, { useState, useEffect, useRef } from "react";
import {
  Layers2,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  X,
} from "lucide-react";
import type { SubAgentItem } from "../../vite-env";

export interface FloatingSubAgentCardProps {
  subagents: SubAgentItem[];
  onKillAgent?: (agentId: string) => void;
  className?: string;
}

export function FloatingSubAgentCard({
  subagents,
  onKillAgent,
  className = "",
}: FloatingSubAgentCardProps) {
  const hasRunning = subagents.some((a) => a.status === "running");
  const [isOpen, setIsOpen] = useState(hasRunning);
  const wasRunningRef = useRef(hasRunning);

  useEffect(() => {
    if (hasRunning && !wasRunningRef.current) {
      setIsOpen(true);
    }
    wasRunningRef.current = hasRunning;
  }, [hasRunning]);

  if (!subagents || subagents.length === 0) return null;

  const runningCount = subagents.filter((a) => a.status === "running").length;
  const completedCount = subagents.filter((a) => a.status === "completed").length;
  const totalCount = subagents.length;

  return (
    <div
      className={`w-72 sm:w-84 rounded-lg bg-white dark:bg-[#252526] border border-[#e2e2e4] dark:border-[#383838] shadow-xl font-sans select-none overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      {/* Header with Layers2 Icon */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-[#252526] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Layers2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="text-[#333333] dark:text-[#e0e0e0] font-semibold text-xs tracking-tight">
            Sub-Agents
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a0a0a0]">
            {runningCount > 0 ? `${runningCount} running` : `${completedCount}/${totalCount}`}
          </span>
          {runningCount > 0 && (
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[#777777] dark:text-[#a0a0a0]">
          <button
            type="button"
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            title={isOpen ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                isOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expanded Sub-Agent List */}
      {isOpen && (
        <div className="border-t border-[#e2e2e4] dark:border-[#383838] p-3 max-h-72 overflow-y-auto space-y-2.5">
          {subagents.map((agent) => {
            const isRunning = agent.status === "running";
            const isCompleted = agent.status === "completed";
            const isKilled = agent.status === "killed";
            const isFailed = agent.status === "failed";
            const elapsed = Math.round(
              ((agent.endTime || Date.now()) - agent.startTime) / 1000
            );

            return (
              <div
                key={agent.id}
                className="group p-2 rounded-md bg-[#fafafa] dark:bg-[#1e1e1e] border border-[#ebebeb] dark:border-[#2e2e2e] flex flex-col gap-1.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : isKilled ? (
                      <Ban className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}

                    <span className="text-xs font-medium text-[#222222] dark:text-[#f0f0f0] truncate">
                      {agent.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {agent.role && (
                      <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        {agent.role}
                      </span>
                    )}

                    <span className="text-[10px] text-[#888888] dark:text-[#777777] font-mono">
                      {elapsed}s
                    </span>

                    {isRunning && onKillAgent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onKillAgent(agent.id);
                        }}
                        className="p-1 rounded text-[#888888] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Kill subagent"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Latest Activity Log Snippet */}
                {agent.logs && agent.logs.length > 0 && (
                  <div className="text-[11px] text-[#666666] dark:text-[#999999] truncate font-mono bg-black/3 dark:bg-white/3 px-1.5 py-0.5 rounded">
                    {agent.logs[agent.logs.length - 1]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
