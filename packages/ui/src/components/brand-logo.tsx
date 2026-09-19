"use client";

import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";

const SLUG_MAPPINGS: Record<string, string> = {
  x: "x-formerly-twitter",
  twitter: "x-formerly-twitter",
  microsoft_teams: "microsoft-teams",
  googlebigquery: "google-bigquery",
  "google-calendar": "google-calendar-2026",
  "google-drive": "google-drive-2026",
  "google-sheets": "google-sheets-2026",
  "google-docs": "google-docs-2026",
  "google-tasks": "google-tasks-2026",
  "google-meet": "google-meet-2026",
  "google-slides": "google-slides-2026",
  googledocs: "google-docs-2026",
  googleslides: "google-slides-2026",
  googledrive: "google-drive-2026",
  "zoho-books": "zoho",
  "zoho-inventory": "zoho",
  perplexityai: "perplexity",
  "microsoft-clarity": "clarity",
  bamboohr: "bamboo",
  "docker-hub": "docker",
  "hugging-face": "huggingface",
  cal: "caldotcom",
  codeinterpreter: "codeinterpreter",
  "cloud-sandbox": "codeinterpreter",
};

const THEME_FILES: Record<string, { dark: string; light: string }> = {
  "x-formerly-twitter": { dark: "dark.svg", light: "light.svg" },
  github: { dark: "dark.svg", light: "light.svg" },
  firecrawl: { dark: "dark.svg", light: "light.svg" },
  tiktok: { dark: "dark.svg", light: "light.svg" },
  caldotcom: { dark: "dark.svg", light: "light.svg" },
  miro: { dark: "light.svg", light: "dark.svg" },
  monday: { dark: "light.svg", light: "default.svg" },
  replicate: { dark: "dark.svg", light: "light.svg" },
  composio: { dark: "dark.svg", light: "light.svg" },
};

const FALLBACK_COLORS: Record<string, string> = {
  canva: "bg-blue-600 dark:bg-blue-700 text-white",
  spotify: "bg-green-500 dark:bg-green-600 text-black",
  github: "bg-zinc-800 dark:bg-zinc-700 text-white",
  "google-drive": "bg-yellow-500 dark:bg-yellow-600 text-white",
  "google-docs": "bg-blue-600 dark:bg-blue-700 text-white",
  "google-slides": "bg-amber-500 dark:bg-amber-600 text-white",
  notion: "bg-zinc-900 dark:bg-zinc-800 text-white",
  linear: "bg-indigo-600 dark:bg-indigo-700 text-white",
  clickup: "bg-purple-600 dark:bg-purple-700 text-white",
  dropbox: "bg-blue-500 dark:bg-blue-600 text-white",
  asana: "bg-rose-500 dark:bg-rose-600 text-white",
  figma: "bg-orange-500 dark:bg-orange-600 text-white",
  zoom: "bg-blue-500 dark:bg-blue-600 text-white",
  microsoft_teams: "bg-indigo-500 dark:bg-indigo-600 text-white",
  composio: "bg-zinc-900 dark:bg-zinc-800 text-emerald-400",
  slack: "bg-purple-600 dark:bg-purple-700 text-white",
};

export interface BrandLogoProps {
  id: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function BrandLogo({ id, name = "", size = "md", className = "" }: BrandLogoProps) {
  const [error, setError] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Detect dark mode from document class (supports SSR, Vite, Electron, Capacitor)
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Map UI id to simpleicons / thesvg slug
  const resolvedSlug = SLUG_MAPPINGS[id] || id;

  // Determine SVG file to load
  let svgFile = "default.svg";
  const themeConfig = THEME_FILES[resolvedSlug];
  if (themeConfig) {
    svgFile = isDark ? themeConfig.dark : themeConfig.light;
  }

  // Determine size classes (matching const-ai)
  let sizeClasses = "w-12 h-12 rounded-xl p-2.5";
  if (size === "xs") {
    sizeClasses = "w-5 h-5 rounded-md p-0.5";
  } else if (size === "sm") {
    sizeClasses = "w-8 h-8 rounded-lg p-1.5";
  } else if (size === "lg") {
    sizeClasses = "w-16 h-16 rounded-2xl p-3.5";
  } else if (size === "xl") {
    sizeClasses = "w-20 h-20 rounded-3xl p-4";
  }

  // Certain logos are black/dark and need to be inverted in dark mode to be visible
  const shouldInvertInDarkMode = ["notion", "linear", "typeform"].includes(resolvedSlug);

  // Fallback monogram
  const monogram = (name || id || "T")
    .substring(0, id === "github" || id === "google-drive" || id === "microsoft_teams" ? 2 : 1)
    .toUpperCase();

  const fallbackColor = FALLBACK_COLORS[id] || "bg-zinc-500 text-white";

  // Code Interpreter / Cloud Sandbox Special Icon (matching const-ai)
  if (id === "codeinterpreter" || resolvedSlug === "codeinterpreter" || id === "cloud-sandbox") {
    return (
      <div
        className={cn(
          "shrink-0 flex items-center justify-center select-none overflow-hidden bg-white dark:bg-zinc-900 border border-border/80 shadow-2xs",
          sizeClasses,
          className
        )}
        title={name || "Cloud Sandbox"}
      >
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-zinc-900 dark:text-zinc-100"
        >
          <path
            d="M3.5 4.5L6.5 7.5L3.5 10.5M8 10.5H12M1.5 1.5H13.5C14.0523 1.5 14.5 1.94772 14.5 2.5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H1.5C0.947716 13.5 0.5 13.0523 0.5 12.5V2.5C0.5 1.94772 0.947715 1.5 1.5 1.5Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-center select-none overflow-hidden shadow-2xs",
        error
          ? cn(
              fallbackColor,
              "font-bold",
              size === "xs"
                ? "text-[9px]"
                : size === "sm"
                  ? "text-xs"
                  : size === "lg"
                    ? "text-2xl"
                    : "text-lg"
            )
          : "bg-white dark:bg-zinc-900 border border-border/80",
        sizeClasses,
        className
      )}
      title={name || id}
    >
      {!error ? (
        <img
          src={`https://thesvg.org/icons/${resolvedSlug}/${svgFile}`}
          alt={`${name || id} logo`}
          className={cn(
            "w-full h-full object-contain",
            shouldInvertInDarkMode ? "dark:invert" : ""
          )}
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        <span>{monogram}</span>
      )}
    </div>
  );
}

export default BrandLogo;
