import React, { useEffect, useRef } from "react";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  BookOpen,
  Globe,
  Brain,
  HelpCircle,
  Layers,
  Presentation,
  FileSpreadsheet,
  Bookmark,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "./file-icon";
import { YouTubeSvgIcon } from "./source-icon";
import type { MentionCandidate } from "../../lib/mention-search";

export interface MentionPopoverProps {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
  onDrill?: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
  onAddSource?: () => void;
  className?: string;
}

function CandidateIcon({ candidate }: { candidate: MentionCandidate }) {
  if (candidate.kind === "source") {
    if (candidate.sourceType === "youtube") {
      return <YouTubeSvgIcon className="w-4 h-4 shrink-0" />;
    }
    if (candidate.sourceType === "url") {
      return <Globe className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (candidate.sourceType === "text") {
      return <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-sky-500 shrink-0" />;
  }

  if (candidate.kind === "artifact") {
    const at = candidate.artifactType || "";
    if (at.includes("mind")) {
      return <Brain className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
    if (at.includes("quiz")) {
      return <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (at.includes("flashcard")) {
      return <Layers className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (at.includes("slide") || at.includes("presentation")) {
      return <Presentation className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (at.includes("sheet") || at.includes("cheat")) {
      return <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    return <Sparkles className="w-4 h-4 text-primary shrink-0" />;
  }

  if (candidate.kind === "directory") {
    return <Folder className="w-4 h-4 text-muted-foreground shrink-0" />;
  }

  if (candidate.kind === "session") {
    return <Bookmark className="w-4 h-4 text-muted-foreground shrink-0" />;
  }

  if (candidate.kind === "media" || candidate.fileType === "image") {
    return <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />;
  }

  return <FileIcon filename={candidate.title} className="w-4 h-4 shrink-0" />;
}

export function MentionPopover({
  candidates,
  selectedIndex,
  onSelect,
  onDrill,
  onHover,
  onAddSource,
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

  // Group candidates into sections
  const sources = candidates.filter((c) => c.kind === "source");
  const artifacts = candidates.filter((c) => c.kind === "artifact");
  const filesAndFolders = candidates.filter(
    (c) => c.kind === "directory" || c.kind === "file" || c.kind === "media"
  );
  const notebooks = candidates.filter((c) => c.kind === "session");

  const renderSection = (title: string, items: MentionCandidate[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-1">
        <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans select-none">
          {title}
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map((candidate) => {
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
                onMouseEnter={() => onHover(globalIndex)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors duration-100 font-sans group select-none w-full",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <CandidateIcon candidate={candidate} />
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <span className="text-[13px] font-medium truncate text-foreground">
                    {candidate.title}
                  </span>
                  {candidate.subtitle && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {candidate.subtitle}
                    </span>
                  )}
                </div>
                {isDir && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDrill?.(candidate);
                    }}
                    title="Open folder"
                    className="p-1 rounded hover:bg-accent/80 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full mb-2 left-0 w-96 sm:w-[460px] max-w-[calc(100vw-32px)]",
        "bg-popover text-popover-foreground border border-border",
        "rounded-2xl shadow-2xl p-2 z-[70] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100",
        className
      )}
    >
      {candidates.length === 0 ? (
        <div className="py-5 px-4 text-center font-sans space-y-2">
          <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-foreground">
            Belum ada materi atau berkas ditemukan
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Tambahkan sumber belajar (PDF, URL web, video YouTube, atau catatan) untuk di-mention dengan @.
          </p>
          {onAddSource && (
            <div className="pt-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAddSource();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                + Tambah Sumber
              </button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="max-h-80 overflow-y-auto pr-1">
          <div className="flex flex-col gap-0.5">
            {renderSection("Sources & Study Materials", sources)}
            {renderSection("Studio Artifacts", artifacts)}
            {renderSection("Files & Folders", filesAndFolders)}
            {renderSection("Other Notebooks", notebooks)}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
