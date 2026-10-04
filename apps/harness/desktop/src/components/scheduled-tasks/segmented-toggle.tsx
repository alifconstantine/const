import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import { cn } from "@const/ui";

export interface ToggleOption<T extends string = string> {
  id: T;
  label: string;
}

export interface SegmentedToggleProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<ToggleOption<T>>;
  className?: string;
}

export function SegmentedToggle<T extends string = string>({
  value,
  onChange,
  options,
  className,
}: SegmentedToggleProps<T>): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 2,
    width: 0,
  });
  const [isReady, setIsReady] = useState(false);

  const updateIndicator = () => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current.get(value);
    if (!container || !activeButton) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeButton.getBoundingClientRect();

    setIndicatorStyle({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
    });
    setIsReady(true);
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [value]);

  useEffect(() => {
    const handleResize = () => updateIndicator();
    window.addEventListener("resize", handleResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(() => updateIndicator());
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      ro?.disconnect();
    };
  }, [value]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative inline-flex items-center h-8 bg-[#222222] border border-[#383838] rounded-full p-0.5 gap-0.5 select-none",
        className
      )}
    >
      {/* Smooth sliding pill indicator */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-full bg-[#2b2b2b] border border-[#383838]/80 shadow-[0_1px_2px_rgba(0,0,0,0.25)] pointer-events-none transition-all duration-200",
          isReady ? "opacity-100" : "opacity-0"
        )}
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              if (el) {
                buttonRefs.current.set(opt.id, el);
              } else {
                buttonRefs.current.delete(opt.id);
              }
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative z-10 h-full px-3.5 flex items-center justify-center rounded-full text-[13px] font-medium transition-colors duration-150 cursor-pointer select-none",
              isActive ? "text-white" : "text-[#969696] hover:text-[#d4d4d4]"
            )}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
