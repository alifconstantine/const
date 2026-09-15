import React, { useState, useEffect, useRef } from "react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";

interface WorkspaceTitleProps {
  title: string;
  onSave: (newTitle: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}

export function WorkspaceTitle({
  title: initialTitle,
  onSave,
  placeholder,
  className,
}: WorkspaceTitleProps) {
  const { t } = useI18n();
  const defaultPlaceholder = placeholder || t("untitledNotebook");
  const [value, setValue] = useState(initialTitle || defaultPlaceholder);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  // Synchronize when external initialTitle changes (if not actively editing)
  useEffect(() => {
    if (!isFocused) {
      setValue(initialTitle || defaultPlaceholder);
    }
  }, [initialTitle, defaultPlaceholder, isFocused]);

  const commitTitle = async () => {
    if (isSavingRef.current) return;
    setIsFocused(false);
    const trimmed = value.trim() || defaultPlaceholder;
    setValue(trimmed);
    if (trimmed !== initialTitle) {
      isSavingRef.current = true;
      try {
        await onSave(trimmed);
      } finally {
        isSavingRef.current = false;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setValue(initialTitle || defaultPlaceholder);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  // Text used to calculate intrinsic auto-fit width
  const displaySizerText = value || defaultPlaceholder;

  return (
    <div
      className={cn(
        "relative inline-grid items-center min-w-[72px] max-w-[240px] sm:max-w-[340px] md:max-w-[460px] lg:max-w-[580px]",
        className
      )}
      title={
        !isFocused
          ? value && value !== defaultPlaceholder
            ? `${value} (${t("clickToRename")})`
            : t("clickToRename")
          : undefined
      }
    >
      {/* Invisible sizer span calculating the precise text width */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-pre px-2.5 py-1 text-sm font-semibold tracking-tight font-sans select-none pointer-events-none border border-transparent min-w-[72px] max-w-full overflow-hidden"
      >
        {displaySizerText}
      </span>

      {/* Directly editable input with auto-width and smooth studio styling */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={commitTitle}
        onKeyDown={handleKeyDown}
        placeholder={defaultPlaceholder}
        spellCheck={false}
        autoComplete="off"
        aria-label={t("clickToRename")}
        className={cn(
          "col-start-1 row-start-1 w-full text-sm font-semibold text-foreground tracking-tight font-sans",
          "px-2.5 py-1 rounded-lg transition-colors outline-none",
          "bg-transparent border",
          isFocused
            ? "bg-muted/50 border-border/80 ring-1 ring-ring/25 shadow-xs cursor-text"
            : "border-transparent hover:border-border/50 hover:bg-muted/40 cursor-pointer truncate"
        )}
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
    </div>
  );
}
