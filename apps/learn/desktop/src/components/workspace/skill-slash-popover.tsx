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
  Sparkles,
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

function SkillIcon({ skill }: { skill: LocalSkill }) {
  const cat = skill.category;
  if (cat === "writing") {
    return <PenLine className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
  if (cat === "math_science") {
    return <Sigma className="w-4 h-4 text-purple-500 shrink-0" />;
  }
  if (cat === "video") {
    return <Video className="w-4 h-4 text-rose-500 shrink-0" />;
  }
  if (cat === "presentation") {
    return <Presentation className="w-4 h-4 text-amber-500 shrink-0" />;
  }
  if (cat === "document") {
    return <FileText className="w-4 h-4 text-sky-500 shrink-0" />;
  }
  if (cat === "design") {
    return <LayoutTemplate className="w-4 h-4 text-pink-500 shrink-0" />;
  }
  if (cat === "education") {
    return <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" />;
  }
  return <PencilSparkles className="w-4 h-4 text-primary shrink-0" />;
}

export interface SkillCategorySection {
  id: string;
  title: string;
  match: (skill: LocalSkill) => boolean;
}

export const SKILL_SECTIONS: SkillCategorySection[] = [
  {
    id: "writing",
    title: "Writing & Reasoning",
    match: (s) => s.category === "writing",
  },
  {
    id: "math_science",
    title: "Math & Animation",
    match: (s) => s.category === "math_science",
  },
  {
    id: "design",
    title: "Design & UI",
    match: (s) => s.category === "design",
  },
  {
    id: "docs",
    title: "Documents & Slides",
    match: (s) => s.category === "document" || s.category === "presentation",
  },
  {
    id: "video",
    title: "Video & Motion",
    match: (s) => s.category === "video",
  },
  {
    id: "education",
    title: "Guides & Frameworks",
    match: (s) => s.category === "education",
  },
  {
    id: "other",
    title: "Custom Skills",
    match: (s) =>
      !s.category ||
      (s.category !== "writing" &&
        s.category !== "math_science" &&
        s.category !== "design" &&
        s.category !== "document" &&
        s.category !== "presentation" &&
        s.category !== "video" &&
        s.category !== "education"),
  },
];

/**
 * Orders skills strictly by visual category sections.
 * Guarantees that skills[0] is the top-most visible item in the popover,
 * and keyboard navigation (ArrowUp/ArrowDown) flows strictly in visual order.
 */
export function orderSkillsBySections(skills: LocalSkill[]): LocalSkill[] {
  const result: LocalSkill[] = [];
  for (const section of SKILL_SECTIONS) {
    const items = skills.filter(section.match);
    result.push(...items);
  }
  return result;
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (
      Math.abs(e.clientX - lastMousePosRef.current.x) > 2 ||
      Math.abs(e.clientY - lastMousePosRef.current.y) > 2
    ) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      onHover(index);
    }
  };

  // Directly adjust viewport scroll position so the active item and its section header are always in view
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (selectedIndex === 0) {
      viewport.scrollTop = 0;
      return;
    }

    if (selectedIndex === skills.length - 1) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }

    const selectedEl = viewport.querySelector<HTMLElement>('[data-selected="true"]');
    if (!selectedEl) return;

    const vRect = viewport.getBoundingClientRect();
    const elRect = selectedEl.getBoundingClientRect();

    if (elRect.bottom > vRect.bottom) {
      viewport.scrollTop += (elRect.bottom - vRect.bottom) + 28;
    } else if (elRect.top < vRect.top) {
      viewport.scrollTop -= (vRect.top - elRect.top) + 28;
    }
  }, [selectedIndex, skills.length]);

  const renderSection = (title: string, items: LocalSkill[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-1">
        <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans select-none">
          {title}
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map((skill) => {
            const globalIndex = skills.indexOf(skill);
            const isSelected = globalIndex === selectedIndex;

            return (
              <button
                key={skill.id}
                data-selected={isSelected ? "true" : "false"}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(skill);
                }}
                onMouseMove={(e) => handleMouseMove(e, globalIndex)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors duration-100 font-sans group select-none w-full",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <SkillIcon skill={skill} />
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate text-foreground">
                      {skill.name}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      /{skill.slug}
                    </span>
                  </div>
                  {skill.description && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {skill.description}
                    </span>
                  )}
                </div>
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
      role="listbox"
      aria-label={t("skills") || "Agent Skills"}
    >
      {skills.length === 0 ? (
        <div className="py-5 px-4 text-center font-sans space-y-2">
          <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <PencilSparkles className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-foreground">
            {language === "id" ? "Belum ada skill ditemukan" : "No skills found"}
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {language === "id"
              ? `Tidak ada skill yang cocok dengan "/${query}". Kelola atau tambahkan skill di halaman Skills.`
              : `No skills match "/${query}". Manage or add new skills on the Skills page.`}
          </p>
          {onOpenSettings && (
            <div className="pt-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenSettings();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                {language === "id" ? "Buka Halaman Skills" : "Open Skills Page"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea viewportRef={viewportRef} className="max-h-80 pr-1">
          <div className="flex flex-col gap-0.5">
            {SKILL_SECTIONS.map((section) =>
              renderSection(
                section.title,
                skills.filter(section.match)
              )
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
