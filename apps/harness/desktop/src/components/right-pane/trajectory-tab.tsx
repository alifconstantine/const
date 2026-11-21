import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Waypoints,
  Copy,
  Check,
  Terminal,
  Brain,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  X,
  Link2,
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

export function buildTrajectoryJsonl(msgs: any[]): string {
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
      }),
    )
    .join("\n");
}

function summarizeToolArgs(args: unknown): string {
  if (!args) return "";
  if (typeof args === "string") {
    return args.replace(/\s+/g, " ").trim().slice(0, 96);
  }
  if (typeof args === "object") {
    const obj = args as Record<string, unknown>;
    const priorityKeys = [
      "CommandLine",
      "command",
      "Path",
      "path",
      "filePath",
      "targetFile",
      "url",
      "query",
      "Pattern",
      "pattern",
    ];
    for (const key of priorityKeys) {
      const val = obj[key];
      if (typeof val === "string" && val.trim()) {
        return val.replace(/\s+/g, " ").trim().slice(0, 96);
      }
    }
    for (const val of Object.values(obj)) {
      if (typeof val === "string" && val.trim()) {
        return val.replace(/\s+/g, " ").trim().slice(0, 96);
      }
    }
  }
  return "";
}

function formatCodePayload(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
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
  const { t, language } = useTranslation();
  const [activeView, setActiveView] = useState<"timeline" | "raw">("timeline");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

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
    return isCurrentParent ? parentMessages : (targetConversation?.messages || []);
  }, [isCurrentParent, parentMessages, targetConversation]);

  useEffect(() => {
    if (!targetConversationId) return;
    const generated = buildTrajectoryJsonl(effectiveMessages);
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
        .catch(() => setRawTranscript(generated));
    } else {
      setRawTranscript(generated);
    }
  }, [targetConversationId, effectiveMessages]);

  const trajectoryLogPath = `~/.const/harness/brain/${targetConversationId}/.system_generated/logs/transcript.jsonl`;

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawTranscript);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1800);
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

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return effectiveMessages;
    const query = searchQuery.toLowerCase();
    return effectiveMessages.filter((msg) => {
      if (msg.content && String(msg.content).toLowerCase().includes(query)) return true;
      if (msg.thinking && String(msg.thinking).toLowerCase().includes(query)) return true;
      if (
        Array.isArray(msg.toolCalls) &&
        msg.toolCalls.some(
          (tc: any) =>
            tc.name?.toLowerCase().includes(query) ||
            JSON.stringify(tc.args || "").toLowerCase().includes(query),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [effectiveMessages, searchQuery]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#ffffff] dark:bg-[#141414] text-[#161616] dark:text-white overflow-hidden select-none font-sans">
      {/* Compact borderless header */}
      <div className="px-4 pt-3 pb-2.5 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[13px] font-medium text-[#161616] dark:text-white truncate">
              {activeTitle !== t("workbench.modelTrajectory")
                ? activeTitle
                : t("workbench.modelTrajectory")}
            </span>
            <span className="text-[11px] tabular-nums text-[#737373] dark:text-[#7a7a80] shrink-0">
              {effectiveMessages.length}{" "}
              {language === "id" ? "langkah" : effectiveMessages.length === 1 ? "step" : "steps"}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveView("timeline")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  activeView === "timeline"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white",
                )}
              >
                {t("workbench.timeline")}
              </button>
              <button
                type="button"
                onClick={() => setActiveView("raw")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  activeView === "raw"
                    ? "bg-white dark:bg-[#2b2b2b] text-[#161616] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white",
                )}
              >
                {t("workbench.rawJsonl")}
              </button>
            </div>

            {targetConversationId && (
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
              title={copiedRaw ? t("common.copied") : t("workbench.copyJsonl")}
              aria-label={t("workbench.copyJsonl")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] dark:text-[#8e8e93] hover:text-[#161616] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {copiedRaw ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {activeView === "timeline" && effectiveMessages.length > 0 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#888888] dark:text-[#6e6e73] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "id" ? "Filter langkah, tool, atau teks..." : "Filter steps, tools, or text..."}
              className="w-full h-8 pl-8 pr-7 text-xs font-sans bg-black/[0.04] dark:bg-white/[0.05] rounded-lg text-[#161616] dark:text-white placeholder:text-[#888888] dark:placeholder:text-[#6e6e73] focus:outline-none focus:bg-black/[0.06] dark:focus:bg-white/[0.08] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#161616] dark:hover:text-white cursor-pointer"
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {activeView === "timeline" ? (
          <ScrollArea className="h-full w-full" scrollBarClassName="w-2">
            <div className="px-4 pb-6 pt-2 max-w-3xl mx-auto">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                  <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mb-3">
                    <Waypoints className="w-5 h-5 text-[#888888] dark:text-[#8e8e93]" />
                  </div>
                  <h3 className="text-[13px] font-medium text-[#161616] dark:text-white mb-1">
                    {searchQuery ? "No matching trajectory steps" : "No Trajectory Recorded"}
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-[#8e8e93] max-w-xs leading-relaxed">
                    {searchQuery
                      ? `No steps match "${searchQuery}".`
                      : t("workbench.noTrajectory")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col pl-2">
                  {filteredMessages.map((msg, idx) => (
                    <TrajectoryStepCard
                      key={msg.id || idx}
                      message={msg}
                      stepIndex={idx}
                      isLast={idx === filteredMessages.length - 1}
                      isThinkingExpanded={Boolean(expandedThinking[idx])}
                      onToggleThinking={() => toggleThinking(idx)}
                      expandedTools={expandedTools}
                      onToggleTool={toggleTool}
                      onOpenFilePreview={onOpenFilePreview}
                      onOpenFileDiff={onOpenFileDiff}
                      onOpenTrajectory={onOpenTrajectory}
                      onOpenBrowser={onOpenBrowser}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full w-full" scrollBarClassName="w-2">
            <div className="p-4 pr-5 font-mono text-xs leading-relaxed text-[#262626] dark:text-[#d4d4d4] select-text">
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
// TrajectoryStepCard: Calm editorial vertical thread (zero nested slop boxes)
// ---------------------------------------------------------------------------
interface TrajectoryStepCardProps {
  message: any;
  stepIndex: number;
  isLast?: boolean;
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
  const [canScrollDown, setCanScrollDown] = useState(
    () => (thinking || "").length > 220 || (thinking || "").split("\n").length > 5,
  );
  const [canScrollUp, setCanScrollUp] = useState(false);

  const checkScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    setCanScrollDown(hasOverflow && el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    setCanScrollUp(hasOverflow && el.scrollTop > 6);
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
      return "linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 28px), transparent 100%)";
    }
    if (canScrollDown) {
      return "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)";
    }
    return "linear-gradient(to bottom, transparent 0%, black 18px, black 100%)";
  }, [canScrollDown, canScrollUp]);

  return (
    <div className="mt-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2 select-text">
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
        className="max-h-52 w-full pr-2 text-xs text-[#525252] dark:text-[#b4b4ba] font-sans leading-relaxed whitespace-pre-wrap select-text [&>div>div[style]]:!block"
      >
        {thinking}
      </ScrollArea>
    </div>
  );
}

export function TrajectoryStepCard({
  message,
  stepIndex,
  isLast = false,
  isThinkingExpanded,
  onToggleThinking,
  expandedTools,
  onToggleTool,
  onOpenFilePreview,
  onOpenFileDiff,
  onOpenTrajectory,
  onOpenBrowser,
}: TrajectoryStepCardProps) {
  const { t, language } = useTranslation();
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
    <div
      className={cn(
        "relative pl-5 select-none",
        isLast ? "pb-1" : "pb-5 border-l border-black/[0.09] dark:border-white/[0.09]",
      )}
    >
      {/* Subtle spine anchor dot */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full",
          isUser
            ? "bg-[#161616] dark:bg-white"
            : "bg-[#ffffff] dark:bg-[#141414] ring-1.5 ring-[#a3a3a3] dark:ring-[#5e5e66]",
        )}
      />

      {/* Minimal step meta header */}
      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#161616] dark:text-white">
            {isUser ? t("workbench.userTurn") : t("workbench.agentTurn")}
          </span>
          <span className="text-[11px] tabular-nums text-[#888888] dark:text-[#73737a]">
            #{stepIndex + 1}
          </span>
        </div>

        {formattedTime && (
          <span className="tabular-nums text-[11px] text-[#888888] dark:text-[#73737a]">
            {formattedTime}
          </span>
        )}
      </div>

      {/* User Turn */}
      {isUser && (
        <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.05] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#161616] dark:text-white select-text">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      )}

      {/* Assistant Turn */}
      {!isUser && (
        <div className="flex flex-col gap-2.5">
          {/* Thinking / Reasoning disclosure */}
          {message.thinking && (
            <div>
              <button
                type="button"
                onClick={onToggleThinking}
                className="inline-flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-lg text-xs text-[#666666] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>{t("workbench.modelThinking")}</span>
                {isThinkingExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {isThinkingExpanded && <TrajectoryThinkingView thinking={message.thinking} />}
            </div>
          )}

          {/* Compact Tool Executions List */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-col gap-1">
              {message.toolCalls.map((tc: any, tcIdx: number) => {
                const toolKey = tc.id || `${stepIndex}_tc_${tcIdx}`;
                const isExpanded = expandedTools[toolKey] ?? false;
                const argSummary = summarizeToolArgs(tc.args);

                return (
                  <div
                    key={toolKey}
                    className="rounded-xl bg-black/[0.025] dark:bg-white/[0.03] overflow-hidden select-text"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTool(toolKey)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Terminal
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            tc.isError
                              ? "text-red-500 dark:text-red-400"
                              : "text-[#737373] dark:text-[#8e8e93]",
                          )}
                        />
                        <span className="font-mono text-xs font-medium text-[#161616] dark:text-white shrink-0">
                          {tc.name}
                        </span>
                        {argSummary && !isExpanded && (
                          <span className="text-xs text-[#737373] dark:text-[#7a7a82] truncate min-w-0 font-sans">
                            {argSummary}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {tc.isError && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            {t("common.failed")}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (tc.args || tc.result) && (
                      <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5">
                        {tc.args && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-[#737373] dark:text-[#8e8e93]">
                              {language === "id" ? "Argumen" : "Arguments"}
                            </span>
                            <ScrollArea
                              orientation="both"
                              className="max-h-40 rounded-lg bg-black/[0.04] dark:bg-[#101012]"
                              scrollBarClassName="w-1.5 h-1.5"
                            >
                              <pre className="p-2.5 font-mono text-xs leading-relaxed text-[#262626] dark:text-[#d4d4d4] whitespace-pre-wrap">
                                {formatCodePayload(tc.args)}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}

                        {tc.result && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-[#737373] dark:text-[#8e8e93]">
                              {language === "id" ? "Hasil" : "Result"}
                            </span>
                            <ScrollArea
                              orientation="both"
                              className="max-h-52 rounded-lg bg-black/[0.04] dark:bg-[#101012]"
                              scrollBarClassName="w-1.5 h-1.5"
                            >
                              <pre className="p-2.5 font-mono text-xs leading-relaxed text-[#262626] dark:text-[#d4d4d4] whitespace-pre-wrap">
                                {formatCodePayload(tc.result)}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Modified Files */}
          {message.mutations && message.mutations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                    title={target}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] text-xs text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <FileIcon filename={fileName} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{fileName}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Response Output */}
          {message.content && (
            <div className="pt-0.5 text-[13.5px] leading-relaxed text-[#161616] dark:text-white select-text">
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
