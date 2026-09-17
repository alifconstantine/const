import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface MenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  showChevron?: boolean;
}

export function Menu({ trigger, children, align = "left", showChevron = true }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer inline-flex items-center"
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
        {showChevron && (
          <ChevronDown className="ml-2 -mr-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-56 rounded-xl bg-card border border-border text-foreground shadow-xl ring-1 ring-black/5 focus:outline-none z-50`}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="menu-button"
        >
          <div className="py-1" role="none">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export interface MenuItemProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  isActive?: boolean;
  label?: string;
  className?: string;
}

export function MenuItem({
  children,
  onClick,
  disabled = false,
  icon,
  isActive = false,
  label,
  className = "",
}: MenuItemProps) {
  return (
    <button
      type="button"
      className={`relative flex items-center justify-center w-full h-full text-center group cursor-pointer transition-all duration-200 select-none
        ${disabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground active:scale-95"}
        ${isActive ? "bg-accent/40 text-foreground" : ""}
        ${className}
      `}
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <span className="flex items-center justify-center h-full">
        {icon && (
          <span className="h-5 w-5 flex items-center justify-center transition-all duration-200 group-hover:[&_svg]:stroke-[2.2]">
            {icon}
          </span>
        )}
        {children}
      </span>
    </button>
  );
}

export interface MenuContainerProps {
  children: React.ReactNode;
  direction?: "up" | "down";
  spacing?: number;
  size?: number; // width & height in px, e.g. 48 or 52
  className?: string;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function MenuContainer({
  children,
  direction = "up",
  spacing = 54,
  size = 48,
  className = "",
  isExpanded: controlledExpanded,
  onExpandedChange,
}: MenuContainerProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const containerRef = useRef<HTMLDivElement>(null);

  const childrenArray = React.Children.toArray(children);

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onExpandedChange?.(next);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (controlledExpanded === undefined) {
          setInternalExpanded(false);
        }
        onExpandedChange?.(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isExpanded, controlledExpanded, onExpandedChange]);

  const sizeStyle = { width: `${size}px`, height: `${size}px` };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ width: `${size}px` }}
      data-expanded={isExpanded}
    >
      {/* Container for all items */}
      <div className="relative">
        {/* First item - trigger, always visible */}
        <div
          className="relative bg-card text-foreground border border-border/80 hover:border-border cursor-pointer rounded-full group will-change-transform z-50 shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95"
          style={sizeStyle}
          onClick={handleToggle}
          role="button"
          aria-expanded={isExpanded}
          aria-label="Toggle fluid menu"
        >
          {childrenArray[0]}
        </div>

        {/* Floating backdrop blur when expanded */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] -z-10 animate-fade-in pointer-events-auto"
            onClick={() => {
              if (controlledExpanded === undefined) setInternalExpanded(false);
              onExpandedChange?.(false);
            }}
          />
        )}

        {/* Other items - smoothly fly in/out in specified direction */}
        {childrenArray.slice(1).map((child, index) => {
          const offset = (index + 1) * spacing;
          const translateY = direction === "up" ? -offset : offset;

          return (
            <div
              key={index}
              className="absolute top-0 left-0 bg-card text-foreground border border-border/80 rounded-full will-change-transform shadow-lg overflow-hidden flex items-center justify-center"
              style={{
                ...sizeStyle,
                transform: `translateY(${isExpanded ? translateY : 0}px) scale(${isExpanded ? 1 : 0.7})`,
                opacity: isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? "auto" : "none",
                zIndex: 40 - index,
                transition: `transform 300ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 250ms ease-out`,
                backfaceVisibility: "hidden",
                perspective: 1000,
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
