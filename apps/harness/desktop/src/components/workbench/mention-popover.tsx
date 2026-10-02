import React, { useEffect, useRef } from "react";
import {
  Folder,
  FileCode,
  FileText,
  File,
  Image as ImageIcon,
  MessageSquare,
  Globe,
  Terminal,
  CornerDownLeft,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { MentionCandidate } from "../../lib/mention-search";

export interface MentionPopoverProps {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
  query: string;
  className?: string;
}

/**
 * Highlights matches of query within a string.
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) {
    return <span>{text}</span>;
  }
  const cleanQ = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(cleanQ);

  if (idx === -1) {
    // If not a continuous substring, show normal text
    return <span>{text}</span>;
  }

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + cleanQ.length);
  const after = text.slice(idx + cleanQ.length);

  return (
    <span>
      {before}
      <span className="font-semibold text-black dark:text-white underline decoration-amber-500/70 underline-offset-2">
        {match}
      </span>
      {after}
    </span>
  );
}

function CandidateIcon({ candidate }: { candidate: MentionCandidate }) {
  if (candidate.kind === "directory") {
    return <Folder className="w-3.5 h-3.5 text-[#e79737] shrink-0" />;
  }
  if (candidate.kind === "session") {
    return <MessageSquare className="w-3.5 h-3.5 text-[#6366f1] shrink-0" />;
  }
  if (candidate.kind === "tool") {
    if (candidate.id === "tool-browser") {
      return <Globe className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />;
    }
    if (candidate.id === "tool-terminal") {
      return <Terminal className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />;
    }
    return <Globe className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />;
  }

  // File types
  const fType = candidate.fileType;
  if (fType === "code") {
    return <FileCode className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />;
  }
  if (fType === "image") {
    return <ImageIcon className="w-3.5 h-3.5 text-[#10b981] shrink-0" />;
  }
  if (fType === "doc") {
    return <FileText className="w-3.5 h-3.5 text-[#a855f7] shrink-0" />;
  }
  return <File className="w-3.5 h-3.5 text-[#888888] shrink-0" />;
}

export function MentionPopover({
  candidates,
  selectedIndex,
  onSelect,
  onHover,
  query,
  className,
}: MentionPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Auto scroll into view as user navigates with keyboard
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full mb-2 left-0 w-80 sm:w-96 max-w-[calc(100vw-32px)]",
        "bg-white/95 dark:bg-[#1e1d1b]/95 backdrop-blur-md",
        "border border-[#e2e2e4] dark:border-[#383838]",
        "rounded-2xl shadow-2xl p-1.5 z-[70] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100",
        className
      )}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between px-2.5 py-1 mb-1 border-b border-[#e2e2e4] dark:border-[#383838]/60 text-[11px] text-[#888888] dark:text-[#888888]">
        <div className="flex items-center gap-1.5 font-medium">
          <span>Mentions</span>
          {query ? (
            <span className="font-mono text-[#262626] dark:text-[#d4d4d4] bg-black/5 dark:bg-white/10 px-1.5 py-0.2 rounded text-[10px]">
              @{query}
            </span>
          ) : (
            <span className="text-[10px] text-[#a9a9a9] dark:text-[#666666]">
              (type to filter)
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-[#a9a9a9] dark:text-[#666666]">
          {candidates.length} result{candidates.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Candidates List */}
      {candidates.length === 0 ? (
        <div className="py-6 px-3 text-center text-xs text-[#888888] dark:text-[#777777]">
          No matching files, sessions, or tools for &ldquo;{query}&rdquo;
        </div>
      ) : (
        <ScrollArea className="max-h-64 overflow-y-auto">
          <div className="flex flex-col gap-0.5 py-0.5">
            {candidates.map((candidate, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={candidate.id}
                  ref={isSelected ? activeItemRef : undefined}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent stealing textarea focus
                    e.preventDefault();
                    onSelect(candidate);
                  }}
                  onMouseMove={() => {
                    if (!isSelected) {
                      onHover(index);
                    }
                  }}
                  className={cn(
                    "w-full px-2.5 py-1.5 flex items-center justify-between text-xs rounded-xl transition-colors cursor-pointer group text-left",
                    isSelected
                      ? "bg-black/5 dark:bg-white/10 text-[#171717] dark:text-white"
                      : "text-[#444444] dark:text-[#cccccc] hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  {/* Left: Icon and Title/Subtitle */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-black/5 dark:bg-white/15"
                          : "bg-black/[0.03] dark:bg-white/[0.05]"
                      )}
                    >
                      <CandidateIcon candidate={candidate} />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 text-left">
                      <div className="text-[12.5px] font-medium leading-tight truncate">
                        <HighlightText text={candidate.title} query={query} />
                      </div>
                      {candidate.subtitle && (
                        <div className="text-[10px] text-[#888888] dark:text-[#777777] leading-tight truncate font-mono mt-0.5">
                          {candidate.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Badge / Enter Icon */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {candidate.badge && (
                      <span
                        className={cn(
                          "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider",
                          isSelected
                            ? "bg-black/10 dark:bg-white/20 text-[#222222] dark:text-white"
                            : "bg-black/[0.04] dark:bg-white/[0.06] text-[#888888] dark:text-[#777777]"
                        )}
                      >
                        {candidate.badge}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3 h-3 text-[#888888] dark:text-[#aaaaaa] shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Popover Footer Shortcut Hint */}
      <div className="mt-1 pt-1 border-t border-[#e2e2e4] dark:border-[#383838]/60 px-2 py-0.5 flex items-center justify-between text-[10px] text-[#a9a9a9] dark:text-[#666666]">
        <span>↑↓ Navigate</span>
        <span>↵ or Tab Select</span>
        <span>Esc Dismiss</span>
      </div>
    </div>
  );
}
