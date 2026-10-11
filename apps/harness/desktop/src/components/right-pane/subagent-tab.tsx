import React, { useMemo } from "react";
import { Bot } from "lucide-react";
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

export function SubagentTab({
  tab,
  subagents = [],
  onOpenFilePreview,
}: SubagentTabProps) {
  const currentAgent: SubAgentItem | undefined =
    subagents.find((a) => a.id === tab.subAgentId) || tab.subAgent;

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

  // 1. User Message: The exact prompt delegated to the subagent
  const userMessage = useMemo(
    () => ({
      id: `prompt_${currentAgent.id}`,
      role: "user" as const,
      content: currentAgent.prompt,
      timestamp: currentAgent.startTime,
    }),
    [currentAgent]
  );

  // 2. Assistant Message: Execution trace steps + markdown result
  const assistantMessage = useMemo(() => {
    const traceSteps: TraceStep[] = (currentAgent.logs || []).map((log, i) => {
      const parts = log.split(" · ");
      const name = parts[0] || "tool";
      const target = parts[1] || "";
      return {
        id: `step_${currentAgent.id}_${i}`,
        type: "tool" as const,
        name,
        args: target ? { path: target } : {},
        result: "done",
      };
    });

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

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-[#161616] text-[#ffffff] select-text">
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
