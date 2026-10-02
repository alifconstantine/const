import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, Circle, Check, ChevronDown, MoreHorizontal } from "lucide-react";
import type { TodoItem } from "../../vite-env";

export interface FloatingTodoCardProps {
  todos: TodoItem[];
  isExecuting?: boolean;
  className?: string;
}

export function FloatingTodoCard({
  todos,
  isExecuting = false,
  className = "",
}: FloatingTodoCardProps) {
  // Auto-expand while executing; auto-close when execution completes
  const [isOpen, setIsOpen] = useState(isExecuting);
  const wasExecutingRef = useRef(isExecuting);

  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      setIsOpen(true);
    } else if (!isExecuting && wasExecutingRef.current) {
      setIsOpen(false);
    }
    wasExecutingRef.current = isExecuting;
  }, [isExecuting]);

  if (!todos || todos.length === 0) return null;

  const completedCount = todos.filter((t) => t && t.status === "completed").length;
  const totalCount = todos.length;

  return (
    <div
      className={`absolute top-4 right-6 z-30 w-72 sm:w-80 rounded-lg bg-white dark:bg-[#2b2b2b] border border-[#e2e2e4] dark:border-[#383838] shadow-xl font-sans select-none overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      {/* Header matching Image 1: Progress X/Y ... ⌵ */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between px-3.5 py-2 bg-white dark:bg-[#2b2b2b] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#777777] dark:text-[#a0a0a0] font-medium text-xs">Progress</span>
          <span className="text-[#222222] dark:text-[#e0e0e0] font-sans tabular-nums text-xs font-semibold">
            {completedCount}/{totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[#777777] dark:text-[#a0a0a0]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            title={isOpen ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                isOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expanded Checklist matching Image 1 */}
      {isOpen && (
        <div className="border-t border-[#e2e2e4] dark:border-[#383838] p-3 max-h-72 overflow-y-auto space-y-2.5">
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
                  className={`text-xs leading-snug break-words flex-1 ${
                    status === "in_progress"
                      ? "text-[#1c1c1e] dark:text-white font-medium"
                      : status === "completed"
                      ? "text-[#888888] dark:text-[#777777] line-through opacity-80"
                      : "text-[#444444] dark:text-[#b8b8b8]"
                  }`}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
