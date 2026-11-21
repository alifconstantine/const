import React, { useEffect, useRef } from "react";
import {
  PencilSparkles,
  ListChecks,
  Goal,
  MessageCircle,
  Minimize2,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { LocalSkill } from "../../lib/db";
import type { BuiltinSlashCommand } from "../../lib/slash-commands";
import { useI18n } from "../../lib/i18n";

export interface SkillSlashPopoverProps {
  commands?: BuiltinSlashCommand[];
  skills: LocalSkill[];
  selectedIndex: number;
  selectionOrigin?: "keyboard" | "pointer";
  query?: string;
  onSelectCommand?: (command: BuiltinSlashCommand) => void;
  onSelect: (skill: LocalSkill) => void;
  onHover: (index: number) => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function orderSkillsBySections(skills: LocalSkill[]): LocalSkill[] {
  return skills;
}

function CommandIcon({
  id,
  selected,
}: {
  id: BuiltinSlashCommand["id"];
  selected: boolean;
}) {
  const cls = cn(
    "w-4 h-4 shrink-0 transition-colors",
    selected ? "text-foreground" : "text-muted-foreground",
  );
  if (id === "plan") return <ListChecks className={cls} strokeWidth={1.75} />;
  if (id === "goal") return <Goal className={cls} strokeWidth={1.75} />;
  if (id === "btw") return <MessageCircle className={cls} strokeWidth={1.75} />;
  return <Minimize2 className={cls} strokeWidth={1.75} />;
}

export function SkillSlashPopover({
  commands = [],
  skills,
  selectedIndex,
  selectionOrigin = "keyboard",
  query = "",
  onSelectCommand,
  onSelect,
  onHover,
  onOpenSettings,
  className,
}: SkillSlashPopoverProps) {
  const { language } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const totalCount = commands.length + skills.length;

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (
      Math.abs(e.clientX - lastMousePosRef.current.x) > 2 ||
      Math.abs(e.clientY - lastMousePosRef.current.y) > 2
    ) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      onHover(index);
    }
  };

  useEffect(() => {
    if (selectionOrigin !== "keyboard") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const selectedEl = viewport.querySelector<HTMLElement>('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, selectionOrigin, totalCount]);

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full mb-2 left-0 w-96 sm:w-[440px] max-w-[calc(100vw-32px)]",
        "bg-popover text-popover-foreground border border-border/80",
        "rounded-2xl shadow-2xl p-1.5 z-[70] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100",
        className,
      )}
      role="listbox"
      aria-label="Commands and Skills"
    >
      {totalCount === 0 ? (
        <div className="py-5 px-4 text-center font-sans space-y-2">
          <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <PencilSparkles className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="text-xs font-medium text-foreground">
            {language === "id" ? "Tidak ada perintah atau skill" : "No commands or skills found"}
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {language === "id"
              ? `Tidak ada yang cocok dengan "/${query}".`
              : `No match for "/${query}".`}
          </p>
          {onOpenSettings && (
            <div className="pt-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenSettings();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                {language === "id" ? "Buka Marketplace" : "Open Marketplace"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea viewportRef={viewportRef} className="max-h-72">
          <div className="flex flex-col gap-0.5">
            {commands.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  data-selected={isSelected ? "true" : "false"}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectCommand?.(cmd);
                  }}
                  onMouseMove={(e) => handleMouseMove(e, index)}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition-colors duration-75 font-sans select-none w-full cursor-pointer min-w-0",
                    isSelected
                      ? "bg-muted/90 text-foreground"
                      : "text-foreground/90 hover:bg-muted/50",
                  )}
                >
                  <CommandIcon id={cmd.id} selected={isSelected} />
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-foreground shrink-0">
                      {cmd.title}
                    </span>
                    <span className="text-[13px] text-muted-foreground truncate">
                      {language === "id" ? cmd.descriptionId : cmd.description}
                    </span>
                  </div>
                </button>
              );
            })}

            {commands.length > 0 && skills.length > 0 && (
              <div className="my-1 mx-2 border-t border-border/50" />
            )}

            {skills.map((skill, idx) => {
              const globalIdx = commands.length + idx;
              const isSelected = globalIdx === selectedIndex;
              return (
                <button
                  key={skill.id}
                  data-selected={isSelected ? "true" : "false"}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(skill);
                  }}
                  onMouseMove={(e) => handleMouseMove(e, globalIdx)}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition-colors duration-75 font-sans select-none w-full cursor-pointer min-w-0",
                    isSelected
                      ? "bg-muted/90 text-foreground"
                      : "text-foreground/90 hover:bg-muted/50",
                  )}
                >
                  <PencilSparkles
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isSelected ? "text-foreground" : "text-muted-foreground",
                    )}
                    strokeWidth={1.75}
                  />
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-foreground shrink-0 truncate max-w-[180px]">
                      {skill.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground truncate">
                      {skill.description || `/${skill.slug}`}
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
