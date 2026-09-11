import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Minimize2,
  Check,
} from "lucide-react";
import type { TodoItem } from "../../vite-env";

export interface TodoPillProps {
  todos: TodoItem[];
  className?: string;
  defaultExpanded?: boolean;
}

export function TodoPill({ todos, className = "", defaultExpanded = false }: TodoPillProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [showCompletedPanel, setShowCompletedPanel] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  if (!todos || todos.length === 0) return null;

  const completedItems = todos.filter((t) => t && t.status === "completed");
  const inProgressItems = todos.filter((t) => t && t.status === "in_progress");
  const remainingItems = todos.filter((t) => t && t.status !== "completed");

  const completedCount = completedItems.length;
  const totalCount = todos.length;
  const isAllCompleted = completedCount === totalCount;

  const activeItem = inProgressItems[0] || remainingItems[0] || completedItems[completedItems.length - 1] || todos[0];
  const activeText =
    typeof activeItem === "string"
      ? activeItem
      : activeItem?.title || activeItem?.task || activeItem?.content || "Tasks progress";

  return (
    <div className={`relative inline-block font-sans select-none ${className}`} ref={popoverRef}>
      {/* Pill Button matching Image 2 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-7 px-2.5 py-1 rounded-full flex items-center gap-2 border transition-all cursor-pointer text-xs max-w-[280px] sm:max-w-[340px] shadow-sm ${
          isOpen
            ? "bg-[#2c2c2c] border-[#444444] text-white"
            : "bg-[#202020] hover:bg-[#282828] border-[#333333] text-neutral-200"
        }`}
        title={`${completedCount}/${totalCount} completed - Click to view progress`}
      >
        {isAllCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : inProgressItems.length > 0 ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
        )}
        <span className="truncate text-left">{activeText}</span>
      </button>

      {/* Popover Card matching Image 1 */}
      {isOpen && (
        <div className="absolute top-9 left-0 z-50 flex items-start gap-2 animate-in fade-in zoom-in-95 duration-150">
          {/* Optional Completed items side panel (desktop wide mode) */}
          {showCompletedPanel && completedCount > 0 && (
            <div className="hidden md:flex flex-col w-64 max-h-80 bg-[#1c1c1c] border border-[#303030] rounded-xl p-3 shadow-2xl text-xs overflow-hidden">
              <div className="font-medium text-neutral-300 pb-2 mb-2 border-b border-[#2a2a2a] flex items-center justify-between">
                <span>{completedCount} completed</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
                {completedItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start gap-2 text-neutral-400 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="line-clamp-3">{item.title || item.task || item.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Progress Card */}
          <div className="w-72 sm:w-80 max-h-96 bg-[#1e1e1e] border border-[#333333] rounded-xl p-3 shadow-2xl text-xs flex flex-col overflow-hidden">
            {/* Header: Progress X/Y and actions */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-medium">Progress</span>
                <span className="text-emerald-400 font-mono font-medium">
                  {completedCount}/{totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimize"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Completed toggle button */}
            {completedCount > 0 && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setShowCompletedPanel((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#262626] hover:bg-[#2d2d2d] text-neutral-300 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronLeft
                      className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                        showCompletedPanel ? "-rotate-90 md:rotate-0" : "rotate-0"
                      }`}
                    />
                    <span>{completedCount} completed</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {showCompletedPanel ? "Hide" : "Show"}
                  </span>
                </button>

                {/* Mobile / Split-screen inline accordion for completed items */}
                {showCompletedPanel && (
                  <div className="md:hidden mt-1.5 p-2 rounded-lg bg-[#161616] border border-[#2a2a2a] max-h-40 overflow-y-auto space-y-1.5">
                    {completedItems.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-start gap-2 text-neutral-400 text-[11px] leading-relaxed">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="truncate">{item.title || item.task || item.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Remaining Tasks List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
              {remainingItems.length === 0 ? (
                <div className="py-3 text-center text-emerald-400/80 font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>All tasks completed!</span>
                </div>
              ) : (
                remainingItems.map((item, idx) => {
                  const isCurrent = item.status === "in_progress";
                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-start gap-2 leading-relaxed p-1.5 rounded-lg transition-colors ${
                        isCurrent ? "bg-white/[0.04] text-white" : "text-neutral-300"
                      }`}
                    >
                      {isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                      )}
                      <span className="flex-1 text-xs break-words">
                        {item.title || item.task || item.content}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
