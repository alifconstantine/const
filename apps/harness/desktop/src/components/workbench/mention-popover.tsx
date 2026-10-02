import React, { useEffect, useRef } from "react";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "./file-icon";
import type { MentionCandidate } from "../../lib/mention-search";

export interface MentionPopoverProps {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
  onDrill?: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
  className?: string;
}

function CandidateIcon({ candidate }: { candidate: MentionCandidate }) {
  if (candidate.kind === "directory") {
    return <Folder className="w-4 h-4 text-[#888888] dark:text-[#a0a0a0] stroke-[1.75] shrink-0" />;
  }
  if (candidate.kind === "session") {
    return <MessageSquare className="w-4 h-4 text-[#888888] dark:text-[#a0a0a0] stroke-[1.75] shrink-0" />;
  }
  if (candidate.kind === "media" || candidate.fileType === "image") {
    return <ImageIcon className="w-4 h-4 text-[#888888] dark:text-[#a0a0a0] stroke-[1.75] shrink-0" />;
  }
  return <FileIcon filename={candidate.title} className="w-4 h-4 shrink-0" />;
}

export function MentionPopover({
  candidates,
  selectedIndex,
  onSelect,
  onDrill,
  onHover,
  className,
}: MentionPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Auto scroll active item into view as user navigates
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Separate candidates into Files & folders vs Sessions
  const filesAndFolders = candidates.filter(
    (c) => c.kind === "directory" || c.kind === "file" || c.kind === "media"
  );
  const sessions = candidates.filter((c) => c.kind === "session");

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full mb-2 left-0 w-96 sm:w-[480px] max-w-[calc(100vw-32px)]",
        "bg-[#ffffff] dark:bg-[#222222]",
        "border border-[#e2e2e4] dark:border-[#383838]",
        "rounded-2xl shadow-2xl p-1.5 z-[70] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100",
        className
      )}
    >
      {candidates.length === 0 ? (
        <div className="py-6 px-4 text-center text-xs text-[#888888] dark:text-[#777777] font-sans">
          No files, folders, or sessions found
        </div>
      ) : (
        <ScrollArea className="max-h-80 overflow-y-auto pr-1">
          <div className="flex flex-col gap-0.5">
            {/* 1. Files & folders Section */}
            {filesAndFolders.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1.5 text-[12px] font-medium text-[#888888] dark:text-[#888888] font-sans select-none">
                  Files &amp; folders
                </div>
                <div className="flex flex-col gap-0.5">
                  {filesAndFolders.map((candidate) => {
                    const globalIndex = candidates.indexOf(candidate);
                    const isSelected = globalIndex === selectedIndex;
                    const isDir = candidate.kind === "directory";

                    return (
                      <button
                        key={candidate.id}
                        ref={isSelected ? activeItemRef : undefined}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelect(candidate);
                        }}
                        onMouseMove={() => {
                          if (!isSelected) {
                            onHover(globalIndex);
                          }
                        }}
                        className={cn(
                          "w-full px-3 py-2 flex items-center justify-between rounded-xl transition-colors cursor-pointer group text-left font-sans",
                          isSelected
                            ? "bg-black/5 dark:bg-white/10 text-black dark:text-white"
                            : "text-[#262626] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {/* Left: Icon and Name */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <CandidateIcon candidate={candidate} />
                          <span
                            className={cn(
                              "text-[13px] leading-tight truncate",
                              isSelected ? "font-medium" : "font-normal"
                            )}
                          >
                            {candidate.title}
                          </span>
                        </div>

                        {/* Right: Browse folder Tab hint or subtle chevron for directories */}
                        {isDir ? (
                          isSelected ? (
                            <div
                              role="button"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDrill?.(candidate);
                              }}
                              className="flex items-center gap-1.5 text-[11px] text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white shrink-0 font-sans"
                            >
                              <span>Browse folder</span>
                              <kbd className="px-1.5 py-0.5 text-[10px] font-sans bg-black/10 dark:bg-white/10 rounded border border-black/10 dark:border-white/10 text-[#666666] dark:text-[#a0a0a0]">
                                Tab
                              </kbd>
                              <ChevronRight className="w-3.5 h-3.5 text-[#888888] dark:text-[#a0a0a0]" />
                            </div>
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0] dark:text-[#555555] shrink-0" />
                          )
                        ) : candidate.subtitle ? (
                          <span className="text-[11px] text-[#888888] dark:text-[#777777] font-sans shrink-0 truncate max-w-[140px]">
                            {candidate.subtitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Sessions Section */}
            {sessions.length > 0 && (
              <div>
                <div className="px-3 pt-3 pb-1.5 text-[12px] font-medium text-[#888888] dark:text-[#888888] font-sans select-none">
                  Sessions
                </div>
                <div className="flex flex-col gap-0.5">
                  {sessions.map((candidate) => {
                    const globalIndex = candidates.indexOf(candidate);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={candidate.id}
                        ref={isSelected ? activeItemRef : undefined}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelect(candidate);
                        }}
                        onMouseMove={() => {
                          if (!isSelected) {
                            onHover(globalIndex);
                          }
                        }}
                        className={cn(
                          "w-full px-3 py-2 flex items-center justify-between rounded-xl transition-colors cursor-pointer group text-left font-sans",
                          isSelected
                            ? "bg-black/5 dark:bg-white/10 text-black dark:text-white"
                            : "text-[#262626] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {/* Left: Speech Icon and Title */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <CandidateIcon candidate={candidate} />
                          <span
                            className={cn(
                              "text-[13px] leading-tight truncate",
                              isSelected ? "font-medium" : "font-normal"
                            )}
                          >
                            {candidate.title}
                          </span>
                        </div>

                        {/* Right: Project path · Relative time */}
                        {candidate.subtitle && (
                          <span className="text-[11.5px] text-[#888888] dark:text-[#777777] font-sans shrink-0 ml-2">
                            {candidate.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
