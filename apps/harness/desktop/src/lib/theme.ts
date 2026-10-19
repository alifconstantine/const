import { useState, useEffect } from "react";

export type Theme = "system" | "light" | "dark";
export type ConversationWidth = "default" | "narrow" | "wide";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}

export function applyTheme(theme: Theme = "system") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && getSystemTheme() === "dark");

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function setSavedTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("theme", theme);

  // Sync to Electron nativeTheme if running in Electron environment
  const electron = (window as any).electron;
  if (electron?.setThemeMode) {
    electron.setThemeMode(theme);
  }

  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("const-theme-change", { detail: theme }));

  // When switching to system, re-apply after brief delay in case Electron/Chromium
  // needs a tick to update prefers-color-scheme media query
  if (theme === "system") {
    setTimeout(() => {
      applyTheme("system");
    }, 50);
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getSavedTheme);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail);
      } else {
        setThemeState(getSavedTheme());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        setThemeState((e.newValue as Theme) || "system");
      }
    };

    window.addEventListener("const-theme-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-theme-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setSavedTheme(newTheme);
  };

  return [theme, setTheme];
}

export function getSavedConversationWidth(): ConversationWidth {
  if (typeof window === "undefined") return "default";
  return (localStorage.getItem("const_conversation_width") as ConversationWidth) || "default";
}

export function setSavedConversationWidth(width: ConversationWidth) {
  if (typeof window === "undefined") return;
  localStorage.setItem("const_conversation_width", width);
  window.dispatchEvent(new CustomEvent("const-width-change", { detail: width }));
}

export function useConversationWidth(): [ConversationWidth, (width: ConversationWidth) => void] {
  const [width, setWidthState] = useState<ConversationWidth>(getSavedConversationWidth);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<ConversationWidth>;
      if (customEvent.detail) {
        setWidthState(customEvent.detail);
      } else {
        setWidthState(getSavedConversationWidth());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_conversation_width") {
        setWidthState((e.newValue as ConversationWidth) || "default");
      }
    };

    window.addEventListener("const-width-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-width-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setWidth = (newWidth: ConversationWidth) => {
    setWidthState(newWidth);
    setSavedConversationWidth(newWidth);
  };

  return [width, setWidth];
}

export const MIN_ZOOM = 75;
export const MAX_ZOOM = 140;
export const DEFAULT_ZOOM = 100;
export const ZOOM_STEP = 5;

export const ZOOM_OPTIONS = [
  { label: "80%", value: 80 },
  { label: "90%", value: 90 },
  { label: "100% (Default)", value: 100 },
  { label: "110%", value: 110 },
  { label: "125%", value: 125 },
];

export function getSavedZoom(): number {
  if (typeof window === "undefined") return DEFAULT_ZOOM;
  const saved = localStorage.getItem("const_interface_zoom");
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
      return parsed;
    }
  }
  return DEFAULT_ZOOM;
}

export function applyZoom(zoom: number = DEFAULT_ZOOM) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const factor = zoom / 100;

  // Always reset CSS zoom on documentElement/body to prevent coordinate distortion or offset bugs
  if (document.documentElement) {
    (document.documentElement.style as any).zoom = "";
  }
  if (document.body) {
    (document.body.style as any).zoom = "";
  }

  // Use Electron's native Chromium engine zoom factor
  if (window.electron?.setZoomFactor) {
    window.electron.setZoomFactor(factor);
  } else {
    // Web fallback if running without Electron
    (document.documentElement.style as any).zoom = `${zoom}%`;
  }
}

export function setSavedZoom(zoom: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
  localStorage.setItem("const_interface_zoom", String(clamped));
  applyZoom(clamped);
  window.dispatchEvent(new CustomEvent("const-zoom-change", { detail: clamped }));
}

export function zoomIn() {
  const current = getSavedZoom();
  setSavedZoom(Math.min(MAX_ZOOM, current + ZOOM_STEP));
}

export function zoomOut() {
  const current = getSavedZoom();
  setSavedZoom(Math.max(MIN_ZOOM, current - ZOOM_STEP));
}

export function resetZoom() {
  setSavedZoom(DEFAULT_ZOOM);
}

export function useInterfaceZoom(): [number, (zoom: number) => void] {
  const [zoom, setZoomState] = useState<number>(getSavedZoom);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setZoomState(customEvent.detail);
      } else {
        setZoomState(getSavedZoom());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_interface_zoom") {
        setZoomState(getSavedZoom());
      }
    };

    window.addEventListener("const-zoom-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-zoom-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setZoom = (newZoom: number) => {
    setZoomState(newZoom);
    setSavedZoom(newZoom);
  };

  return [zoom, setZoom];
}

// ============================================================================
// UI Font Size (Default 14px)
// ============================================================================
export const DEFAULT_UI_FONT_SIZE = 14;
export const MIN_UI_FONT_SIZE = 11;
export const MAX_UI_FONT_SIZE = 20;

export function getSavedUiFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_UI_FONT_SIZE;
  const saved = localStorage.getItem("const_ui_font_size");
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_UI_FONT_SIZE && parsed <= MAX_UI_FONT_SIZE) {
      return parsed;
    }
  }
  return DEFAULT_UI_FONT_SIZE;
}

export function applyUiFontSize(size: number = DEFAULT_UI_FONT_SIZE) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--ui-font-size", `${size}px`);
  if (document.body) {
    document.body.style.fontSize = `${size}px`;
  }
}

export function setSavedUiFontSize(size: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(MIN_UI_FONT_SIZE, Math.min(MAX_UI_FONT_SIZE, Math.round(size)));
  localStorage.setItem("const_ui_font_size", String(clamped));
  applyUiFontSize(clamped);
  window.dispatchEvent(new CustomEvent("const-ui-font-size-change", { detail: clamped }));
}

export function useUiFontSize(): [number, (size: number) => void] {
  const [fontSize, setFontSizeState] = useState<number>(getSavedUiFontSize);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setFontSizeState(customEvent.detail);
      } else {
        setFontSizeState(getSavedUiFontSize());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_ui_font_size") {
        setFontSizeState(getSavedUiFontSize());
      }
    };

    window.addEventListener("const-ui-font-size-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-ui-font-size-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setFontSize = (newSize: number) => {
    setFontSizeState(newSize);
    setSavedUiFontSize(newSize);
  };

  return [fontSize, setFontSize];
}

// ============================================================================
// Code Font Size (Default 12px)
// ============================================================================
export const DEFAULT_CODE_FONT_SIZE = 12;
export const MIN_CODE_FONT_SIZE = 10;
export const MAX_CODE_FONT_SIZE = 18;

export function getSavedCodeFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_CODE_FONT_SIZE;
  const saved = localStorage.getItem("const_code_font_size");
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_CODE_FONT_SIZE && parsed <= MAX_CODE_FONT_SIZE) {
      return parsed;
    }
  }
  return DEFAULT_CODE_FONT_SIZE;
}

export function applyCodeFontSize(size: number = DEFAULT_CODE_FONT_SIZE) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--code-font-size", `${size}px`);
}

export function setSavedCodeFontSize(size: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(MIN_CODE_FONT_SIZE, Math.min(MAX_CODE_FONT_SIZE, Math.round(size)));
  localStorage.setItem("const_code_font_size", String(clamped));
  applyCodeFontSize(clamped);
  window.dispatchEvent(new CustomEvent("const-code-font-size-change", { detail: clamped }));
}

export function useCodeFontSize(): [number, (size: number) => void] {
  const [fontSize, setFontSizeState] = useState<number>(getSavedCodeFontSize);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setFontSizeState(customEvent.detail);
      } else {
        setFontSizeState(getSavedCodeFontSize());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_code_font_size") {
        setFontSizeState(getSavedCodeFontSize());
      }
    };

    window.addEventListener("const-code-font-size-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-code-font-size-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setFontSize = (newSize: number) => {
    setFontSizeState(newSize);
    setSavedCodeFontSize(newSize);
  };

  return [fontSize, setFontSize];
}

// ============================================================================
// Diff Marks ("color" | "symbols")
// ============================================================================
export type DiffMarks = "color" | "symbols";

export function getSavedDiffMarks(): DiffMarks {
  if (typeof window === "undefined") return "color";
  return (localStorage.getItem("const_diff_marks") as DiffMarks) || "color";
}

export function setSavedDiffMarks(marks: DiffMarks) {
  if (typeof window === "undefined") return;
  localStorage.setItem("const_diff_marks", marks);
  window.dispatchEvent(new CustomEvent("const-diff-marks-change", { detail: marks }));
}

export function useDiffMarks(): [DiffMarks, (marks: DiffMarks) => void] {
  const [marks, setMarksState] = useState<DiffMarks>(getSavedDiffMarks);

  useEffect(() => {
    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent<DiffMarks>;
      setMarksState(ce.detail || getSavedDiffMarks());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_diff_marks") {
        setMarksState((e.newValue as DiffMarks) || "color");
      }
    };

    window.addEventListener("const-diff-marks-change", handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-diff-marks-change", handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setMarks = (m: DiffMarks) => {
    setMarksState(m);
    setSavedDiffMarks(m);
  };

  return [marks, setMarks];
}

export function initThemeListener() {
  if (typeof window === "undefined") return () => {};

  const currentTheme = getSavedTheme();

  // Sync initial theme to Electron
  const electron = (window as any).electron;
  if (electron?.setThemeMode) {
    electron.setThemeMode(currentTheme);
  }

  applyTheme(currentTheme);

  const currentZoom = getSavedZoom();
  applyZoom(currentZoom);

  applyUiFontSize(getSavedUiFontSize());
  applyCodeFontSize(getSavedCodeFontSize());

  // In Electron, preload may finish bridging right as script runs; re-apply to ensure Chromium engine factor is set
  if (typeof window !== "undefined") {
    setTimeout(() => {
      applyZoom(getSavedZoom());
    }, 50);
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    const active = getSavedTheme();
    if (active === "system") {
      applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleChange);

  // Global keyboard shortcuts for zoom (Ctrl/Cmd + Plus, Minus, 0)
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      zoomIn();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      zoomOut();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      resetZoom();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  // Also listen for Electron native-theme changes if bridged
  let cleanupElectron: (() => void) | undefined;
  if (electron?.onSystemThemeChange) {
    cleanupElectron = electron.onSystemThemeChange(() => {
      const active = getSavedTheme();
      if (active === "system") {
        applyTheme("system");
      }
    });
  }

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
    window.removeEventListener("keydown", handleKeyDown);
    cleanupElectron?.();
  };
}
