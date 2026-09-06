import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TurnNavEntry {
  readonly turn: number;
  readonly anchorKey: string;
  readonly userText: string;
  readonly assistantText?: string;
  readonly isRunning?: boolean;
}

/** Clean and strip markdown syntax for a neat preview snippet */
function cleanPreviewText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "") // remove code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/[*_~]/g, "") // bold/italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();
}

export function deriveTurnNavEntries(
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
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

    // Find subsequent assistant reply in the same turn
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
    });
  }

  return entries;
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
    attachments?: Array<{ name: string }>;
  }>;
  isExecuting?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export const ChatIndicator = memo(function ChatIndicator({
  messages,
  isExecuting = false,
  scrollContainerRef,
}: ChatIndicatorProps) {
  const entries = useMemo(
    () => deriveTurnNavEntries(messages, isExecuting),
    [messages, isExecuting]
  );
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ top: number; left: number } | null>(null);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handlePointerEnter = (turn: number, el: HTMLElement) => {
    clearHideTimer();
    const rect = el.getBoundingClientRect();
    // Align card so its first line of text (title) is vertically aligned with the dash
    // Padding top (12px) + half line-height (9px) = 21px
    const dashCenterY = rect.top + rect.height / 2;
    let computedTop = dashCenterY - 21;

    // Viewport bottom safety clamp
    const estimatedHeight = 120;
    if (computedTop + estimatedHeight > window.innerHeight - 16) {
      computedTop = Math.max(16, window.innerHeight - estimatedHeight - 16);
    }
    if (computedTop < 16) {
      computedTop = 16;
    }

    setHoveredPos({
      top: computedTop,
      left: rect.right + 10,
    });
    setHoveredTurn(turn);
  };

  const handlePointerLeave = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setHoveredTurn(null);
      setHoveredPos(null);
    }, 140);
  };

  const scrollToTurn = useCallback((anchorKey: string) => {
    clearHideTimer();
    setHoveredTurn(null);
    setHoveredPos(null);
    const target = document.querySelector(`[data-chat-anchor-key="${anchorKey}"]`);
    if (target) {
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  // When activeTurn changes from scrolling the chat, auto-scroll the indicator track to keep the active dash in view
  useEffect(() => {
    if (activeTurn !== null) {
      const el = itemRefs.current.get(activeTurn);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeTurn]);

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

  // Dismiss on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearHideTimer();
        setHoveredTurn(null);
        setHoveredPos(null);
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

  const hoveredEntry = entries.find((e) => e.turn === hoveredTurn);

  return (
    <>
      <nav
        className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 z-30 select-none pointer-events-auto flex flex-col"
        aria-label="Conversation Turns"
      >
        {/* Scrollable Indicator Track: tightly spaced dashes without visible scrollbar UI */}
        <div
          ref={containerRef}
          className="flex flex-col items-start gap-1 py-1 px-0.5 max-h-[175px] overflow-y-auto scroll-smooth overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {entries.map((entry) => {
            const isActive = activeTurn === entry.turn;

            return (
              <div
                key={entry.anchorKey}
                ref={(node) => {
                  if (node) itemRefs.current.set(entry.turn, node);
                  else itemRefs.current.delete(entry.turn);
                }}
                className="relative flex items-center group/item py-0"
                onPointerEnter={(e) => handlePointerEnter(entry.turn, e.currentTarget)}
                onPointerLeave={handlePointerLeave}
              >
                <button
                  type="button"
                  className="flex items-center justify-start py-0.5 px-0.5 bg-transparent border-0 cursor-pointer outline-none group/btn"
                  data-active={isActive || undefined}
                  aria-label={`Jump to turn: ${entry.userText}`}
                  onClick={() => scrollToTurn(entry.anchorKey)}
                >
                  {/* Dynamic dash width:
                      - Inactive: small w-[14px], expands to w-[24px] on hover
                      - Active: wider w-[24px], expands to w-[32px] on hover
                  */}
                  <div
                    className={`h-[2px] rounded-full transition-all duration-200 ease-out ${
                      isActive
                        ? "w-[24px] group-hover/btn:w-[32px] bg-white/95 opacity-100 shadow-[0_0_6px_rgba(255,255,255,0.35)]"
                        : "w-[14px] bg-white/30 opacity-60 group-hover/btn:w-[24px] group-hover/btn:bg-white/90 group-hover/btn:opacity-100"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Floating Hover Preview Card (Matching media_1788670222591.png) */}
      {hoveredEntry && hoveredPos && (
        <div
          className="fixed z-[70] w-[280px] sm:w-[300px] max-w-[calc(100vw-60px)] px-4 py-3 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] cursor-pointer pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: hoveredPos.top,
            left: hoveredPos.left,
          }}
          role="tooltip"
          onClick={() => scrollToTurn(hoveredEntry.anchorKey)}
          onPointerEnter={clearHideTimer}
          onPointerLeave={handlePointerLeave}
        >
          <div className="text-[13px] font-semibold text-[#f0f0f0] leading-snug mb-1.5 truncate">
            {hoveredEntry.userText}
          </div>
          {hoveredEntry.assistantText ? (
            <div className="text-[12px] font-normal leading-relaxed text-[#a0a0a0] line-clamp-3 break-words">
              {hoveredEntry.assistantText}
            </div>
          ) : hoveredEntry.isRunning ? (
            <div className="text-[11px] italic text-[#777777]">
              Sedang memproses respons...
            </div>
          ) : (
            <div className="text-[11px] italic text-[#777777]">
              Eksekusi selesai
            </div>
          )}
        </div>
      )}
    </>
  );
});

export const TurnTimelineNav = ChatIndicator;
