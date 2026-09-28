"use client";

import React, { useEffect, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@const/ui/lib/utils";

export interface VoiceInputProps {
  listening?: boolean;
  loading?: boolean;
  onToggle?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

export function VoiceInput({
  listening = false,
  loading = false,
  onToggle,
  onStart,
  onStop,
  className,
  disabled = false,
  title,
  ...props
}: VoiceInputProps & Omit<React.ComponentProps<"div">, "onToggle">) {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (listening) {
      onStart?.();
      setSeconds(0);
      intervalId = setInterval(() => {
        setSeconds((t) => t + 1);
      }, 1000);
    } else {
      onStop?.();
      setSeconds(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [listening]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;
    onToggle?.();
  };

  const computedTitle =
    title ||
    (loading
      ? "Memproses transkripsi suara..."
      : listening
      ? "Hentikan rekaman suara"
      : "Input suara (klik untuk bicara)");

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={computedTitle}
      aria-label={computedTitle}
      className={cn(
        "flex items-center justify-center rounded-full select-none font-sans shrink-0 transition-colors duration-200",
        loading
          ? "h-8 px-2.5 bg-muted/70 border border-border/80 text-muted-foreground cursor-wait"
          : listening
          ? "h-8 px-2.5 bg-red-500/10 border border-red-500/40 text-red-500 hover:bg-red-500/20 active:scale-95 shadow-xs cursor-pointer"
          : "h-8 w-8 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer",
        (disabled || loading) && "pointer-events-none select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {/* Icon: Spinner when loading, Rotating square when listening, or Mic when idle */}
      <div className="h-4 w-4 flex items-center justify-center shrink-0">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : listening ? (
          <motion.div
            className="w-3.5 h-3.5 bg-red-500 rounded-xs"
            animate={{ rotate: [0, 180, 360] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : (
          <Mic className="h-4 w-4 stroke-[2]" />
        )}
      </div>

      {/* Loading Label */}
      {loading && (
        <span className="text-[11px] text-muted-foreground font-sans pl-1.5 font-medium animate-pulse select-none">
          Memproses...
        </span>
      )}

      {/* Expanded Pill content: 12 Equalizer bars & Timer */}
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden flex gap-2 items-center justify-center pl-2"
          >
            {/* Equalizer Frequency Bars */}
            <div className="flex gap-0.5 items-center justify-center h-3.5">
              {[5, 12, 7, 14, 9, 15, 6, 13, 8, 11, 7, 10].map((peak, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full"
                  initial={{ height: 2 }}
                  animate={{
                    height: [2, peak, 2],
                  }}
                  transition={{
                    duration: 0.7 + (i % 3) * 0.15,
                    repeat: Infinity,
                    delay: i * 0.04,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <span className="text-[11px] text-red-500 font-mono font-semibold tabular-nums">
              {formatTime(seconds)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
