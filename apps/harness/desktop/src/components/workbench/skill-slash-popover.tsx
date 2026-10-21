import React, { useEffect, useRef } from "react";
import { PencilSparkles } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { LocalSkill } from "../../lib/db";
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

export function orderSkillsBySections(skills: LocalSkill[]): LocalSkill[] {
  return skills;
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
  const { language } = useI18n();
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

  // Keep selected item within view
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
      aria-label="Agent Skills"
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
              ? `Tidak ada skill yang cocok dengan "/${query}". Kelola dan temukan skill di Marketplace.`
              : `No skills match "/${query}". Manage and discover skills in Marketplace.`}
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
                {language === "id" ? "Buka Marketplace" : "Open Marketplace"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea viewportRef={viewportRef} className="max-h-80 pr-1">
          <div className="flex flex-col gap-0.5">
            {skills.map((skill, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={skill.id}
                  data-selected={isSelected ? "true" : "false"}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(skill);
                  }}
                  onMouseMove={(e) => handleMouseMove(e, index)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors duration-100 font-sans group select-none w-full cursor-pointer",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <PencilSparkles className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-[13px] font-medium truncate text-foreground">
                      {skill.name}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      /{skill.slug}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
