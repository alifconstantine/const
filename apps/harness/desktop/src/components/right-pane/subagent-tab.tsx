import React, { useMemo } from "react";
import { Bot, Square, CheckCircle2, AlertCircle, Loader2, Ban, FileText } from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { RightPaneTab } from "./types";
import type { SubAgentItem, TraceStep } from "../../vite-env";
import { ChatMessageItem } from "../workbench/chat-message-item";

export interface SubagentTabProps {
  tab: RightPaneTab;
  subagents?: SubAgentItem[];
  onKillAgent?: (agentId: string) => void;
  onOpenFilePreview?: (filePath: string) => void;
}

const KNOWN_TOOL_NAMES = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "ls",
  "find",
  "grep",
  "mkdir",
  "todo_write",
  "ask_question",
  "apply_patch",
  "run_command",
  "manage_task",
  "wait",
  "lsp",
  "ast_grep",
  "web_search",
  "web_fetch",
  "git_status",
  "git_diff",
  "git_log",
  "run_python",
  "python",
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_key",
  "browser_scroll",
  "browser_screenshot",
]);

export function SubagentTab({
  tab,
  subagents = [],
  onKillAgent,
  onOpenFilePreview,
}: SubagentTabProps) {
  const currentAgent: SubAgentItem | undefined =
    subagents.find(
      (a) =>
        a.id === tab.subAgentId ||
        (tab.subAgent?.name && a.name === tab.subAgent.name)
    ) || tab.subAgent;

  if (!currentAgent) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-[#141414] text-white">
        <Bot className="w-8 h-8 mb-2.5 text-[#5d5d5d]" />
        <h4 className="text-sm font-medium text-[#d4d4d4] mb-1">Sub-Agent Not Found</h4>
        <p className="text-xs text-[#808080] max-w-xs">
          The requested sub-agent may have finished or been cleared.
        </p>
      </div>
    );
  }

  const isRunning = currentAgent.status === "running";
  const durationMs = currentAgent.endTime
    ? currentAgent.endTime - currentAgent.startTime
    : Date.now() - currentAgent.startTime;
  const durationSec = Math.max(0, Math.round(durationMs / 1000));

  // 1. User Message: The exact prompt delegated to the subagent
  const userMessage = useMemo(
    () => ({
      id: `prompt_${currentAgent.id}`,
      role: "user" as const,
      content: currentAgent.prompt,
      timestamp: currentAgent.startTime,
    }),
    [currentAgent.id, currentAgent.prompt, currentAgent.startTime]
  );

  // 2. Assistant Message: Real structured traceSteps (or smart fallback from logs) + markdown result
  const assistantMessage = useMemo(() => {
    let traceSteps: TraceStep[] = [];

    if (Array.isArray(currentAgent.traceSteps) && currentAgent.traceSteps.length > 0) {
      traceSteps = currentAgent.traceSteps.map((st) => ({
        id: st.id,
        type: st.type,
        content: st.content,
        startTime: st.startTime,
        durationMs: st.durationMs,
        toolCallId: st.toolCallId,
        name: st.name,
        args: st.args,
        result: st.result,
        isError: st.isError,
        mutation: st.mutation,
      }));
    } else if (Array.isArray(currentAgent.logs) && currentAgent.logs.length > 0) {
      traceSteps = currentAgent.logs
        .filter(
          (log) =>
            !log.startsWith("Spawned ") &&
            !log.startsWith("Completed in ")
        )
        .map((log, i) => {
          const parts = log.split(" · ");
          const candidateTool = (parts[0] || "").trim().toLowerCase();
          const target = parts.slice(1).join(" · ").trim();

          if (KNOWN_TOOL_NAMES.has(candidateTool)) {
            const isCmdTool =
              candidateTool === "bash" ||
              candidateTool === "powershell" ||
              candidateTool === "run_command";
            const isSearchTool =
              candidateTool === "grep" ||
              candidateTool === "find" ||
              candidateTool === "web_search";
            return {
              id: `step_${currentAgent.id}_${i}`,
              type: "tool" as const,
              name: candidateTool,
              args: target
                ? isCmdTool
                  ? { command: target }
                  : isSearchTool
                  ? { pattern: target, query: target }
                  : { path: target }
                : {},
              result: "done",
            };
          }

          return {
            id: `thought_${currentAgent.id}_${i}`,
            type: "thought" as const,
            content: log,
          };
        });
    }

    const content =
      currentAgent.result ||
      (currentAgent.error
        ? `**Execution Error:**\n\`\`\`\n${currentAgent.error}\n\`\`\``
        : "");

    return {
      id: `response_${currentAgent.id}`,
      role: "assistant" as const,
      content,
      traceSteps,
      durationMs,
    };
  }, [currentAgent, durationMs]);

  const roleLabel = (currentAgent.role || "task").toUpperCase();

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-[#161616] text-[#ffffff] select-text">
      {/* Subagent Header & Controls */}
      <div className="shrink-0 px-4 py-2.5 border-b border-[#262626] bg-[#141414] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-[#262626] text-[#d4d4d4] uppercase shrink-0">
            {roleLabel}
          </span>
          {currentAgent.name && (
            <span className="text-xs font-mono text-[#a3a3a3] shrink-0">
              {currentAgent.name}
            </span>
          )}
          <span className="text-xs text-[#e5e5e5] truncate font-medium">
            {currentAgent.description}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {typeof currentAgent.turnCount === "number" && currentAgent.turnCount > 0 && (
            <span className="text-[11px] text-[#737373] tabular-nums">
              {currentAgent.turnCount} {currentAgent.turnCount === 1 ? "turn" : "turns"}
            </span>
          )}
          <span className="text-[11px] text-[#737373] tabular-nums">
            {durationSec}s
          </span>

          {currentAgent.status === "running" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running
            </span>
          )}
          {currentAgent.status === "completed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          )}
          {currentAgent.status === "failed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
          {currentAgent.status === "killed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
              <Ban className="w-3 h-3" />
              Cancelled
            </span>
          )}

          {currentAgent.artifactPath && onOpenFilePreview && (
            <button
              type="button"
              onClick={() => onOpenFilePreview(currentAgent.artifactPath!)}
              title="Open Full Output Artifact"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#222222] hover:bg-[#2c2c2c] text-[#d4d4d4] border border-[#333333] transition-colors"
            >
              <FileText className="w-3 h-3" />
              Artifact
            </button>
          )}

          {isRunning && onKillAgent && (
            <button
              type="button"
              onClick={() => onKillAgent(currentAgent.id)}
              title="Terminate Sub-Agent"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              Stop
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 w-full h-full min-h-0">
        <div className="w-full max-w-full mx-auto px-3.5 sm:px-6 py-6 flex flex-col gap-6">
          <ChatMessageItem
            message={userMessage}
            onOpenFilePreview={onOpenFilePreview}
            isReadOnly={true}
            userBubbleWidthClass="w-full"
          />
          <ChatMessageItem
            message={assistantMessage}
            isExecuting={isRunning}
            liveDurationMs={durationMs}
            onOpenFilePreview={onOpenFilePreview}
            isReadOnly={true}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
