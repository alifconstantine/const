import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Terminal,
  FileCode,
  Brain,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";

interface TrajectoryDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  conversationTitle?: string;
  messages: any[];
}

export function TrajectoryDialog({
  open,
  onClose,
  conversationId,
  conversationTitle,
  messages,
}: TrajectoryDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"timeline" | "raw">("timeline");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const generateFullJsonl = (msgs: any[]) => {
    return msgs
      .map((m, idx) =>
        JSON.stringify({
          step_index: idx,
          source: m.role === "user" ? "USER_EXPLICIT" : "MODEL",
          type: m.role === "user" ? "USER_INPUT" : "PLANNER_RESPONSE",
          content: m.content || "",
          thinking: m.thinking || undefined,
          tool_calls: m.toolCalls && m.toolCalls.length > 0 ? m.toolCalls : undefined,
          tool_results: m.toolResults && m.toolResults.length > 0 ? m.toolResults : undefined,
          mutations: m.mutations && m.mutations.length > 0 ? m.mutations : undefined,
          created_at: new Date(m.timestamp || m.createdAt || Date.now()).toISOString(),
        })
      )
      .join("\n");
  };

  useEffect(() => {
    if (open && conversationId) {
      const generatedFromMessages = generateFullJsonl(messages);
      if (window.electron?.getTranscript) {
        window.electron
          .getTranscript(conversationId)
          .then((data) => {
            if (data && data.trim()) {
              const diskLines = data.trim().split("\n").filter(Boolean);
              if (diskLines.length >= messages.length) {
                setRawTranscript(data);
                return;
              }
            }
            setRawTranscript(generatedFromMessages);
          })
          .catch(() => {
            setRawTranscript(generatedFromMessages);
          });
      } else {
        setRawTranscript(generatedFromMessages);
      }
    }
  }, [open, conversationId, messages]);

  if (!open) return null;

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawTranscript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const trajectoryLogPath = `~/.const/harness/brain/${conversationId}/.system_generated/logs/transcript.jsonl`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-5xl h-[85vh] flex flex-col bg-white dark:bg-[#161616] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl overflow-hidden select-none">
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f4f4f6] dark:bg-[#202020] border-b border-[#e2e2e4] dark:border-[#2e2e2e] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#eaeaea] dark:bg-[#2b2b2b] flex items-center justify-center text-[#262626] dark:text-[#d4d4d4]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#161616] dark:text-white truncate">
                  {t("workbench.modelTrajectory")}
                </span>
                {conversationTitle && (
                  <span className="text-xs text-[#888888] dark:text-[#777777] truncate hidden sm:inline max-w-[200px]">
                    • {conversationTitle}
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-[#888888] dark:text-[#666666] truncate" title={trajectoryLogPath}>
                Path: {trajectoryLogPath}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switchers */}
            <div className="flex items-center rounded-lg bg-[#e8e8eb] dark:bg-[#181818] p-0.5 border border-[#dedee2] dark:border-[#2b2b2e] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer font-medium",
                  activeTab === "timeline"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-sm"
                    : "text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white"
                )}
              >
                {t("workbench.timeline")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer font-medium",
                  activeTab === "raw"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-sm"
                    : "text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white"
                )}
              >
                {t("workbench.rawJsonl")}
              </button>
            </div>

            {/* Copy raw button */}
            <button
              type="button"
              onClick={handleCopyRaw}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e4] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] text-xs font-medium text-[#262626] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#16a34a] dark:text-[#4ade80]" />
                  <span>{t("common.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t("workbench.copyJsonl")}</span>
                </>
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#777777] dark:text-[#999999] hover:text-black dark:hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#fafafa] dark:bg-[#121212]">
          {activeTab === "timeline" ? (
            <ScrollArea className="h-full w-full p-4 sm:p-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-sm text-[#888888]">
                    {t("workbench.noTrajectory")}
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <TimelineStepItem key={msg.id || idx} message={msg} stepIndex={idx} />
                  ))
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full w-full p-4 font-mono text-[12px] leading-relaxed text-[#262626] dark:text-[#b8b8b8] select-text">
              <pre className="whitespace-pre-wrap break-all">
                {rawTranscript || "Loading trajectory logs..."}
              </pre>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineStepItem({ message, stepIndex }: { message: any; stepIndex: number }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#e2e2e4] dark:border-[#262628] bg-white dark:bg-[#181818]">
      {/* Header */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-[#f0f0f2] dark:border-[#222224]">
        <div className="flex items-center gap-2">
          {isUser ? (
            <span className="flex items-center gap-1.5 font-semibold text-[#161616] dark:text-white">
              <MessageSquare className="w-3.5 h-3.5 text-[#0066ff]" />
              {t("workbench.userTurn")} #{stepIndex + 1}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-[#161616] dark:text-white">
              <Brain className="w-3.5 h-3.5 text-[#ff7a00]" />
              {t("workbench.agentTurn")} #{stepIndex + 1}
            </span>
          )}
        </div>
        {message.timestamp && (
          <span className="font-sans tabular-nums text-[11px] text-[#888888]">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* User Prompt */}
      {isUser && (
        <div className="text-[13.5px] leading-relaxed text-[#262626] dark:text-[#d4d4d4] select-text">
          {message.content}
        </div>
      )}

      {/* Assistant Turn Components */}
      {!isUser && (
        <div className="flex flex-col gap-3 pt-1 text-[13px]">
          {/* Thinking / Reasoning */}
          {message.thinking && (
            <div className="p-3 rounded-lg bg-[#f6f6f8] dark:bg-[#1f1f21] border border-[#e2e2e4] dark:border-[#2a2a2d] text-xs text-[#666666] dark:text-[#a0a0a0] flex flex-col gap-1.5 select-text">
              <div className="flex items-center gap-1.5 font-medium text-[#161616] dark:text-[#cfcfcf]">
                <Brain className="w-3.5 h-3.5 text-[#ff7a00]" />
                <span>{t("workbench.modelThinking")}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed line-clamp-6 hover:line-clamp-none">
                {message.thinking}
              </p>
            </div>
          )}

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                {t("workbench.toolExecutions")} ({message.toolCalls.length})
              </span>
              <div className="flex flex-col gap-1.5">
                {message.toolCalls.map((tc: any, tcIdx: number) => (
                  <div
                    key={tc.id || tcIdx}
                    className="p-2.5 rounded-lg bg-[#f6f6f8] dark:bg-[#1a1a1c] border border-[#e2e2e4] dark:border-[#2b2b2e] flex flex-col gap-1 select-text"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-mono font-medium text-[#161616] dark:text-[#e0e0e0]">
                        <Terminal className="w-3 h-3 text-[#0066ff]" />
                        <span>{tc.name}</span>
                      </div>
                      {tc.isError && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                          {t("common.failed")}
                        </span>
                      )}
                    </div>
                    {tc.args && (
                      <pre className="font-mono text-[11px] text-[#777777] dark:text-[#8e8e93] overflow-x-auto whitespace-pre-wrap">
                        {typeof tc.args === "string"
                          ? tc.args
                          : JSON.stringify(tc.args, null, 2)}
                      </pre>
                    )}
                    {tc.result && (
                      <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5">
                        <span className="text-[10px] font-medium text-[#888888]">Result:</span>
                        <pre className="font-mono text-[10.5px] text-[#666666] dark:text-[#999999] max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mutations Summary */}
          {message.mutations && message.mutations.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                Files Modified ({message.mutations.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.mutations.map((m: any, mIdx: number) => (
                  <div
                    key={mIdx}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#f0f0f3] dark:bg-[#202022] border border-[#e2e2e4] dark:border-[#2e2e30] font-mono text-[11px] text-[#262626] dark:text-[#d0d0d0]"
                  >
                    <FileCode className="w-3 h-3 text-[#ff7a00]" />
                    <span>{m.targetFile?.split(/[\/\\]/).pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Text */}
          {message.content && (
            <div className="pt-2 border-t border-[#f0f0f2] dark:border-[#222224] text-[13.5px] leading-relaxed text-[#262626] dark:text-[#d4d4d4] select-text">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
