import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@const/ui";

export type SheetSnapState = "default" | "max";

export interface InteractiveBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultHeightVh?: number; // percentage of viewport height, default 75
  className?: string;
  ariaLabel?: string;
}

export function InteractiveBottomSheet({
  open,
  onClose,
  children,
  defaultHeightVh = 75,
  className,
  ariaLabel = "Sheet",
}: InteractiveBottomSheetProps) {
  const [windowHeight, setWindowHeight] = useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const defaultHeightPx = Math.round((windowHeight * defaultHeightVh) / 100);

  const [snapState, setSnapState] = useState<SheetSnapState>("default");
  const [height, setHeight] = useState<number>(defaultHeightPx);
  const [translateY, setTranslateY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const pointerTrackerRef = useRef<{
    startY: number;
    startHeight: number;
    startSnapState: SheetSnapState;
    startTime: number;
    recentMoves: { y: number; time: number }[];
  }>({
    startY: 0,
    startHeight: defaultHeightPx,
    startSnapState: "default",
    startTime: 0,
    recentMoves: [],
  });

  // Update window height on resize
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight;
      setWindowHeight(vh);
      const newDefault = Math.round((vh * defaultHeightVh) / 100);
      if (snapState === "max") {
        setHeight(vh);
      } else {
        setHeight(newDefault);
      }
      setTranslateY(0);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [defaultHeightVh, snapState]);

  // Reset to default snap whenever sheet is opened
  useEffect(() => {
    if (open) {
      const vh = window.innerHeight;
      setWindowHeight(vh);
      const def = Math.round((vh * defaultHeightVh) / 100);
      setSnapState("default");
      setHeight(def);
      setTranslateY(0);
      setIsClosing(false);
    }
  }, [open, defaultHeightVh]);

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 280);
  }, [onClose]);

  // Pointer drag events for the top handle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = Date.now();
    pointerTrackerRef.current = {
      startY: e.clientY,
      startHeight: height,
      startSnapState: snapState,
      startTime: now,
      recentMoves: [{ y: e.clientY, time: now }],
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const now = Date.now();
    const tracker = pointerTrackerRef.current;

    const recentMoves = tracker.recentMoves.filter((m) => now - m.time < 120);
    recentMoves.push({ y: e.clientY, time: now });
    tracker.recentMoves = recentMoves;

    const deltaY = e.clientY - tracker.startY;

    if (tracker.startSnapState === "max") {
      if (deltaY <= 0) {
        // Pulling up past screen top: slight rubber-band resistance
        setTranslateY(deltaY * 0.15);
        setHeight(windowHeight);
      } else {
        // Dragging downwards from MAX: slide down with finger
        setTranslateY(deltaY);
      }
    } else {
      // startSnapState === "default"
      if (deltaY < 0) {
        // Dragging UP towards MAX: increase height
        const targetHeight = defaultHeightPx - deltaY;
        if (targetHeight > windowHeight) {
          const over = targetHeight - windowHeight;
          setHeight(windowHeight + over * 0.15);
        } else {
          setHeight(targetHeight);
        }
        setTranslateY(0);
      } else {
        // Dragging DOWN towards HILANG: slide sheet downwards
        setHeight(defaultHeightPx);
        setTranslateY(deltaY);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture release error if already uncaptured
    }
    setIsDragging(false);

    const now = Date.now();
    const tracker = pointerTrackerRef.current;
    const deltaY = e.clientY - tracker.startY;
    const duration = now - tracker.startTime;

    // Calculate release velocity in px/ms (positive = moving downwards, negative = moving upwards)
    let velocity = 0;
    if (tracker.recentMoves.length >= 2) {
      const firstMove = tracker.recentMoves[0];
      const lastMove = tracker.recentMoves[tracker.recentMoves.length - 1];
      if (firstMove && lastMove) {
        const dt = lastMove.time - firstMove.time;
        if (dt > 10) {
          velocity = (lastMove.y - firstMove.y) / dt;
        }
      }
    }

    // 1. Quick tap / click detection: toggles between default and max (like TikTok/IG handle click)
    const isTap = Math.abs(deltaY) < 8 && duration < 250;
    if (isTap) {
      if (snapState === "max") {
        setSnapState("default");
        setHeight(defaultHeightPx);
        setTranslateY(0);
      } else {
        setSnapState("max");
        setHeight(windowHeight);
        setTranslateY(0);
      }
      return;
    }

    // 2. DISCRETE 3-POINT SNAPPING: Only DEFAULT, MAX, or HILANG (Closed)
    if (tracker.startSnapState === "max") {
      // Started from MAX:
      // Strong / fast flick downwards or dragged down significantly -> HILANG (Dismiss)
      if (velocity > 0.85 || deltaY > windowHeight * 0.45) {
        handleDismiss();
        return;
      }

      // Dragged down past threshold or downward flick -> DEFAULT
      if (velocity > 0.25 || deltaY > 60) {
        setSnapState("default");
        setHeight(defaultHeightPx);
        setTranslateY(0);
        return;
      }

      // Otherwise bounce back to MAX
      setSnapState("max");
      setHeight(windowHeight);
      setTranslateY(0);
      return;
    } else {
      // Started from DEFAULT:
      // Dragging UP towards MAX
      if (deltaY < 0) {
        const distanceToMax = windowHeight - defaultHeightPx;
        const progressToMax = Math.abs(deltaY) / Math.max(1, distanceToMax);

        // Fast flick up or pulled more than 35% towards max
        if (velocity < -0.3 || deltaY < -60 || progressToMax > 0.35) {
          setSnapState("max");
          setHeight(windowHeight);
          setTranslateY(0);
        } else {
          setSnapState("default");
          setHeight(defaultHeightPx);
          setTranslateY(0);
        }
        return;
      }

      // Dragging DOWN towards HILANG (Dismiss)
      if (deltaY > 0) {
        // Fast flick down or pulled down more than 70px
        if (velocity > 0.32 || deltaY > 70) {
          handleDismiss();
        } else {
          setSnapState("default");
          setHeight(defaultHeightPx);
          setTranslateY(0);
        }
        return;
      }

      // Fallback: stay at default
      setSnapState("default");
      setHeight(defaultHeightPx);
      setTranslateY(0);
    }
  };

  const isFullScreen = snapState === "max" && translateY === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
          open && !isClosing
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
        )}
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 w-full sm:max-w-2xl sm:mx-auto bg-card text-card-foreground border-t border-border flex flex-col will-change-transform font-sans overflow-hidden select-none safe-area-bottom shadow-2xl",
          isFullScreen && !isDragging ? "rounded-t-none" : "rounded-t-[24px]",
          open && !isClosing
            ? ""
            : "translate-y-full pointer-events-none",
          className
        )}
        style={{
          height: `${height}px`,
          maxHeight: "100vh",
          transform:
            open && !isClosing
              ? `translate3d(0, ${translateY}px, 0)`
              : undefined,
          transition: isDragging
            ? "none"
            : "height 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), border-radius 0.2s ease",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {/* Interactive Drag Handle Area (TikTok & Instagram Comment Sheet style) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full py-3 px-4 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none group shrink-0"
          title={
            snapState === "max"
              ? "Tarik ke bawah untuk ukuran standar (default) atau tutup (hilang)"
              : "Tarik ke atas untuk layar penuh (max) atau geser ke bawah untuk menutup (hilang)"
          }
        >
          <div
            className={cn(
              "h-1 rounded-full transition-all duration-200",
              isDragging
                ? "bg-foreground/60 w-14"
                : "bg-muted-foreground/35 group-hover:bg-muted-foreground/50 w-10"
            )}
          />
        </div>

        {/* Sheet Content Area */}
        {children}
      </div>
    </>
  );
}
