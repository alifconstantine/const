import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Waypoints,
  Copy,
  Check,
  Terminal,
  Brain,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  X,
  Code2,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "../workbench/file-icon";
import { MarkdownContent } from "../workbench/markdown-content";
import type { RightPaneTab } from "./types";
import type { ConversationItem } from "../../lib/conversation-store";
import { useTranslation } from "../../lib/i18n";

interface TrajectoryTabProps {
  tab: RightPaneTab;
  parentMessages?: any[];
  parentConversationTitle?: string;
  parentConversationId?: string;
  conversations?: ConversationItem[];
  onOpenFilePreview?: (filePath: string) => void;
  onOpenFileDiff?: (record: any) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
}

export function TrajectoryTab({
  tab,
  parentMessages = [],
  parentConversationTitle,
  parentConversationId,
  conversations = [],
  onOpenFilePreview,
  onOpenFileDiff,
  onOpenTrajectory,
  onOpenBrowser,
}: TrajectoryTabProps) {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<"timeline" | "raw">("timeline");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // Resolve target conversation ID and messages
  const targetConversationId = tab.conversationId || parentConversationId || "";
  const isCurrentParent = targetConversationId === parentConversationId;

  const targetConversation = useMemo(() => {
    if (isCurrentParent) return null;
    return conversations.find((c) => c.id === targetConversationId) || null;
  }, [isCurrentParent, conversations, targetConversationId]);

  const activeTitle =
    tab.title ||
    targetConversation?.title ||
    (isCurrentParent ? parentConversationTitle : "") ||
    t("workbench.modelTrajectory");

  const effectiveMessages = useMemo(() => {
    if (isCurrentParent) {
      return parentMessages;
    }
    return targetConversation?.messages || [];
  }, [isCurrentParent, parentMessages, targetConversation]);

  // Generate fallback JSONL from messages
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

  // Fetch disk transcript if electron API is available
  useEffect(() => {
    if (!targetConversationId) return;

    const generated = generateFullJsonl(effectiveMessages);
    if (window.electron?.getTranscript) {
      window.electron
        .getTranscript(targetConversationId)
        .then((data) => {
          if (data && data.trim()) {
            const diskLines = data.trim().split("\n").filter(Boolean);
            if (diskLines.length >= effectiveMessages.length) {
              setRawTranscript(data);
              return;
            }
          }
          setRawTranscript(generated);
        })
        .catch(() => {
          setRawTranscript(generated);
        });
    } else {
      setRawTranscript(generated);
    }
  }, [targetConversationId, effectiveMessages]);

  const trajectoryLogPath = `~/.const/harness/brain/${targetConversationId}/.system_generated/logs/transcript.jsonl`;

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawTranscript);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch {}
  };

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

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return effectiveMessages;
    const query = searchQuery.toLowerCase();
    return effectiveMessages.filter((msg) => {
      if (msg.content && msg.content.toLowerCase().includes(query)) return true;
      if (msg.thinking && msg.thinking.toLowerCase().includes(query)) return true;
      if (
        msg.toolCalls &&
        msg.toolCalls.some(
          (tc: any) =>
            tc.name?.toLowerCase().includes(query) ||
            JSON.stringify(tc.args || "").toLowerCase().includes(query)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [effectiveMessages, searchQuery]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#161616] text-[#ffffff] overflow-hidden select-none">
      {/* Header Bar - Level 1 Elevation, Zero divider line */}
      <div className="px-4 py-3 bg-[#222222] shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Title and Waypoints icon */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-[#ffffff] shrink-0">
              <Waypoints className="w-4 h-4 text-[#ffffff]" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-[#ffffff] font-sans truncate">
                  {t("workbench.modelTrajectory")}
                </span>
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] shrink-0">
                  {effectiveMessages.length} {t("workbench.timeline").toLowerCase()}
                </span>
              </div>
              {activeTitle && activeTitle !== t("workbench.modelTrajectory") && (
                <span className="text-xs text-[#969696] font-sans truncate">
                  {activeTitle}
                </span>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-[#1b1b1b] p-0.5 border border-[#2e2e2e] text-xs font-sans">
              <button
                type="button"
                onClick={() => setActiveView("timeline")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium font-sans text-xs",
                  activeView === "timeline"
                    ? "bg-[#2b2b2b] text-[#ffffff]"
                    : "text-[#969696] hover:text-[#ffffff]"
                )}
              >
                {t("workbench.timeline")}
              </button>
              <button
                type="button"
                onClick={() => setActiveView("raw")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium font-sans text-xs",
                  activeView === "raw"
                    ? "bg-[#2b2b2b] text-[#ffffff]"
                    : "text-[#969696] hover:text-[#ffffff]"
                )}
              >
                {t("workbench.rawJsonl")}
              </button>
            </div>

            {/* Copy JSONL button */}
            <button
              type="button"
              onClick={handleCopyRaw}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2e2e2e] bg-[#1b1b1b] hover:bg-[#252528] text-xs font-medium text-[#d4d4d4] hover:text-[#ffffff] transition-colors cursor-pointer font-sans"
              title={t("workbench.copyJsonl")}
            >
              {copiedRaw ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10b981]" />
                  <span className="text-[11px] font-sans">{t("common.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-sans hidden sm:inline">{t("workbench.copyJsonl")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Secondary Bar: Log Path Pill & Search */}
        <div className="flex items-center gap-2">
          {/* Path pill */}
          <button
            type="button"
            onClick={handleCopyPath}
            title={`Click to copy: ${trajectoryLogPath}`}
            className="flex-1 min-w-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-left transition-colors cursor-pointer group"
          >
            <Code2 className="w-3.5 h-3.5 text-[#969696] group-hover:text-[#ffffff] shrink-0" />
            <span className="font-mono text-[11px] text-[#969696] group-hover:text-[#d4d4d4] truncate">
              {trajectoryLogPath}
            </span>
            {copiedPath ? (
              <Check className="w-3 h-3 text-[#10b981] ml-auto shrink-0" />
            ) : (
              <Copy className="w-3 h-3 text-[#5d5d5d] group-hover:text-[#969696] ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {/* Search Input when in timeline view */}
          {activeView === "timeline" && (
            <div className="relative w-36 sm:w-44 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#5d5d5d] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter steps..."
                className="w-full h-7 pl-8 pr-6 text-xs font-sans bg-[#1b1b1b] border border-[#2e2e2e] rounded-md text-[#ffffff] placeholder:text-[#5d5d5d] focus:outline-none focus:border-[#383838] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5d5d5d] hover:text-[#d4d4d4]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-[#161616]">
        {activeView === "timeline" ? (
          <ScrollArea className="h-full w-full">
            <div className="p-4 sm:p-5 flex flex-col gap-3.5 max-w-4xl mx-auto">
              {filteredMessages.length === 0 ? (
                /* Empty state matching DESIGN.md */
                <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                  <div className="w-12 h-12 rounded-2xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center mb-3">
                    <Waypoints className="w-6 h-6 text-[#969696]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#ffffff] font-sans mb-1">
                    {searchQuery ? "No matching trajectory steps" : "No Trajectory Recorded"}
                  </h3>
                  <p className="text-xs text-[#969696] font-sans max-w-xs">
                    {searchQuery
                      ? `No steps match the filter "${searchQuery}".`
                      : t("workbench.noTrajectory")}
                  </p>
                </div>
              ) : (
                filteredMessages.map((msg, idx) => (
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
                    onOpenBrowser={onOpenBrowser}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          /* Raw JSONL View */
          <ScrollArea className="h-full w-full">
            <div className="p-4 font-mono text-[12px] leading-relaxed text-[#d4d4d4] select-text">
              <pre className="whitespace-pre-wrap break-all font-mono">
                {rawTranscript || "Loading trajectory logs..."}
              </pre>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrajectoryStepCard: Clean Const Studio step item with Markdown formatting
// ---------------------------------------------------------------------------
interface TrajectoryStepCardProps {
  message: any;
  stepIndex: number;
  isThinkingExpanded: boolean;
  onToggleThinking: () => void;
  expandedTools: Record<string, boolean>;
  onToggleTool: (toolKey: string) => void;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenFileDiff?: (record: any) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
}

function TrajectoryThinkingView({ thinking }: { thinking: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isInitiallyLong = useMemo(
    () => (thinking || "").length > 200 || (thinking || "").split("\n").length > 4,
    [thinking]
  );
  const [canScrollDown, setCanScrollDown] = useState(isInitiallyLong);
  const [canScrollUp, setCanScrollUp] = useState(false);

  const checkScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    const moreBelow = hasOverflow && el.scrollHeight - el.scrollTop - el.clientHeight > 6;
    const moreAbove = hasOverflow && el.scrollTop > 6;
    setCanScrollDown(moreBelow);
    setCanScrollUp(moreAbove);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [thinking, checkScroll]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [checkScroll]);

  const maskStyle = useMemo(() => {
    if (!canScrollDown && !canScrollUp) return undefined;
    if (canScrollDown && canScrollUp) {
      return "linear-gradient(to bottom, transparent 0%, black 20px, black calc(100% - 32px), transparent 100%)";
    }
    if (canScrollDown) {
      return "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)";
    }
    return "linear-gradient(to bottom, transparent 0%, black 20px, black 100%)";
  }, [canScrollDown, canScrollUp]);

  return (
    <div className="relative px-3 pb-3 pt-1 border-t border-[#282828] select-text">
      <ScrollArea
        viewportRef={viewportRef}
        onScroll={checkScroll}
        viewportStyle={
          maskStyle
            ? {
                WebkitMaskImage: maskStyle,
                maskImage: maskStyle,
              }
            : undefined
        }
        className="max-h-56 w-full pr-1 text-xs text-[#d4d4d4] font-sans leading-relaxed whitespace-pre-wrap select-text [&>div>div[style]]:!block"
      >
        {thinking}
      </ScrollArea>
      {canScrollDown && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 right-3 h-8 bg-gradient-to-t from-[#1b1b1b] via-[#1b1b1b]/80 to-transparent transition-opacity duration-200"
        />
      )}
    </div>
  );
}

export function TrajectoryStepCard({
  message,
  stepIndex,
  isThinkingExpanded,
  onToggleThinking,
  expandedTools,
  onToggleTool,
  onOpenFilePreview,
  onOpenFileDiff,
  onOpenTrajectory,
  onOpenBrowser,
}: TrajectoryStepCardProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  const formattedTime = useMemo(() => {
    if (!message.timestamp && !message.createdAt) return null;
    try {
      const d = new Date(message.timestamp || message.createdAt);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return null;
    }
  }, [message.timestamp, message.createdAt]);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#222222] border border-[#383838] transition-colors select-none">
      {/* Card Header Strip - Seamless borderless */}
      <div className="flex items-center justify-between text-xs font-sans">
        <div className="flex items-center gap-2">
          {isUser ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e]">
              <MessageSquare className="w-3.5 h-3.5 text-[#0066ff]" />
              <span className="font-sans font-medium text-xs text-[#ffffff]">
                {t("workbench.userTurn")} #{stepIndex + 1}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e]">
              <Waypoints className="w-3.5 h-3.5 text-[#ff7a00]" />
              <span className="font-sans font-medium text-xs text-[#ffffff]">
                {t("workbench.agentTurn")} #{stepIndex + 1}
              </span>
            </div>
          )}
        </div>

        {formattedTime && (
          <span className="font-sans tabular-nums text-[11px] text-[#969696]">
            {formattedTime}
          </span>
        )}
      </div>

      {/* User Turn Body */}
      {isUser && (
        <div className="text-[13.5px] leading-relaxed text-[#ffffff] font-sans select-text">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      )}

      {/* Assistant Turn Body */}
      {!isUser && (
        <div className="flex flex-col gap-3 font-sans">
          {/* Thinking / Reasoning Section */}
          {message.thinking && (
            <div className="rounded-lg bg-[#1b1b1b] border border-[#2e2e2e] overflow-hidden select-text">
              <button
                type="button"
                onClick={onToggleThinking}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#252528] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-[#ff7a00]" />
                  <span className="text-xs font-medium text-[#d4d4d4] font-sans">
                    {t("workbench.modelThinking")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#969696]">
                  <span className="text-[11px] font-sans">
                    {isThinkingExpanded ? "Collapse" : "Show reasoning"}
                  </span>
                  {isThinkingExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {isThinkingExpanded && (
                <TrajectoryThinkingView thinking={message.thinking} />
              )}
            </div>
          )}

          {/* Tool Executions Section */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#969696] font-sans">
                {t("workbench.toolExecutions")} ({message.toolCalls.length})
              </span>
              <div className="flex flex-col gap-2">
                {message.toolCalls.map((tc: any, tcIdx: number) => {
                  const toolKey = tc.id || `${stepIndex}_tc_${tcIdx}`;
                  const isExpanded = expandedTools[toolKey] ?? false;

                  return (
                    <div
                      key={toolKey}
                      className="rounded-lg bg-[#1b1b1b] border border-[#2e2e2e] p-3 flex flex-col gap-2 select-text transition-colors"
                    >
                      {/* Tool Call Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Terminal className="w-3.5 h-3.5 text-[#0066ff] shrink-0" />
                          <span className="font-mono text-xs font-semibold text-[#ffffff] truncate">
                            {tc.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {tc.isError ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans font-medium">
                              <AlertCircle className="w-3 h-3" />
                              {t("common.failed")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-medium">
                              <Check className="w-3 h-3" />
                              Success
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => onToggleTool(toolKey)}
                            className="p-1 rounded text-[#969696] hover:text-[#ffffff] hover:bg-[#252528] transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse tool details" : "Expand tool details"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Tool Arguments */}
                      {tc.args && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-medium text-[#969696] font-sans">
                            Arguments
                          </span>
                          <div className="bg-[#161616] p-2.5 rounded-md border border-[#282828] font-mono text-[11px] leading-relaxed text-[#d4d4d4] overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {typeof tc.args === "string"
                              ? tc.args
                              : JSON.stringify(tc.args, null, 2)}
                          </div>
                        </div>
                      )}

                      {/* Tool Result (collapsible or shown) */}
                      {tc.result && isExpanded && (
                        <div className="flex flex-col gap-1 pt-1 border-t border-[#282828]">
                          <span className="text-[10.5px] font-medium text-[#969696] font-sans">
                            Result
                          </span>
                          <div className="bg-[#161616] p-2.5 rounded-md border border-[#282828] font-mono text-[10.5px] leading-relaxed text-[#d4d4d4] max-h-52 overflow-y-auto whitespace-pre-wrap">
                            {typeof tc.result === "string"
                              ? tc.result
                              : JSON.stringify(tc.result, null, 2)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mutations / Modified Files Section */}
          {message.mutations && message.mutations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#969696] font-sans">
                Files Modified ({message.mutations.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.mutations.map((m: any, mIdx: number) => {
                  const target = m.targetFile || m.path || "file";
                  const fileName = target.split(/[\/\\]/).pop() || target;

                  return (
                    <button
                      key={mIdx}
                      type="button"
                      onClick={() => {
                        if (onOpenFileDiff) {
                          onOpenFileDiff(m);
                        } else if (onOpenFilePreview) {
                          onOpenFilePreview(target);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] font-sans text-xs text-[#d4d4d4] hover:text-[#ffffff] transition-colors cursor-pointer group"
                    >
                      <FileIcon filename={fileName} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[200px]">{fileName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Response Output - Formatted in Markdown with crisp white ink */}
          {message.content && (
            <div className="pt-2 text-[13.5px] leading-relaxed text-[#ffffff] font-sans select-text">
              <MarkdownContent
                content={message.content}
                onOpenFilePreview={onOpenFilePreview}
                onOpenTrajectory={onOpenTrajectory}
                onOpenBrowser={onOpenBrowser}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
