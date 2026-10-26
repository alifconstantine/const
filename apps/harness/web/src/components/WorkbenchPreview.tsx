"use client";
import React, { useState } from "react";
import {
  ArrowUp,
  Boxes,
  CalendarClock,
  ChevronDown,
  Cloud,
  Code2,
  Folder,
  Globe,
  Laptop,
  Lightbulb,
  ListTodo,
  PanelLeft,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { HarnessMascot } from "./ui/harness-mascot";

export function WorkbenchPreview({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"local" | "cloud">("local");
  const [selectedProject, setSelectedProject] = useState(0);
  const [inputMessage, setInputMessage] = useState("");
  const [model, setModel] = useState("M3.1 Flash");
  const [isSending, setIsSending] = useState(false);

  const projects = [
    "Build a 3D Roller Coaster...",
    "Compare Five High-Growth...",
    "Create a Daily AI Brief",
    "H3 Video Generation",
  ];

  const quickPrompts = [
    {
      id: "video",
      icon: Video,
      badge: "H3",
      label: t("preview.quick.video"),
      prompt: "Generate a realistic 3D roller coaster video sequence with dynamic camera motion.",
    },
    {
      id: "code",
      icon: Code2,
      label: t("preview.quick.code"),
      prompt: "Build a high-performance Next.js application with smooth GSAP animations and Tailwind CSS.",
    },
    {
      id: "data",
      icon: Lightbulb,
      label: t("preview.quick.data"),
      prompt: "Analyze the latest market dataset and identify key growth drivers with visualizations.",
    },
    {
      id: "general",
      icon: ListTodo,
      label: t("preview.quick.general"),
      prompt: "Organize my open tasks, prioritize bug fixes, and generate an executive summary.",
    },
    {
      id: "ideas",
      icon: Sparkles,
      label: t("preview.quick.ideas"),
      prompt: "Brainstorm 5 innovative desktop AI workbench features for creative professionals.",
    },
  ];

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setInputMessage("");
    }, 1200);
  };

  return (
    <div
      className={`ch-app-window ${compact ? "ch-app-window-compact" : ""}`}
      role="region"
      aria-label={t("preview.alt")}
    >
      {/* Left Sidebar */}
      <aside className="ch-app-sidebar">
        {/* macOS Window Controls */}
        <div className="ch-window-controls">
          <span className="ch-window-dot ch-dot-red" />
          <span className="ch-window-dot ch-dot-yellow" />
          <span className="ch-window-dot ch-dot-green" />
          <button type="button" className="ch-window-split-btn" title="Toggle Sidebar">
            <PanelLeft size={13} />
          </button>
        </div>

        {/* Top: + New task */}
        <div className="ch-app-sidebar-top">
          <button
            type="button"
            className="ch-new-task-btn"
            onClick={() => setInputMessage("")}
          >
            <span className="flex items-center gap-2">
              <Plus size={15} />
              <span>{t("preview.new")}</span>
            </span>
            <Cloud size={14} className="opacity-60" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="ch-app-nav" aria-label="Workbench navigation">
          <button type="button" className="ch-app-nav-item">
            <Boxes size={15} />
            <span>{t("preview.plugins")}</span>
          </button>
          <button type="button" className="ch-app-nav-item">
            <CalendarClock size={15} />
            <span>{t("preview.scheduled")}</span>
          </button>
          <button type="button" className="ch-app-nav-item">
            <Globe size={15} />
            <span>{t("preview.sites")}</span>
          </button>
          <button type="button" className="ch-app-nav-item">
            <Radio size={15} />
            <span>{t("preview.remote")}</span>
          </button>
        </nav>

        {/* Local / Cloud Segmented Toggle */}
        <div className="ch-env-toggle-wrap">
          <div className="ch-env-toggle" role="group" aria-label="Environment">
            <button
              type="button"
              className={`ch-env-btn ${activeTab === "local" ? "active" : ""}`}
              onClick={() => setActiveTab("local")}
            >
              <Laptop size={13} />
              <span>{t("preview.local")}</span>
            </button>
            <button
              type="button"
              className={`ch-env-btn ${activeTab === "cloud" ? "active" : ""}`}
              onClick={() => setActiveTab("cloud")}
            >
              <Cloud size={13} />
              <span>{t("preview.cloud")}</span>
            </button>
          </div>
        </div>

        {/* Projects section */}
        <div className="ch-app-projects">
          <span className="ch-app-projects-label">{t("preview.projects")}</span>
          <div className="ch-app-project-folder">
            <Folder size={14} className="text-sky-500 shrink-0" />
            <span className="truncate">Const Harness</span>
          </div>
          <div className="ch-app-project-tasks">
            {projects.map((proj, i) => (
              <button
                key={proj}
                type="button"
                className={`ch-app-project-task ${
                  selectedProject === i ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedProject(i);
                  setInputMessage(proj);
                }}
              >
                <span className="truncate">{proj}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User profile footer */}
        <div className="ch-app-user-bar">
          <div className="ch-app-user-avatar">
            <span className="ch-user-symbol">👓</span>
          </div>
          <span className="ch-app-user-name">Const 021</span>
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <main className="ch-app-canvas">
        <div className="ch-app-canvas-inner">
          {/* Mascot Icon */}
          <div className="ch-app-mascot-wrapper">
            <HarnessMascot size={64} />
          </div>

          {/* Heading Tagline */}
          <h2 className="ch-app-tagline">{t("preview.tagline")}</h2>

          {/* Prompt Composer Box */}
          <div className="ch-composer-card">
            <div className="ch-composer-input-area">
              <input
                type="text"
                className="ch-composer-input"
                placeholder={t("preview.inputPlaceholder")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
              />
            </div>

            {/* Bottom bar inside composer */}
            <div className="ch-composer-bottom-bar">
              <div className="ch-composer-actions-left">
                <button
                  type="button"
                  className="ch-composer-action-btn"
                  title="Add files or context"
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  className="ch-composer-auth-btn"
                  title="Smart authorization"
                >
                  <ShieldCheck size={14} className="text-sky-500" />
                  <span>{t("preview.smartAuth")}</span>
                </button>
              </div>

              <div className="ch-composer-actions-right">
                <button
                  type="button"
                  className="ch-model-pill"
                  onClick={() =>
                    setModel((prev) =>
                      prev === "M3.1 Flash" ? "Claude 3.7" : "M3.1 Flash",
                    )
                  }
                  title="Switch Model"
                >
                  <span>{model}</span>
                  <ChevronDown size={13} className="opacity-60" />
                </button>

                <button
                  type="button"
                  className={`ch-composer-send-btn ${isSending ? "sending" : ""}`}
                  aria-label="Send message"
                  onClick={handleSend}
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Under-composer location & folder chips */}
          <div className="ch-composer-subbar">
            <button type="button" className="ch-subbar-item">
              <Folder size={14} />
              <span>{t("preview.selectFolder")}</span>
            </button>
            <button type="button" className="ch-subbar-item">
              <Laptop size={14} />
              <span>{t("preview.local")}</span>
            </button>
          </div>

          {/* Quick Prompt Pills Row */}
          <div
            className="ch-quick-prompts"
            role="toolbar"
            aria-label="Quick prompts"
          >
            {quickPrompts.map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.id}
                  type="button"
                  className="ch-quick-pill"
                  onClick={() => setInputMessage(qp.prompt)}
                >
                  <Icon size={14} className="shrink-0 opacity-80" />
                  <span>{qp.label}</span>
                  {qp.badge && <span className="ch-pill-badge">{qp.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
