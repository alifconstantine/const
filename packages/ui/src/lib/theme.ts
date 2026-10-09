"use client";

import { useState, useEffect } from "react";

export type Theme = "system" | "light" | "dark";

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
  } else if (electron?.window?.setThemeMode) {
    electron.window.setThemeMode(theme);
  }

  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("const-theme-change", { detail: theme }));

  // When switching to system, re-apply after a brief delay in case Electron/Chromium
  // needs a tick to update the prefers-color-scheme media query
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

export function initThemeListener(): () => void {
  if (typeof window === "undefined") return () => {};

  const currentTheme = getSavedTheme();

  // Sync initial theme to Electron
  const electron = (window as any).electron;
  if (electron?.setThemeMode) {
    electron.setThemeMode(currentTheme);
  } else if (electron?.window?.setThemeMode) {
    electron.window.setThemeMode(currentTheme);
  }

  applyTheme(currentTheme);

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
