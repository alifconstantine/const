import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Waypoints,
  Code2,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { TrajectoryStepCard } from "../right-pane/trajectory-tab";
import { useTranslation } from "../../lib/i18n";

interface TrajectoryDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  conversationTitle?: string;
  messages: any[];
  onOpenFilePreview?: (filePath: string) => void;
  onOpenFileDiff?: (record: any) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
}

export function TrajectoryDialog({
  open,
  onClose,
  conversationId,
  conversationTitle,
  messages,
  onOpenFilePreview,
  onOpenFileDiff,
  onOpenTrajectory,
}: TrajectoryDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"timeline" | "raw">("timeline");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

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

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(trajectoryLogPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {}
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => ({
      ...prev,
      [toolKey]: !prev[toolKey],
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 outline-none ring-0"
    >
      <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-[#161616] border border-[#383838] rounded-2xl overflow-hidden select-none outline-none ring-0">
        {/* Header Strip - Level 1 Elevation, Zero divider lines */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#222222] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-white shrink-0">
              <Waypoints className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-white font-sans truncate">
                  {t("workbench.modelTrajectory")}
                </span>
                {conversationTitle && (
                  <span className="text-xs text-[#969696] font-sans truncate hidden sm:inline max-w-[240px]">
                    • {conversationTitle}
                  </span>
                )}
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] shrink-0">
                  {messages.length} steps
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPath}
                title={`Click to copy: ${trajectoryLogPath}`}
                className="flex items-center gap-1.5 font-mono text-[11px] text-[#969696] hover:text-[#d4d4d4] truncate text-left transition-colors cursor-pointer group"
              >
                <Code2 className="w-3 h-3 text-[#5d5d5d] group-hover:text-[#969696] shrink-0" />
                <span className="truncate">{trajectoryLogPath}</span>
                {copiedPath ? (
                  <Check className="w-3 h-3 text-[#10b981] shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-[#5d5d5d] group-hover:text-[#969696] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switchers */}
            <div className="flex items-center rounded-lg bg-[#1b1b1b] p-0.5 border border-[#2e2e2e] text-xs font-sans">
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer font-medium font-sans text-xs",
                  activeTab === "timeline"
                    ? "bg-[#2b2b2b] text-white"
                    : "text-[#969696] hover:text-white"
                )}
              >
                {t("workbench.timeline")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer font-medium font-sans text-xs",
                  activeTab === "raw"
                    ? "bg-[#2b2b2b] text-white"
                    : "text-[#969696] hover:text-white"
                )}
              >
                {t("workbench.rawJsonl")}
              </button>
            </div>

            {/* Copy raw button */}
            <button
              type="button"
              onClick={handleCopyRaw}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#1b1b1b] hover:bg-[#252528] text-xs font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer font-sans"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10b981]" />
                  <span className="font-sans">{t("common.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-sans">{t("workbench.copyJsonl")}</span>
                </>
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2b2b2b] text-[#969696] hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#161616]">
          {activeTab === "timeline" ? (
            <ScrollArea className="h-full w-full p-4 sm:p-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-3.5">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                    <div className="w-12 h-12 rounded-2xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center mb-3">
                      <Waypoints className="w-6 h-6 text-[#969696]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white font-sans mb-1">
                      No Trajectory Recorded
                    </h3>
                    <p className="text-xs text-[#969696] font-sans max-w-xs">
                      {t("workbench.noTrajectory")}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <TrajectoryStepCard
                      key={msg.id || idx}
                      message={msg}
                      stepIndex={idx}
                      isThinkingExpanded={Boolean(expandedThinking[idx])}
                      onToggleThinking={() => toggleThinking(idx)}
                      expandedTools={expandedTools}
                      onToggleTool={toggleTool}
                      onOpenFilePreview={onOpenFilePreview}
                      onOpenFileDiff={onOpenFileDiff}
                      onOpenTrajectory={onOpenTrajectory}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full w-full p-4 font-mono text-[12px] leading-relaxed text-[#d4d4d4] select-text">
              <pre className="whitespace-pre-wrap break-all font-mono">
                {rawTranscript || "Loading trajectory logs..."}
              </pre>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
