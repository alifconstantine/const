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
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("const-theme-change", { detail: theme }));
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

export function initThemeListener() {
  if (typeof window === "undefined") return () => {};

  const currentTheme = getSavedTheme();
  applyTheme(currentTheme);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    const active = getSavedTheme();
    if (active === "system") {
      applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
