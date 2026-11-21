import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../lib/i18n";

export interface TurnNavEntry {
  readonly turn: number;
  readonly anchorKey: string;
  readonly userText: string;
  readonly assistantText?: string;
  readonly isRunning?: boolean;
  readonly timestamp?: number;
}

type RailSegment =
  | { kind: "single"; key: string; entry: TurnNavEntry }
  | { kind: "group"; key: string; entries: TurnNavEntry[] };

/** Clean and strip markdown syntax for a neat preview snippet */
function cleanPreviewText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatShortTime(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatGroupRange(entries: TurnNavEntry[]): string {
  const firstTs = entries[0]?.timestamp;
  const lastTs = entries[entries.length - 1]?.timestamp;
  const countLabel = `${entries.length} ${entries.length === 1 ? "turn" : "turns"}`;
  if (!firstTs) return countLabel;
  try {
    const startDate = new Date(firstTs);
    const dayStr = startDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const startTime = formatShortTime(firstTs);
    if (!lastTs || lastTs === firstTs) {
      return `${dayStr}, ${startTime} · ${countLabel}`;
    }
    const endTime = formatShortTime(lastTs);
    return `${dayStr}, ${startTime} – ${endTime} · ${countLabel}`;
  } catch {
    return countLabel;
  }
}

export function deriveTurnNavEntries(
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: number;
    attachments?: Array<{ name: string }>;
  }>,
  isExecuting?: boolean
): readonly TurnNavEntry[] {
  const entries: TurnNavEntry[] = [];
  let turnCoord = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || msg.role !== "user") continue;

    turnCoord += 1;
    let userText = cleanPreviewText(msg.content || "");
    if (!userText && msg.attachments && msg.attachments[0]) {
      userText = msg.attachments[0].name;
    }

    let assistantText: string | undefined;
    let isRunning = false;

    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (!next || next.role === "user") break;
      if (next.role === "assistant") {
        if (next.content) {
          assistantText = cleanPreviewText(next.content);
        } else if (isExecuting && j === messages.length - 1) {
          isRunning = true;
        }
        break;
      }
    }

    entries.push({
      turn: turnCoord,
      anchorKey: msg.id,
      userText: userText.length > 0 ? userText : `Turn ${turnCoord}`,
      assistantText,
      isRunning,
      timestamp: msg.timestamp,
    });
  }

  return entries;
}

/**
 * Builds rail segments:
 * - Up to 26 turns: every turn is an individual crisp dot.
 * - Above 26 turns: keeps the newest 4 turns as individual dots and folds older turns
 *   into compact vertical capsule pills (matching the collapsed-turns minimap UX).
 */
function buildRailSegments(entries: readonly TurnNavEntry[]): RailSegment[] {
  if (entries.length <= 45) {
    return entries.map((entry) => ({
      kind: "single" as const,
      key: entry.anchorKey,
      entry,
    }));
  }

  const tailCount = 4;
  const older = entries.slice(0, entries.length - tailCount);
  const recent = entries.slice(entries.length - tailCount);
  const groupCount = Math.min(6, Math.max(2, Math.ceil(older.length / 15)));
  const chunkSize = Math.ceil(older.length / groupCount);
  const segments: RailSegment[] = [];

  for (let i = 0; i < older.length; i += chunkSize) {
    const slice = older.slice(i, i + chunkSize);
    if (slice.length === 1 && slice[0]) {
      segments.push({ kind: "single", key: slice[0].anchorKey, entry: slice[0] });
    } else if (slice.length > 1) {
      segments.push({
        kind: "group",
        key: `group_${slice[0]!.turn}_${slice[slice.length - 1]!.turn}`,
        entries: [...slice],
      });
    }
  }

  for (const entry of recent) {
    segments.push({ kind: "single", key: entry.anchorKey, entry });
  }

  return segments;
}

function getScroller(fallback: HTMLElement | null): HTMLElement | null {
  if (fallback) {
    const radix = fallback.querySelector("[data-radix-scroll-area-viewport]");
    if (radix) return radix as HTMLElement;
    return fallback;
  }
  const chatViewport = document.querySelector("[data-chat-viewport='true'] [data-radix-scroll-area-viewport]");
  if (chatViewport) return chatViewport as HTMLElement;
  const radix = document.querySelector("[data-radix-scroll-area-viewport]");
  if (radix) return radix as HTMLElement;
  return null;
}

export interface ChatIndicatorProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: number;
    attachments?: Array<{ name: string }>;
  }>;
  isExecuting?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  conversationTitle?: string;
}

export const ChatIndicator = memo(function ChatIndicator({
  messages,
  isExecuting = false,
  scrollContainerRef,
  conversationTitle,
}: ChatIndicatorProps) {
  const { t } = useTranslation();
  const entries = useMemo(() => deriveTurnNavEntries(messages, isExecuting), [messages, isExecuting]);
  const segments = useMemo(() => buildRailSegments(entries), [entries]);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ top: number; left: number } | null>(null);
  const [isRailHovered, setIsRailHovered] = useState(false);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleSegmentEnter = (segment: RailSegment, el: HTMLElement) => {
    clearHideTimer();
    setIsRailHovered(true);
    const rect = el.getBoundingClientRect();
    const isGroup = segment.kind === "group";
    const estimatedHeight = isGroup ? Math.min(340, 88 + segment.entries.length * 30) : 132;
    const centerY = rect.top + rect.height / 2;
    let computedTop = isGroup ? centerY - estimatedHeight / 2 : centerY - 28;

    if (computedTop + estimatedHeight > window.innerHeight - 16) {
      computedTop = Math.max(16, window.innerHeight - estimatedHeight - 16);
    }
    if (computedTop < 16) {
      computedTop = 16;
    }

    setHoveredPos({
      top: Math.round(computedTop),
      left: Math.round(rect.right + 12),
    });
    setHoveredKey(segment.key);
  };

  const handleSegmentLeave = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setHoveredKey(null);
      setHoveredPos(null);
      setIsRailHovered(false);
    }, 150);
  };

  const scrollToTurn = useCallback((anchorKey: string) => {
    clearHideTimer();
    setHoveredKey(null);
    setHoveredPos(null);
    setIsRailHovered(false);
    const target = document.querySelector(`[data-chat-anchor-key="${anchorKey}"]`);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Track active visible turn on chat scroll with rAF throttle and bottom detection
  useEffect(() => {
    const el = getScroller(scrollContainerRef?.current ?? null);
    if (!el || entries.length === 0) return;

    const updateActiveTurn = () => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
      if (isAtBottom && entries.length > 0) {
        const last = entries[entries.length - 1];
        if (last) setActiveTurn(last.turn);
        return;
      }

      const viewport = el.getBoundingClientRect();
      const threshold = viewport.top + 160;
      let currentActive = entries[0]?.turn ?? null;

      for (const entry of entries) {
        const row = document.querySelector(`[data-chat-anchor-key="${entry.anchorKey}"]`);
        if (row) {
          const rect = row.getBoundingClientRect();
          if (rect.top <= threshold) {
            currentActive = entry.turn;
          }
        }
      }
      setActiveTurn(currentActive);
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateActiveTurn();
      });
    };

    updateActiveTurn();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [entries, scrollContainerRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearHideTimer();
        setHoveredKey(null);
        setHoveredPos(null);
        setIsRailHovered(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearHideTimer();
    };
  }, []);

  if (entries.length === 0) {
    return null;
  }

  const hoveredSegment = hoveredKey ? segments.find((s) => s.key === hoveredKey) ?? null : null;

  const hoverCard =
    hoveredSegment && hoveredPos && typeof document !== "undefined"
      ? createPortal(
          hoveredSegment.kind === "single" ? (
            <div
              className="fixed z-[90] w-[296px] max-w-[calc(100vw-48px)] px-3.5 py-3 bg-white dark:bg-[#191919] border border-black/10 dark:border-white/12 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.45)] cursor-pointer pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
              style={{ top: hoveredPos.top, left: hoveredPos.left }}
              role="tooltip"
              onClick={() => scrollToTurn(hoveredSegment.entry.anchorKey)}
              onPointerEnter={() => {
                clearHideTimer();
                setIsRailHovered(true);
              }}
              onPointerLeave={handleSegmentLeave}
            >
              <div className="text-[13px] font-semibold text-[#18181b] dark:text-[#f4f4f5] leading-snug mb-1.5 line-clamp-2 break-words">
                {hoveredSegment.entry.userText}
              </div>
              {hoveredSegment.entry.assistantText ? (
                <div className="text-[12px] font-normal leading-relaxed text-[#71717a] dark:text-[#a1a1aa] line-clamp-3 break-words">
                  {hoveredSegment.entry.assistantText}
                </div>
              ) : hoveredSegment.entry.isRunning ? (
                <div className="text-[11.5px] italic text-[#8e8e8e]">
                  {t("workbench.turnIndicatorRunning")}
                </div>
              ) : (
                <div className="text-[11.5px] italic text-[#8e8e8e]">
                  {t("workbench.turnIndicatorFinished")}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mt-2.5 pt-1 text-[11px] text-[#8e8e8e] dark:text-[#737373] tabular-nums">
                <span>
                  {hoveredSegment.entry.turn} of {entries.length}
                </span>
                {hoveredSegment.entry.timestamp && (
                  <span>{formatShortTime(hoveredSegment.entry.timestamp)}</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className="fixed z-[90] w-[328px] max-w-[calc(100vw-48px)] max-h-[340px] flex flex-col bg-white dark:bg-[#191919] border border-black/10 dark:border-white/12 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
              style={{ top: hoveredPos.top, left: hoveredPos.left }}
              role="tooltip"
              onPointerEnter={() => {
                clearHideTimer();
                setIsRailHovered(true);
              }}
              onPointerLeave={handleSegmentLeave}
            >
              <div className="px-3.5 pt-3 pb-2 border-b border-black/5 dark:border-white/8 shrink-0">
                <div className="text-[13.5px] font-semibold text-[#18181b] dark:text-[#f4f4f5] leading-snug line-clamp-2">
                  {conversationTitle || "Conversation turns"}
                </div>
                <div className="text-[11px] text-[#71717a] dark:text-[#8e8e8e] mt-0.5 tabular-nums">
                  {formatGroupRange(hoveredSegment.entries)}
                </div>
              </div>
              <div className="overflow-y-auto px-2 py-1.5 space-y-0.5 [scrollbar-width:thin]">
                {hoveredSegment.entries.map((item) => {
                  const isItemActive = activeTurn === item.turn;
                  return (
                    <button
                      key={item.anchorKey}
                      type="button"
                      onClick={() => scrollToTurn(item.anchorKey)}
                      className={`w-full flex items-baseline gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        isItemActive
                          ? "bg-black/8 dark:bg-white/10 text-[#18181b] dark:text-white"
                          : "text-[#3f3f46] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/8 hover:text-[#18181b] dark:hover:text-white"
                      }`}
                    >
                      <span className="text-[11px] text-[#8e8e8e] dark:text-[#737373] shrink-0 w-[52px] tabular-nums">
                        {formatShortTime(item.timestamp) || `#${item.turn}`}
                      </span>
                      <span className="text-[12.5px] truncate flex-1">{item.userText}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ),
          document.body
        )
      : null;

  return (
    <>
      <nav
        className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 select-none pointer-events-auto flex flex-col items-center py-2 px-1"
        aria-label="Conversation Turns"
        onPointerEnter={() => {
          clearHideTimer();
          setIsRailHovered(true);
        }}
        onPointerLeave={handleSegmentLeave}
      >
        <div
          className="flex flex-col items-center gap-[5px] max-h-[72vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {segments.map((segment) => {
            const isHovered = hoveredKey === segment.key;
            const isActive =
              segment.kind === "single"
                ? activeTurn === segment.entry.turn
                : segment.entries.some((e) => e.turn === activeTurn);

            if (segment.kind === "group") {
              return (
                <button
                  key={segment.key}
                  type="button"
                  onPointerEnter={(e) => handleSegmentEnter(segment, e.currentTarget)}
                  onClick={() => {
                    const first = segment.entries[0];
                    if (first) scrollToTurn(first.anchorKey);
                  }}
                  aria-label={`Turns ${segment.entries[0]?.turn}–${segment.entries[segment.entries.length - 1]?.turn}`}
                  className="p-0.5 flex items-center justify-center bg-transparent border-0 cursor-pointer outline-none"
                >
                  <span
                    className={`block rounded-full transition-all duration-150 ${
                      isHovered || isActive
                        ? "w-[5px] h-[14px] bg-[#18181b] dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                        : isRailHovered
                          ? "w-[4px] h-[13px] bg-black/45 dark:bg-white/55 hover:bg-black/80 dark:hover:bg-white/90"
                          : "w-[4px] h-[12px] bg-black/30 dark:bg-white/35"
                    }`}
                  />
                </button>
              );
            }

            return (
              <button
                key={segment.key}
                type="button"
                data-active={isActive || undefined}
                onPointerEnter={(e) => handleSegmentEnter(segment, e.currentTarget)}
                onClick={() => scrollToTurn(segment.entry.anchorKey)}
                aria-label={`Jump to turn ${segment.entry.turn}: ${segment.entry.userText}`}
                className="p-[2px] flex items-center justify-center bg-transparent border-0 cursor-pointer outline-none"
              >
                <span
                  className={`block w-[6px] h-[6px] rounded-full transition-colors duration-150 ${
                    isActive
                      ? "bg-[#18181b] dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                      : isHovered
                        ? "bg-black/80 dark:bg-white/80"
                        : isRailHovered
                          ? "bg-black/45 dark:bg-white/45"
                          : "bg-black/20 dark:bg-white/20"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>
      {hoverCard}
    </>
  );
});

export const TurnTimelineNav = ChatIndicator;
