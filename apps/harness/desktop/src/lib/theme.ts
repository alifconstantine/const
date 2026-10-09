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

export function getSavedZoom(): number {
  if (typeof window === "undefined") return 100;
  const saved = localStorage.getItem("const_interface_zoom");
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
      return parsed;
    }
  }
  return 100;
}

export function applyZoom(zoom: number = 100) {
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
  localStorage.setItem("const_interface_zoom", String(zoom));
  applyZoom(zoom);
  window.dispatchEvent(new CustomEvent("const-zoom-change", { detail: zoom }));
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
    cleanupElectron?.();
  };
}
