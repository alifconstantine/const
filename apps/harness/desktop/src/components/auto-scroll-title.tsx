import React, { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@const/ui/lib/utils";
import { useTranslation } from "../lib/i18n";

export interface AutoScrollTitleProps {
  text?: string;
  className?: string;
  textClassName?: string;
  isParentHovered?: boolean;
  delayMs?: number;
  speed?: number; // pixels per second
  holdMs?: number;
}

/**
 * AutoScrollTitle:
 * Displays a single-line title with a smooth right-edge fade mask when overflowing (matching target design).
 * On hover, after a 1.5s delay, it smoothly translates left to reveal the full text,
 * holds at the end so the user can read it, and resets smoothly.
 */
export function AutoScrollTitle({
  text,
  className,
  textClassName,
  isParentHovered,
  delayMs = 1500,
  speed = 35,
  holdMs = 2500,
}: AutoScrollTitleProps) {
  const { t } = useTranslation();
  const defaultText = t("common.untitled");
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  // Clean any hardcoded trailing ellipsis from title so the full text is displayed
  const displayTitle =
    (text || defaultText).replace(/…|\.{2,}$/, "").trim() || defaultText;

  const [overflow, setOverflow] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isSelfHovered, setIsSelfHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [cycle, setCycle] = useState(0);

  const isHovered = isParentHovered !== undefined ? isParentHovered : isSelfHovered;

  // Measure overflow
  const measure = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      const diff = Math.max(0, textWidth - containerWidth);
      setOverflow(diff);
      return diff;
    }
    return 0;
  }, []);

  // Update measurement on text or layout change
  useEffect(() => {
    measure();
  }, [displayTitle, measure]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Handle hover and auto-scroll animation
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    if (isHovered && overflow > 2) {
      const waitTime = cycle === 0 ? delayMs : 1500;
      startTimer = setTimeout(() => {
        setIsResetting(false);
        setIsAnimating(true);
        setOffset(overflow);

        const durationMs = Math.max(1500, (overflow / speed) * 1000);
        holdTimer = setTimeout(() => {
          // Hold at the end, then smoothly return
          setIsAnimating(false);
          setIsResetting(true);
          setOffset(0);

          loopTimer = setTimeout(() => {
            setIsResetting(false);
            setCycle((c) => c + 1);
          }, 600);
        }, durationMs + holdMs);
      }, waitTime);
    } else {
      // Unhovered: cancel everything and smoothly reset
      setCycle(0);
      setIsAnimating(false);
      setIsResetting(true);
      setOffset(0);
      resetTimer = setTimeout(() => {
        setIsResetting(false);
      }, 400);
    }

    return () => {
      if (startTimer) clearTimeout(startTimer);
      if (holdTimer) clearTimeout(holdTimer);
      if (loopTimer) clearTimeout(loopTimer);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [isHovered, overflow, cycle, delayMs, speed, holdMs]);

  // Calculate mask gradient based on current scroll state
  const getMaskStyle = () => {
    if (overflow <= 2) return undefined;
    if (isAnimating) {
      // While scrolling: fade both edges so text enters and exits smoothly
      return "linear-gradient(to right, transparent 0%, black 16px, black calc(100% - 20px), transparent 100%)";
    }
    // At rest: fade right edge only
    return "linear-gradient(to right, black calc(100% - 20px), transparent 100%)";
  };

  const mask = getMaskStyle();
  const animDurationSec = Math.max(1.5, overflow / speed);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsSelfHovered(true)}
      onMouseLeave={() => setIsSelfHovered(false)}
      className={cn("overflow-hidden relative min-w-0 select-none", className)}
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
      title={displayTitle}
    >
      <span
        ref={textRef}
        className={cn(
          "inline-block whitespace-nowrap will-change-transform font-normal",
          textClassName
        )}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: isAnimating
            ? `transform ${animDurationSec}s cubic-bezier(0.35, 0, 0.25, 1)`
            : isResetting
            ? "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)"
            : "none",
        }}
      >
        {displayTitle}
      </span>
    </div>
  );
}
