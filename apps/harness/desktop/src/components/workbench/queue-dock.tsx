import React, { useState } from "react";
import {
  MessageSquare,
  Trash2,
  ArrowUp,
  SquarePen,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  cn,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type { AttachedFile } from "./chat-card";

export interface QueuedMessageItem {
  id: string;
  conversationId: string;
  prompt: string;
  attachments?: AttachedFile[];
  timestamp: number;
}

export interface QueueDockProps {
  items: QueuedMessageItem[];
  onSteerItem: (item: QueuedMessageItem) => void;
  onRemoveItem: (id: string) => void;
  onEditItem?: (id: string, newText: string) => void;
  className?: string;
}

export function QueueDock({
  items,
  onSteerItem,
  onRemoveItem,
  onEditItem,
  className = "",
}: QueueDockProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  if (!items || items.length === 0) return null;

  const handleStartEdit = (item: QueuedMessageItem) => {
    setEditingId(item.id);
    setEditingText(item.prompt);
  };

  const handleSaveEdit = (id: string) => {
    if (editingText.trim()) {
      onEditItem?.(id, editingText.trim());
    }
    setEditingId(null);
    setEditingText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-queue-dock=""
        className={cn(
          "w-full bg-[#f8f8fa] dark:bg-[#202022] border border-[#e2e2e4] dark:border-[#383838] border-b-0 rounded-t-2xl overflow-hidden transition-all duration-150 select-none font-sans z-10",
          className
        )}
      >
        {/* Multi-item Collapsible Header */}
        {items.length > 1 && (
          <div
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center justify-between px-3.5 py-1.5 border-b border-[#e2e2e4]/70 dark:border-[#383838]/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer text-neutral-500 dark:text-neutral-400 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {t("workbench.queueCount").replace("{n}", String(items.length))}
              </span>
            </div>
            <button
              type="button"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              aria-label={isCollapsed ? "Expand queue" : "Collapse queue"}
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Queued Message Rows */}
        {(!isCollapsed || items.length === 1) && (
          <div className="flex flex-col divide-y divide-[#e2e2e4]/60 dark:divide-[#383838]/60">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              const hasAttachments = item.attachments && item.attachments.length > 0;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2.5 px-3.5 py-2 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                >
                  {/* Left: Message Icon + Text / Inline Editor */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(item.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-white dark:bg-[#2a2a2c] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-0.5 rounded border border-[#e2e2e4] dark:border-[#444] outline-none ring-1 ring-primary/40"
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[13px] text-neutral-800 dark:text-neutral-200 font-normal truncate block">
                          {item.prompt || "(Empty prompt)"}
                        </span>

                        {hasAttachments && (
                          <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400">
                            {item.attachments![0]?.type === "image" ? (
                              <ImageIcon className="w-3 h-3" />
                            ) : (
                              <FileText className="w-3 h-3" />
                            )}
                            <span>{item.attachments!.length}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                              aria-label="Save"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Save
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                              aria-label="Cancel"
                            >
                              <X className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Cancel
                          </TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        {/* Edit Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/80 transition-colors"
                              aria-label={t("workbench.editQueuedMessage")}
                            >
                              <SquarePen className="w-3.5 h-3.5 stroke-[1.75]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {t("workbench.editQueuedMessage")}
                          </TooltipContent>
                        </Tooltip>

                        {/* Remove / Trash Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              aria-label={t("workbench.removeQueuedMessage")}
                            >
                              <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {t("workbench.removeQueuedMessage")}
                          </TooltipContent>
                        </Tooltip>

                        {/* Steer / Send Now Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onSteerItem(item)}
                              className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              aria-label={t("workbench.steerMessage")}
                            >
                              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {t("workbench.steerMessage")}
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
