import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@const/ui";

export interface InteractiveBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultHeightVh?: number; // percentage of viewport height, default 85
  minHeightPx?: number;
  className?: string;
  ariaLabel?: string;
}

export function InteractiveBottomSheet({
  open,
  onClose,
  children,
  defaultHeightVh = 85,
  minHeightPx = 240,
  className,
  ariaLabel = "Sheet",
}: InteractiveBottomSheetProps) {
  const [windowHeight, setWindowHeight] = useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const defaultHeightPx = Math.round((windowHeight * defaultHeightVh) / 100);

  const [height, setHeight] = useState<number>(defaultHeightPx);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const pointerTrackerRef = useRef<{
    startY: number;
    startHeight: number;
    startTime: number;
    lastY: number;
    lastTime: number;
    recentMoves: { y: number; time: number }[];
  }>({
    startY: 0,
    startHeight: defaultHeightPx,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
    recentMoves: [],
  });

  // Update window height on resize
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight;
      setWindowHeight(vh);
      setHeight((prev) => {
        // If it was close to full screen, keep it full screen
        if (prev >= vh * 0.95) return vh;
        // If it was at default, adjust to new default
        const newDefault = Math.round((vh * defaultHeightVh) / 100);
        return Math.min(newDefault, vh);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [defaultHeightVh]);

  // Reset height whenever sheet is opened
  useEffect(() => {
    if (open) {
      const vh = window.innerHeight;
      setWindowHeight(vh);
      setHeight(Math.round((vh * defaultHeightVh) / 100));
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
    }, 200);
  }, [onClose]);

  // Pointer drag events for the top handle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = Date.now();
    pointerTrackerRef.current = {
      startY: e.clientY,
      startHeight: height,
      startTime: now,
      lastY: e.clientY,
      lastTime: now,
      recentMoves: [{ y: e.clientY, time: now }],
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const now = Date.now();
    const tracker = pointerTrackerRef.current;

    // Keep history of movements within the last 150ms for accurate release velocity
    const recentMoves = tracker.recentMoves.filter((m) => now - m.time < 150);
    recentMoves.push({ y: e.clientY, time: now });
    tracker.recentMoves = recentMoves;
    tracker.lastY = e.clientY;
    tracker.lastTime = now;

    const deltaY = e.clientY - tracker.startY;
    // Dragging down (deltaY > 0) reduces height; dragging up (deltaY < 0) increases height
    const rawHeight = tracker.startHeight - deltaY;
    const clampedHeight = Math.max(minHeightPx, Math.min(windowHeight, rawHeight));
    setHeight(clampedHeight);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture release fails
    }
    setIsDragging(false);

    const now = Date.now();
    const tracker = pointerTrackerRef.current;
    const deltaY = e.clientY - tracker.startY;
    const duration = now - tracker.startTime;

    // Calculate release velocity from recent pointer movements
    let releaseVelocity = 0; // positive = moving downwards fast (px/ms)
    if (tracker.recentMoves.length >= 2) {
      const firstMove = tracker.recentMoves[0];
      const lastMove = tracker.recentMoves[tracker.recentMoves.length - 1];
      if (firstMove && lastMove) {
        const dt = lastMove.time - firstMove.time;
        if (dt > 12) {
          releaseVelocity = (lastMove.y - firstMove.y) / dt;
        }
      }
    }

    // 1. Quick tap / click detection: toggles between default and full size
    const isTap = Math.abs(deltaY) < 5 && duration < 250;
    if (isTap) {
      if (height >= windowHeight * 0.94) {
        setHeight(defaultHeightPx);
      } else {
        setHeight(windowHeight);
      }
      return;
    }

    // 2. Case: "perlu nutup cepet" (fast downward flick or dragged down to bottom)
    const isFastFlickDown = releaseVelocity > 0.42 && deltaY > 25;
    const isDraggedToBottom =
      height <= Math.min(220, windowHeight * 0.28) || deltaY > windowHeight * 0.5;

    if (isFastFlickDown || isDraggedToBottom) {
      handleDismiss();
      return;
    }

    // 3. Case: dragged all the way to the top / fast upward flick near top
    const isFastFlickUp = releaseVelocity < -0.45 && height > windowHeight * 0.72;
    const isNearTop = height >= windowHeight * 0.95 || e.clientY <= 45;

    if (isFastFlickUp || isNearTop) {
      setHeight(windowHeight);
      return;
    }

    // 4. Case: "menyesuaikan size nya" (manual free resizing)
    // The height stays exactly where the user released it!
  };

  const isFullScreen = height >= windowHeight - 4;

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
          isFullScreen ? "rounded-t-none" : "rounded-t-[24px]",
          open && !isClosing
            ? "translate-y-0"
            : "translate-y-full pointer-events-none",
          className
        )}
        style={{
          height: `${height}px`,
          maxHeight: "100vh",
          transition: isDragging
            ? "none"
            : "height 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.2s ease",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {/* Interactive Drag Handle Area */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full pt-3 pb-2.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none group shrink-0"
          title="Tarik untuk menyesuaikan ukuran, geser cepat ke bawah untuk menutup, atau tarik ke atas untuk layar penuh"
        >
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-150",
              isDragging
                ? "bg-foreground/70 w-16 scale-y-110"
                : "bg-muted-foreground/35 group-hover:bg-muted-foreground/60 w-12"
            )}
          />
        </div>

        {/* Sheet Content Area */}
        {children}
      </div>
    </>
  );
}
