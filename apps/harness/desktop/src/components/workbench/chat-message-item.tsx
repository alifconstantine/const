import React, { useState, memo } from "react";
import { Check, Copy, Pencil, ThumbsUp, ThumbsDown } from "lucide-react";
import { ScrollArea, UserMessageBubble, cn } from "@const/ui";
import type { FileMutationRecord, TraceStep } from "../../vite-env";
import { MarkdownContent } from "./markdown-content";
import { ExecutionTrace, MutationsSummaryCard } from "./execution-trace";
import { InlineMessageEditor } from "./inline-message-editor";
import { useTranslation } from "../../lib/i18n";
import { AssistantResponse } from "../intelligence-ui/assistant-response";
import { assistantResponseToText } from "../intelligence-ui/protocol";
import type { IntelligenceUiState } from "../intelligence-ui/schema";
import { messageApps } from "../../lib/mcp/apps";
import { McpAppCard } from "../mcp-apps/app-card";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  thinking?: string;
  traceSteps?: TraceStep[];
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: any;
    result?: any;
    isError?: boolean;
  }>;
  mutations?: FileMutationRecord[];
  timestamp?: number;
  durationMs?: number;
  intelligenceUiState?: IntelligenceUiState;
  attachments?: any[];
}

export interface ChatMessageItemProps {
  message: ChatMessage | any;
  idx?: number;
  isExecuting?: boolean;
  liveDurationMs?: number;
  activeApproval?: any;
  expandedUserMessageId?: string | null;
  onToggleExpandUserMessage?: (id: string | null) => void;
  copiedId?: string | null;
  onCopyMessage?: (id: string, content: string) => void;
  onEditMessage?: (content: string) => void;
  isEditing?: boolean;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (messageId: string, newContent: string, messageIdx: number, attachments?: any[]) => void;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onAnswerQuestion?: (toolCallId: string, answer: any) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onOpenFilePreview?: (filePath: string, content?: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
  onOpenReview?: (mutations?: FileMutationRecord[]) => void;
  onOpenSubAgent?: (step: TraceStep) => void;
  renderAttachment?: (att: any) => React.ReactNode;
  userBubbleWidthClass?: string;
  isReadOnly?: boolean;
  isConversationBusy?: boolean;
  onIntelligenceStateChange?: (messageId: string, blockId: string, state: Record<string, unknown>) => void;
  onIntelligenceSubmit?: (prompt: string) => void | Promise<void>;
  onFeedback?: (id: string, type: "good" | "bad") => void;
  feedback?: "good" | "bad";
}

export function formatMessageTimestamp(timestamp?: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) {
    return timeStr;
  }
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day} ${timeStr}`;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  idx = 0,
  isExecuting = false,
  liveDurationMs,
  activeApproval,
  expandedUserMessageId,
  onToggleExpandUserMessage,
  copiedId,
  onCopyMessage,
  onEditMessage,
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRollback,
  onRollbackAll,
  onAnswerQuestion,
  onOpenFileDiff,
  onOpenFilePreview,
  onOpenTrajectory,
  onOpenBrowser,
  onOpenReview,
  onOpenSubAgent,
  renderAttachment,
  userBubbleWidthClass = "max-w-[85%] sm:max-w-[78%] md:max-w-[72%]",
  isReadOnly = false,
  isConversationBusy = false,
  onIntelligenceStateChange,
  onIntelligenceSubmit,
  onFeedback,
  feedback,
}: ChatMessageItemProps) {
  const { t } = useTranslation();
  const [internalCopied, setInternalCopied] = useState(false);
  const [internalFeedback, setInternalFeedback] = useState<"good" | "bad" | null>(null);

  if (!message) return null;

  if (message.role === "user") {
    if (isEditing) {
      return (
        <div className="w-full flex flex-col items-end group">
          <InlineMessageEditor
            initialContent={message.content || ""}
            initialAttachments={message.attachments}
            onSubmit={(newContent, newAttachments) => {
              onSubmitEdit?.(message.id, newContent, idx, newAttachments);
            }}
            onCancel={() => {
              onCancelEdit?.();
            }}
            userBubbleWidthClass={userBubbleWidthClass}
          />
        </div>
      );
    }

    const isLongPrompt =
      (message.content || "").length > 250 || (message.content || "").split("\n").length > 4;
    const isExpanded = expandedUserMessageId === message.id;

    return (
      <div className="w-full flex flex-col items-end group">
        {/* Attached Files (if any) */}
        {message.attachments && message.attachments.length > 0 && renderAttachment && (
          <div className={cn("flex flex-wrap gap-2 mb-2 justify-end", userBubbleWidthClass)}>
            {message.attachments.map((att: any) => renderAttachment(att))}
          </div>
        )}

        {/* User message bubble */}
        <UserMessageBubble
          data-expanded-prompt={message.id}
          onClick={() => {
            if (isReadOnly) return;
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) return;
            if (isLongPrompt && !isExpanded) {
              onToggleExpandUserMessage?.(message.id);
            }
          }}
          className={cn(
            "shadow-xs transition-all duration-200",
            userBubbleWidthClass,
            !isReadOnly && isLongPrompt && !isExpanded && "cursor-pointer hover:border-[#b0b0b0] dark:hover:border-[#484848]"
          )}
        >
          {isLongPrompt && !isReadOnly ? (
            <>
              <ScrollArea
                className={cn(
                  "w-full transition-[max-height] duration-200 ease-in-out",
                  isExpanded ? "max-h-[380px]" : "max-h-24"
                )}
                viewportClassName={cn(
                  "[&>div[style]]:!block",
                  !isExpanded && "!overflow-hidden"
                )}
                scrollBarClassName={!isExpanded ? "!hidden" : undefined}
              >
                <div className="pr-2">
                  <MarkdownContent
                    content={message.content}
                    onOpenFilePreview={onOpenFilePreview}
                    onOpenTrajectory={onOpenTrajectory}
                    onOpenBrowser={onOpenBrowser}
                    variant="user"
                  />
                </div>
              </ScrollArea>
              {!isExpanded && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#f0f0f0] via-[#f0f0f0]/80 dark:from-[#222222] dark:via-[#222222]/80 to-transparent"
                />
              )}
            </>
          ) : (
            <MarkdownContent
              content={message.content}
              onOpenFilePreview={onOpenFilePreview}
              onOpenTrajectory={onOpenTrajectory}
              onOpenBrowser={onOpenBrowser}
              variant="user"
            />
          )}
        </UserMessageBubble>

        {/* User action bar (Copy, Edit, Timestamp) - hidden in read-only mode */}
        {!isReadOnly && !isEditing && (
          <div className="flex items-center gap-2 pt-1.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#a9a9a9] dark:text-[#888888] select-none font-sans">
            {message.timestamp && (
              <span className="text-[11px] font-sans tabular-nums text-[#a9a9a9] dark:text-[#777777]">
                {formatMessageTimestamp(message.timestamp)}
              </span>
            )}
            {onCopyMessage && (
              <button
                type="button"
                onClick={() => onCopyMessage(message.id, message.content)}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                title={t("workbench.copyMessage")}
              >
                {copiedId === message.id ? (
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {!isExecuting && (onStartEdit || onEditMessage) && (
              <button
                type="button"
                onClick={() => {
                  if (onStartEdit) {
                    onStartEdit(message.id);
                  } else {
                    onEditMessage?.(message.content);
                  }
                }}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                title={t("workbench.editMessage")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Assistant message
  const activeFeedback = feedback !== undefined ? feedback : internalFeedback;
  const isCopied = copiedId === message.id || internalCopied;

  return (
    <div className="w-full flex flex-col gap-2.5 group select-text cursor-text">
      <ExecutionTrace
        thinking={message.thinking}
        toolCalls={message.toolCalls}
        traceSteps={message.traceSteps}
        mutations={message.mutations}
        isExecuting={isExecuting}
        pendingApprovalToolCallId={isExecuting ? activeApproval?.toolCallId : undefined}
        durationMs={isExecuting ? liveDurationMs : message.durationMs}
        onRollback={onRollback}
        onRollbackAll={onRollbackAll}
        onAnswerQuestion={onAnswerQuestion}
        onOpenFileDiff={onOpenFileDiff}
        onOpenFilePreview={onOpenFilePreview}
        onOpenReview={onOpenReview ? () => onOpenReview(message.mutations) : undefined}
        onOpenSubAgent={onOpenSubAgent}
        onOpenBrowser={onOpenBrowser}
      />

      {/* Formatted Markdown Content */}
      {messageApps(message).map(app => <McpAppCard key={app.id} app={app} onOpenFile={onOpenFilePreview} />)}
      {message.content ? (
        <div className="px-0.5 select-text cursor-text">
          <AssistantResponse
            content={message.content}
            isStreaming={isExecuting}
            disabled={isReadOnly || isConversationBusy}
            state={message.intelligenceUiState}
            onStateChange={onIntelligenceStateChange ? (blockId, state) => onIntelligenceStateChange(message.id, blockId, state) : undefined}
            onSubmit={onIntelligenceSubmit}
            onOpenFilePreview={onOpenFilePreview}
            onOpenTrajectory={onOpenTrajectory}
            onOpenBrowser={onOpenBrowser}
          />
        </div>
      ) : null}

      {/* Changed Files Summary Card (only if mutations exist and execution finished) */}
      {!isExecuting && message.mutations && message.mutations.length > 0 && onRollback && (
        <MutationsSummaryCard
          mutations={message.mutations}
          isExecuting={false}
          onRollback={onRollback}
          onRollbackAll={onRollbackAll}
          onOpenReview={onOpenReview ? () => onOpenReview(message.mutations) : undefined}
          onOpenFileDiff={onOpenFileDiff}
        />
      )}

      {/* Assistant hover action bar: Copy, Good, Bad, and Timestamp */}
      {!isExecuting && message.content && (
        <div className="flex items-center gap-1.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#a9a9a9] dark:text-[#888888] select-none pointer-events-none group-hover:pointer-events-auto font-sans">
          <button
            type="button"
            onClick={async () => {
              if (onCopyMessage) {
                onCopyMessage(message.id, message.content);
              } else if (message.content) {
                try {
                  await navigator.clipboard.writeText(assistantResponseToText(message.content));
                  setInternalCopied(true);
                  setTimeout(() => setInternalCopied(false), 2000);
                } catch {}
              }
            }}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
            title={t("workbench.copyResponse")}
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-[#4ade80]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onFeedback) {
                onFeedback(message.id, "good");
              } else {
                setInternalFeedback((prev) => (prev === "good" ? null : "good"));
              }
            }}
            className={cn(
              "p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
              activeFeedback === "good"
                ? "text-[#4ade80]"
                : "text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
            )}
            title={t("workbench.goodResponse")}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (onFeedback) {
                onFeedback(message.id, "bad");
              } else {
                setInternalFeedback((prev) => (prev === "bad" ? null : "bad"));
              }
            }}
            className={cn(
              "p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
              activeFeedback === "bad"
                ? "text-[#ef4444]"
                : "text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
            )}
            title={t("workbench.badResponse")}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
          {message.timestamp && (
            <span className="text-[11px] font-sans tabular-nums text-[#a9a9a9] dark:text-[#777777] ml-1.5">
              {formatMessageTimestamp(message.timestamp)}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
