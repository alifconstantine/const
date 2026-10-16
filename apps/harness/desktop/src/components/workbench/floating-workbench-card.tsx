import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Circle,
  Check,
  ChevronDown,
  MoreHorizontal,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  X,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type { TodoItem, SubAgentItem } from "../../vite-env";

export interface FloatingWorkbenchCardProps {
  todos?: TodoItem[];
  subagents?: SubAgentItem[];
  isExecuting?: boolean;
  onSelectSubAgent?: (agent: SubAgentItem) => void;
  onKillAgent?: (agentId: string) => void;
  className?: string;
}

export function FloatingWorkbenchCard({
  todos = [],
  subagents = [],
  isExecuting = false,
  onSelectSubAgent,
  onKillAgent,
  className = "",
}: FloatingWorkbenchCardProps) {
  const { t } = useTranslation();
  const hasTodos = todos.length > 0;
  const hasSubAgents = subagents.length > 0;

  // Auto-expand if active execution or running subagents
  const hasRunningSubagents = subagents.some((a) => a.status === "running");
  const shouldAutoOpen = isExecuting || hasRunningSubagents;
  const [isOpen, setIsOpen] = useState(shouldAutoOpen);
  const wasActiveRef = useRef(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen && !wasActiveRef.current) {
      setIsOpen(true);
    }
    wasActiveRef.current = shouldAutoOpen;
  }, [shouldAutoOpen]);

  if (!hasTodos && !hasSubAgents) return null;

  const completedTodosCount = todos.filter((t) => t && t.status === "completed").length;
  const totalTodosCount = todos.length;

  const runningAgentsCount = subagents.filter((a) => a.status === "running").length;
  const completedAgentsCount = subagents.filter((a) => a.status === "completed").length;
  const totalAgentsCount = subagents.length;

  return (
    <div
      className={cn(
        "w-72 sm:w-84 rounded-xl bg-white dark:bg-[#252526] border border-[#e2e2e4] dark:border-[#383838] shadow-xl font-sans select-none overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 outline-none ring-0",
        className
      )}
    >
      {/* 1. Header: Progress (if todos exist) or Agents (if only subagents exist) */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-[#252526] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
      >
        {hasTodos ? (
          <div className="flex items-center gap-2">
            <span className="text-[#777777] dark:text-[#a0a0a0] font-medium text-xs">
              {t("common.progress")}
            </span>
            <span className="text-[#222222] dark:text-[#e0e0e0] font-sans tabular-nums text-xs font-semibold">
              {completedTodosCount}/{totalTodosCount}
            </span>
            {hasRunningSubagents && (
              <span className="relative flex h-2 w-2 ml-1" title={t("common.agents")}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded bg-[#1e1e20] text-[#a0a0a0] border border-[#2e2e2e] shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-[#333333] dark:text-[#e0e0e0] font-semibold text-xs tracking-tight">
              {t("common.agents")}
            </span>
            <span className="text-[11px] font-sans px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a0a0a0]">
              {runningAgentsCount > 0 ? `${runningAgentsCount} ${t("common.running").toLowerCase()}` : `${completedAgentsCount}/${totalAgentsCount}`}
            </span>
            {runningAgentsCount > 0 && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 text-[#777777] dark:text-[#a0a0a0]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            title={t("common.actions")}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            title={isOpen ? t("common.collapse") : t("common.expand")}
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200 ease-out",
                isOpen ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
        </div>
      </div>

      {/* 2. Expanded Body */}
      {isOpen && (
        <div className="border-t border-[#e2e2e4] dark:border-[#383838] flex flex-col max-h-84 overflow-hidden">
          <ScrollArea className="flex-1 w-full max-h-80">
            <div className="p-3 flex flex-col gap-3">
              {/* SECTION A: TO-DO CHECKLIST (Unified list, no waiting groups) */}
              {hasTodos && (
                <div className="space-y-2">
                  {todos.map((item, idx) => {
                    const status = item?.status || "pending";
                    const text = item?.content || item?.task || item?.title || "";

                    return (
                      <div key={item?.id || idx} className="flex items-start gap-2.5 min-w-0">
                        {status === "in_progress" ? (
                          <ArrowRight className="w-3.5 h-3.5 text-[#3b82f6] mt-0.5 shrink-0 stroke-[2.5]" />
                        ) : status === "completed" ? (
                          <Check className="w-3.5 h-3.5 text-[#10b981] mt-0.5 shrink-0 stroke-[2.5]" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-[#888888] dark:text-[#66666a] mt-0.5 shrink-0 stroke-[1.75]" />
                        )}

                        <span
                          className={cn(
                            "text-xs leading-snug break-words flex-1",
                            status === "in_progress"
                              ? "text-[#1c1c1e] dark:text-white font-medium"
                              : status === "completed"
                              ? "text-[#888888] dark:text-[#777777] line-through opacity-80"
                              : "text-[#444444] dark:text-[#b8b8b8]"
                          )}
                        >
                          {text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SECTION B: SUB-AGENTS (Below To-Do, or standalone) */}
              {hasSubAgents && (
                <div className={cn("flex flex-col gap-2", hasTodos && "pt-2 border-t border-[#ebebeb] dark:border-[#333333]")}>
                  {/* Agents Section Subheader */}
                  {hasTodos && (
                    <div className="flex items-center justify-between text-xs text-[#777777] dark:text-[#a0a0a0] font-medium px-0.5">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-[#969696]" />
                        <span>{t("common.agents")}</span>
                      </div>
                      <span className="text-[11px] font-sans text-[#888888] dark:text-[#888888]">
                        {runningAgentsCount > 0 ? `${runningAgentsCount} ${t("common.running").toLowerCase()}` : `${completedAgentsCount}/${totalAgentsCount}`}
                      </span>
                    </div>
                  )}

                  {/* Subagent List Items */}
                  <div className="space-y-1.5">
                    {subagents.map((agent, index) => {
                      const isRunning = agent.status === "running";
                      const isCompleted = agent.status === "completed";
                      const isKilled = agent.status === "killed";
                      const isFailed = agent.status === "failed";
                      const elapsed = Math.round(
                        ((agent.endTime || Date.now()) - agent.startTime) / 1000
                      );

                      // Format display title (e.g. Sub-agent 1: ...)
                      const displayTitle = agent.description.toLowerCase().startsWith("sub-agent")
                        ? agent.description
                        : `Sub-agent ${index + 1}: ${agent.description}`;

                      return (
                        <div
                          key={agent.id}
                          onClick={() => onSelectSubAgent?.(agent)}
                          className="group p-2 rounded-lg bg-[#fafafa] dark:bg-[#1e1e1e] hover:bg-black/5 dark:hover:bg-white/5 border border-[#ebebeb] dark:border-[#2e2e2e] flex flex-col gap-1 transition-colors cursor-pointer"
                          title={agent.description}
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-xs font-medium text-[#222222] dark:text-[#e0e0e0] group-hover:text-white transition-colors truncate">
                                {displayTitle}
                              </span>
                            </div>

                            {/* Status Icon */}
                            <div className="shrink-0 flex items-center gap-1">
                              {isRunning && (
                                <Loader2 className="w-3 h-3 text-[#ff9900] animate-spin" />
                              )}
                              {isCompleted && (
                                <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                              )}
                              {isFailed && (
                                <AlertCircle className="w-3 h-3 text-[#ef4444]" />
                              )}
                              {isKilled && (
                                <Ban className="w-3 h-3 text-[#888888]" />
                              )}

                              {/* Kill action */}
                              {isRunning && onKillAgent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onKillAgent(agent.id);
                                  }}
                                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#888888] hover:text-[#ff4d4f] transition-colors ml-0.5"
                                  title={t("rightPane.terminateSubAgent")}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Subtitle / elapsed duration */}
                          <div className="flex items-center text-[11px] text-[#777777] dark:text-[#888888] px-0.5 font-sans">
                            <span className="truncate">
                              {isRunning ? `${t("common.running")} (${elapsed}s)` : isCompleted ? `${t("common.completed")} (${elapsed}s)` : isFailed ? t("common.failed") : t("common.terminated")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
