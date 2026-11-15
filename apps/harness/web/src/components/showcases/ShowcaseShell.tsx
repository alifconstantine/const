"use client";

import React from "react";
import {
  Folder,
  LayoutList,
  MessageCirclePlus,
  Minus,
  PanelLeft,
  PanelRight,
  Square,
  SquareTerminal,
  X,
} from "lucide-react";
import "./showcases.css";

interface ShowcaseShellProps {
  title?: string;
  project?: string;
  activeActivity?: boolean;
  rightOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Shared authentic desktop shell mirroring apps/harness/desktop/src/App.tsx
 * and components/workbench/top-toolbar.tsx.
 */
export function ShowcaseShell({
  title = "Workspace task",
  project = "const-web",
  activeActivity = false,
  rightOpen = false,
  children,
}: ShowcaseShellProps) {
  return (
    <div className="ch-sc-frame">
      <div className="ch-sc-window">
        <div className="ch-sc-topbar">
          <div className="ch-sc-topbar-left">
            <span className="ch-sc-icon-btn" aria-hidden="true">
              <PanelLeft className="w-3.5 h-3.5" />
            </span>
            <span className="ch-sc-icon-btn" aria-hidden="true">
              <MessageCirclePlus className="w-3.5 h-3.5" />
            </span>
            <span className="truncate font-medium text-[12px]">{title}</span>
            <span className="ch-sc-project-chip">
              <Folder className="w-3 h-3" />
              <span>{project}</span>
            </span>
          </div>

          <div className="ch-sc-topbar-right" aria-hidden="true">
            <span
              className={`ch-sc-icon-btn ${
                activeActivity ? "bg-black/10 dark:bg-white/10 text-[var(--sc-ink)]" : ""
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
            </span>
            <span className="ch-sc-icon-btn">
              <SquareTerminal className="w-3.5 h-3.5" />
            </span>
            <span
              className={`ch-sc-icon-btn ${
                rightOpen ? "bg-black/10 dark:bg-white/10 text-[var(--sc-ink)]" : ""
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </span>
            <span className="ch-sc-divider" />
            <span className="ch-sc-icon-btn">
              <Minus className="w-3 h-3" />
            </span>
            <span className="ch-sc-icon-btn">
              <Square className="w-2.5 h-2.5" />
            </span>
            <span className="ch-sc-icon-btn">
              <X className="w-3 h-3" />
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
