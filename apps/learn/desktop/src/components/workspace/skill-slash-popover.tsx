import React, { useEffect, useRef } from "react";
import {
  PencilSparkles,
  PenLine,
  Sigma,
  HelpCircle,
  Video,
  Presentation,
  LayoutTemplate,
  FileText,
  FileCode,
  Code2,
  GraduationCap,
  Wrench,
  Settings,
  ChevronRight,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { LocalSkill, SkillCategory } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface SkillSlashPopoverProps {
  skills: LocalSkill[];
  selectedIndex: number;
  query?: string;
  onSelect: (skill: LocalSkill) => void;
  onHover: (index: number) => void;
  onOpenSettings?: () => void;
  className?: string;
}

function getSkillIcon(iconName?: string, category?: SkillCategory): React.ElementType {
  switch (iconName) {
    case "PenLine":
      return PenLine;
    case "Sigma":
      return Sigma;
    case "HelpCircle":
    case "Brain":
      return HelpCircle;
    case "Video":
      return Video;
    case "Presentation":
      return Presentation;
    case "LayoutTemplate":
      return LayoutTemplate;
    case "FileText":
      return FileText;
    case "FileCode":
      return FileCode;
    case "Code2":
      return Code2;
    case "GraduationCap":
      return GraduationCap;
    case "Wrench":
      return Wrench;
    case "PencilSparkles":
    case "Sparkles":
      return PencilSparkles;
    default:
      break;
  }

  switch (category) {
    case "math_science":
      return Sigma;
    case "education":
      return GraduationCap;
    case "video":
      return Video;
    case "presentation":
      return Presentation;
    case "writing":
      return PenLine;
    case "document":
      return FileText;
    case "design":
      return LayoutTemplate;
    default:
      return PencilSparkles;
  }
}

export function SkillSlashPopover({
  skills,
  selectedIndex,
  query = "",
  onSelect,
  onHover,
  onOpenSettings,
  className,
}: SkillSlashPopoverProps) {
  const { t, language } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Auto scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  if (skills.length === 0) {
    return (
      <div
        className={cn(
          "w-full mb-2 bg-[#161616] border border-[#383838] rounded-2xl shadow-2xl p-3 text-center text-xs text-muted-foreground",
          className
        )}
      >
        <p>
          {language === "id"
            ? `Tidak ada skill yang cocok dengan "/${query}"`
            : `No skills match "/${query}"`}
        </p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-foreground text-[11px] font-medium border border-[#383838] cursor-pointer transition-colors"
          >
            <Settings className="w-3 h-3 text-muted-foreground" />
            <span>{language === "id" ? "Pengaturan > Skills" : "Settings > Skills"}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full mb-2 bg-[#161616] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[300px] animate-in fade-in-0 zoom-in-95 duration-100 select-none",
        className
      )}
      role="listbox"
      aria-label={t("skills") || "Agent Skills"}
    >
      {/* Header Strip */}
      <div className="px-3.5 py-2 bg-[#1c1c1c] border-b border-[#383838] flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
            <PencilSparkles className="w-2.5 h-2.5" />
          </div>
          <span className="font-semibold text-foreground text-[11px] tracking-tight">
            {t("skillsTitle") || "Agent Skills"}
          </span>
          {query && (
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#2b2b2b] text-primary border border-primary/20">
              /{query}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {skills.length} {language === "id" ? "tersedia" : "available"}
        </span>
      </div>

      {/* Skills List with Radix ScrollArea */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div ref={listRef} className="p-1.5 space-y-0.5">
          {skills.map((skill, index) => {
            const isSelected = index === selectedIndex;
            const IconComp = getSkillIcon(skill.icon, skill.category);

            return (
              <button
                key={skill.id}
                ref={isSelected ? activeItemRef : null}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(skill)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer text-xs group",
                  isSelected
                    ? "bg-[#282828] text-foreground border border-[#404040]"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#202020] border border-transparent"
                )}
              >
                {/* Icon Container */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors border",
                    isSelected
                      ? "bg-[#333333] border-[#505050] text-primary"
                      : "bg-[#222222] border-[#333333] text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </div>

                {/* Info Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground text-xs truncate">
                      {skill.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground font-semibold px-1 py-0.2 rounded bg-[#1c1c1c] border border-[#303030]">
                      /{skill.slug}
                    </span>
                    {skill.category && (
                      <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-0.2 rounded bg-[#222222] text-[#888888] border border-[#2e2e2e] hidden sm:inline-block">
                        {skill.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate leading-snug">
                    {skill.description}
                  </p>
                </div>

                {/* Right Arrow / Selection Indicator */}
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-opacity",
                    isSelected ? "opacity-100 text-foreground" : "opacity-0 group-hover:opacity-60"
                  )}
                />
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer Navigation Hints */}
      <div className="px-3 py-1.5 bg-[#181818] border-t border-[#383838] flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#262626] border border-[#3c3c3c] text-[9px] font-mono">↑↓</kbd> {language === "id" ? "Pilih" : "Navigate"}
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#262626] border border-[#3c3c3c] text-[9px] font-mono">↵</kbd> {language === "id" ? "Terapkan" : "Select"}
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#262626] border border-[#3c3c3c] text-[9px] font-mono">Esc</kbd> {language === "id" ? "Tutup" : "Dismiss"}
          </span>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="hover:text-foreground hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span>{language === "id" ? "Kelola" : "Manage"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
