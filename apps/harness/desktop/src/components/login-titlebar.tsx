import React, { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { useTranslation } from "../lib/i18n";

export function LoginTitleBar() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electron?.isMaximized?.().then((max) => setIsMaximized(Boolean(max)));
    const cleanup = window.electron?.onMaximizedChange?.((max) => {
      setIsMaximized(max);
    });
    return () => cleanup?.();
  }, []);

  const handleMinimize = () => {
    window.electron?.minimize?.();
  };

  const handleMaximize = () => {
    window.electron?.maximize?.();
  };

  const handleClose = () => {
    window.electron?.close?.();
  };

  return (
    <header
      className="h-9 w-full shrink-0 flex items-center justify-between px-3 select-none bg-background text-foreground z-50 relative"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Draggable center area */}
      <div className="flex-1 h-full" />

      {/* Right: Window Controls */}
      <div
        className="flex items-center gap-0.5 text-muted-foreground shrink-0 ml-auto"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={t("topToolbar.minimizeWindow")}
          aria-label={t("topToolbar.minimizeWindow")}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={isMaximized ? t("topToolbar.restoreWindow") : t("topToolbar.maximizeWindow")}
          aria-label={isMaximized ? t("topToolbar.restoreWindow") : t("topToolbar.maximizeWindow")}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] text-muted-foreground hover:text-white transition-colors cursor-pointer"
          title={t("topToolbar.closeWindow")}
          aria-label={t("topToolbar.closeWindow")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
