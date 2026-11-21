import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Waypoints,
  Link2,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { buildTrajectoryJsonl, TrajectoryStepCard } from "../right-pane/trajectory-tab";
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
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<"timeline" | "raw">("timeline");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && conversationId) {
      const generatedFromMessages = buildTrajectoryJsonl(messages);
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
          .catch(() => setRawTranscript(generatedFromMessages));
      } else {
        setRawTranscript(generatedFromMessages);
      }
    }
  }, [open, conversationId, messages]);

  if (!open) return null;

  const trajectoryLogPath = `~/.const/harness/brain/${conversationId}/.system_generated/logs/transcript.jsonl`;

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawTranscript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(trajectoryLogPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1800);
    } catch {}
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolKey]: !prev[toolKey] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 outline-none ring-0"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(960px,94vw)] h-[min(820px,86vh)] flex flex-col bg-[#ffffff] dark:bg-[#161616] border border-[#dedee2] dark:border-[#383838] rounded-2xl overflow-hidden text-[#161616] dark:text-white font-sans select-none outline-none focus:outline-none focus-visible:outline-none ring-0"
      >
        {/* Clean Header Strip */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0 gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h2 className="text-sm font-semibold text-[#161616] dark:text-white truncate">
              {t("workbench.modelTrajectory")}
            </h2>
            {conversationTitle && (
              <span className="text-xs text-[#737373] dark:text-[#8e8e93] truncate hidden sm:inline max-w-[260px]">
                {conversationTitle}
              </span>
            )}
            <span className="text-[11px] tabular-nums text-[#888888] dark:text-[#73737a] shrink-0">
              {messages.length}{" "}
              {language === "id" ? "langkah" : messages.length === 1 ? "step" : "steps"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "timeline"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white",
                )}
              >
                {t("workbench.timeline")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "raw"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white",
                )}
              >
                {t("workbench.rawJsonl")}
              </button>
            </div>

            {conversationId && (
              <button
                type="button"
                onClick={handleCopyPath}
                title={copiedPath ? t("common.copied") : trajectoryLogPath}
                aria-label="Copy transcript log path"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {copiedPath ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyRaw}
              title={copied ? t("common.copied") : t("workbench.copyJsonl")}
              aria-label={t("workbench.copyJsonl")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "timeline" ? (
            <ScrollArea className="h-full w-full" scrollBarClassName="w-2">
              <div className="max-w-3xl mx-auto px-5 pb-6 pt-2 flex flex-col pl-7">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                    <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mb-3">
                      <Waypoints className="w-5 h-5 text-[#888888] dark:text-[#8e8e93]" />
                    </div>
                    <h3 className="text-[13px] font-medium text-[#161616] dark:text-white mb-1">
                      No Trajectory Recorded
                    </h3>
                    <p className="text-xs text-[#737373] dark:text-[#8e8e93] max-w-xs leading-relaxed">
                      {t("workbench.noTrajectory")}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <TrajectoryStepCard
                      key={msg.id || idx}
                      message={msg}
                      stepIndex={idx}
                      isLast={idx === messages.length - 1}
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
            <ScrollArea className="h-full w-full" scrollBarClassName="w-2">
              <div className="p-5 font-mono text-xs leading-relaxed text-[#262626] dark:text-[#d4d4d4] select-text">
                <pre className="whitespace-pre-wrap break-all font-mono">
                  {rawTranscript || "Loading trajectory logs..."}
                </pre>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
