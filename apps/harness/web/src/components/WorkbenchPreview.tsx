"use client";

import React, { useState, useEffect } from "react";
import {
  Archive,
  ArrowUp,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  Eye,
  FileDiff,
  Folder,
  FolderOpen,
  Hand,
  LayoutList,
  MessageCirclePlus,
  MessageSquare,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Square,
  SquareTerminal,
  Store,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ConstLogoIcon } from "@const/ui";

interface ChatItem {
  id: string;
  title: string;
  time: string;
}

interface ProjectFolder {
  id: string;
  name: string;
  open: boolean;
  items: ChatItem[];
  totalCount?: number;
}

const THINKING_LEVELS = ["Low", "Medium", "High", "Max"] as const;
const DEMO_MODEL = "DeepSeek V4.1 Flash";

export function WorkbenchPreview({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Desktop sidebar & overlays state
  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);

  // Active chat & input state
  const [activeChat, setActiveChat] = useState("redesign-hero");
  const [inputMessage, setInputMessage] = useState("");
  const [selectedContext, setSelectedContext] = useState("const-web");
  const [thinkingIndex, setThinkingIndex] = useState(2); // High
  const [authMode, setAuthMode] = useState<"ask_before_changes" | "request_review" | "full_access">("ask_before_changes");
  const [isSending, setIsSending] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [isOutsideExpanded, setIsOutsideExpanded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const model = DEMO_MODEL;
  const thinkingLabel = THINKING_LEVELS[thinkingIndex] ?? "High";

  // Project Folders tree matching the desktop workbench structure
  const [folders, setFolders] = useState<ProjectFolder[]>([
    {
      id: "const-web",
      name: "const-web",
      open: true,
      items: [
        { id: "redesign-hero", title: "Redesign landing hero", time: "2h" },
        { id: "inspect-mobile", title: "Inspect mobile layout", time: "1d" },
        { id: "add-i18n", title: "Sync i18n locale keys", time: "3d" },
        { id: "audit-theme", title: "Audit dark mode tokens", time: "5d" },
      ],
    },
    {
      id: "api-router",
      name: "api-router",
      open: true,
      items: [
        { id: "stream-proxy", title: "Optimize streaming proxy", time: "4d" },
        { id: "verify-qris", title: "Verify webhook signature", time: "6d" },
      ],
    },
    {
      id: "research",
      name: "research",
      open: true,
      items: [
        { id: "bench-summary", title: "Q4 benchmark summary", time: "1w" },
        { id: "agent-eval", title: "Compare subagent traces", time: "2w" },
      ],
    },
    {
      id: "design-kit",
      name: "design-kit",
      open: false,
      items: [
        { id: "token-audit", title: "Export Figma tokens", time: "2w" },
        { id: "icon-set", title: "Standardize icon grid", time: "3w" },
        { id: "motion-curve", title: "Tune scroll reveal easing", time: "3w" },
        { id: "card-states", title: "Review button states", time: "1mo" },
        { id: "a11y-check", title: "Run contrast checks", time: "1mo" },
        { id: "type-scale", title: "Refine heading scale", time: "1mo" },
        { id: "mobile-nav", title: "Polish drawer transitions", time: "1mo" },
      ],
      totalCount: 7,
    },
  ]);

  // Outside Project collapsible group
  const [outsideOpen, setOutsideOpen] = useState(true);
  const outsideItems: ChatItem[] = [
    { id: "out-1", title: "Draft release changelog", time: "3d" },
    { id: "out-2", title: "Analyze CSV sales metrics", time: "5d" },
    { id: "out-3", title: "Build slide deck from brief", time: "1w" },
    { id: "out-4", title: "Automate daily repo check", time: "2w" },
    { id: "out-5", title: "Review security audit notes", time: "2w" },
    { id: "out-6", title: "Summarize API docs", time: "3w" },
    { id: "out-7", title: "Clean up stale branches", time: "1mo" },
  ];

  const toggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, open: !f.open } : f)),
    );
  };

  const toggleAllFolders = () => {
    const nextState = allCollapsed;
    setFolders((prev) => prev.map((f) => ({ ...f, open: nextState })));
    setOutsideOpen(nextState);
    setAllCollapsed(!allCollapsed);
  };

  const handleSelectChat = (item: ChatItem, contextName: string) => {
    setActiveChat(item.id);
    setSelectedContext(contextName);
    setInputMessage(item.title);
    setStatusNotice(null);
    setMobileDrawerOpen(false);
  };

  const handleNewChat = () => {
    setActiveChat("");
    setInputMessage("");
    setStatusNotice(null);
    setMobileDrawerOpen(false);
  };

  const handleSend = () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setStatusNotice(`Queued "${trimmed}" in ${selectedContext} (${model})`);
    setTimeout(() => {
      setIsSending(false);
      setInputMessage("");
    }, 800);
  };

  const toggleAuthMode = () => {
    const order: Array<"ask_before_changes" | "request_review" | "full_access"> = [
      "ask_before_changes",
      "request_review",
      "full_access",
    ];
    const currentIndex = order.indexOf(authMode);
    const next = order[(currentIndex + 1) % order.length];
    if (next) setAuthMode(next);
  };

  const authModeLabel =
    authMode === "full_access"
      ? "Full access"
      : authMode === "request_review"
        ? "Request review"
        : "Ask before changes";

  const toggleContext = () => {
    const contexts = ["const-web", "api-router", "research", "design-kit", "Outside Project"];
    const currentIndex = contexts.indexOf(selectedContext);
    const next = contexts[(currentIndex + 1) % contexts.length];
    if (next) setSelectedContext(next);
  };

  // Sidebar component: logo, new chat, nav, projects, and avatar A
  const renderSidebarContent = () => (
    <div className="ch-desk-sidebar-inner">
      {/* 1. Sidebar Top Header: Const Brand + HARNESS Badge + Collapse Button (matching Image 3 & desktop) */}
      <div className="ch-desk-sidebar-header">
        <div className="flex items-center gap-2 px-0.5">
          <ConstLogoIcon
            brand="harness"
            size={18}
            variant={mounted && resolvedTheme === "dark" ? "dark-transparent" : "transparent"}
            className="w-[18px] h-[18px] shrink-0"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-base font-normal tracking-tight ch-desk-brand-word">
              Const
            </span>
            <span className="ch-desk-harness-badge">HARNESS</span>
          </div>
        </div>

        <button
          type="button"
          className="ch-desk-panel-btn"
          onClick={() => {
            if (window.innerWidth < 860) {
              setMobileDrawerOpen(false);
            } else {
              setSidebarOpen(false);
            }
          }}
          title="Collapse Sidebar"
          aria-label="Collapse Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Top Action: + New Chat (with MessageCirclePlus icon and Ctrl+N badge) */}
      <div className="ch-desk-sidebar-top-action">
        <button
          type="button"
          className="ch-desk-new-chat-btn"
          onClick={handleNewChat}
          title="New chat (Ctrl+N)"
        >
          <div className="flex items-center gap-2.5">
            <MessageCirclePlus className="w-4 h-4 stroke-[1.8]" />
            <span className="font-medium text-xs">New Chat</span>
          </div>
          <span className="ch-desk-kbd-shortcut">Ctrl+N</span>
        </button>
      </div>

      {/* 3. Primary Navigation Menu (Search, Scheduled Tasks, Marketplace) */}
      <nav className="ch-desk-nav" aria-label="Desktop Navigation">
        <button type="button" className="ch-desk-nav-btn">
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4" />
            <span>Search</span>
          </div>
          <span className="ch-desk-kbd-shortcut">Ctrl+K</span>
        </button>

        <button type="button" className="ch-desk-nav-btn">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-4 h-4" />
            <span>Scheduled Tasks</span>
          </div>
        </button>

        <button type="button" className="ch-desk-nav-btn">
          <div className="flex items-center gap-2.5">
            <Store className="w-4 h-4" />
            <span>Marketplace</span>
          </div>
        </button>
      </nav>

      {/* 4. Projects Section Header */}
      <div className="ch-desk-projects-container">
        <div className="ch-desk-section-header">
          <button
            type="button"
            className="ch-desk-section-trigger"
            onClick={toggleAllFolders}
          >
            <Folder className="w-3.5 h-3.5 shrink-0" />
            <span>Projects</span>
            <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="ch-desk-icon-btn"
              onClick={toggleAllFolders}
              title={allCollapsed ? "Expand all" : "Collapse all"}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="ch-desk-icon-btn"
              title="Archived sessions"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tree of Folders: Const, Learn, UTS, Tes (matching Image 3) */}
        <div className="ch-desk-folder-list">
          {folders.map((folder) => {
            const isFolderExpanded = Boolean(expandedFolders[folder.id]);
            const visibleItems = isFolderExpanded
              ? folder.items
              : folder.items.slice(0, 6);

            return (
              <div key={folder.id} className="ch-desk-folder-group">
                <button
                  type="button"
                  className="ch-desk-folder-header"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {folder.open ? (
                      <FolderOpen className="w-4 h-4 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </div>
                </button>

                {folder.open && (
                  <div className="ch-desk-folder-children">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`ch-desk-chat-item ${
                          activeChat === item.id ? "active" : ""
                        }`}
                        onClick={() => handleSelectChat(item, folder.name)}
                      >
                        <span className="truncate">{item.title}</span>
                        <span className="ch-desk-chat-time">{item.time}</span>
                      </button>
                    ))}

                    {folder.totalCount && (
                      <button
                        type="button"
                        className="ch-desk-see-all-btn"
                        onClick={() =>
                          setExpandedFolders((prev) => ({
                            ...prev,
                            [folder.id]: !prev[folder.id],
                          }))
                        }
                      >
                        {isFolderExpanded
                          ? "Show less"
                          : `See all (${folder.totalCount})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Outside Project Collapsible Group matching Image 3 */}
        <div className="ch-desk-outside-group">
          <button
            type="button"
            className="ch-desk-outside-header"
            onClick={() => setOutsideOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">Outside Project</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                outsideOpen ? "" : "-rotate-90"
              }`}
            />
          </button>

          {outsideOpen && (
            <div className="ch-desk-folder-children">
              {(isOutsideExpanded
                ? outsideItems
                : outsideItems.slice(0, 6)
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ch-desk-chat-item ${
                    activeChat === item.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectChat(item, "Outside Project")}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="ch-desk-chat-time">{item.time}</span>
                </button>
              ))}

              <button
                type="button"
                className="ch-desk-see-all-btn"
                onClick={() => setIsOutsideExpanded((prev) => !prev)}
              >
                {isOutsideExpanded ? "Show less" : `See all (${outsideItems.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. User Profile Bar */}
      <div className="ch-desk-user-footer">
        <div className="ch-desk-user-avatar">
          <span>C</span>
        </div>
        <div className="ch-desk-user-info">
          <span className="ch-desk-user-name">Const Workspace</span>
          <span className="ch-desk-user-email">workspace@const.web.id</span>
        </div>
        <ChevronsUpDown className="w-4 h-4 shrink-0 ml-auto" />
      </div>
    </div>
  );

  return (
    <div
      className={`ch-desk-window ${compact ? "ch-desk-window-compact" : ""}`}
      role="region"
      aria-label="Const Harness Desktop Mockup"
    >
      {/* =========================================================================
       * Window Body (Sidebar on left + Main Content Panel on right)
       * Matching exact layout from apps/harness/desktop/src/App.tsx & Image 1/2
       * ========================================================================= */}
      <div className="ch-desk-body">
        {/* Desktop Sidebar */}
        {sidebarOpen && (
          <aside className="ch-desk-sidebar" aria-label="Desktop Workspace Sidebar">
            {renderSidebarContent()}
          </aside>
        )}

        {/* Mobile Slide-over Drawer for Sidebar */}
        {mobileDrawerOpen && (
          <div
            className="ch-desk-drawer-backdrop"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div
              className="ch-desk-drawer-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ch-desk-drawer-top">
                <span className="text-xs font-semibold ch-desk-brand-word">Navigation</span>
                <button
                  type="button"
                  className="ch-desk-drawer-close"
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Main Content Panel (Canvas with seamless Top Toolbar at top) */}
        <main className="ch-desk-canvas">
          {/* Seamless Top Toolbar inside Canvas matching Image 1 & desktop top-toolbar */}
          <div className="ch-desk-canvas-topbar">
            {/* Left toggle button if sidebar is collapsed */}
            <div className="flex items-center gap-1.5">
              {!sidebarOpen && (
                <>
                  <button
                    type="button"
                    className="ch-desk-panel-btn"
                    onClick={() => {
                      if (window.innerWidth < 860) {
                        setMobileDrawerOpen(true);
                      } else {
                        setSidebarOpen(true);
                      }
                    }}
                    title="Expand Sidebar (Ctrl+B)"
                    aria-label="Expand Sidebar"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="ch-desk-panel-btn"
                    onClick={handleNewChat}
                    title="New Chat (Ctrl+N)"
                    aria-label="New Chat"
                  >
                    <MessageCirclePlus className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Right: Activity + Terminal + SidePanel + Window Controls matching desktop/src/App.tsx */}
            <div className="ch-desk-canvas-topbar-right">
              <div className="ch-desk-utility-tools">
                <button
                  type="button"
                  className={`ch-desk-tool-btn ${activityOpen ? "active" : ""}`}
                  onClick={() => setActivityOpen((prev) => !prev)}
                  title="Activity"
                  aria-label="Activity"
                  aria-expanded={activityOpen}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="ch-desk-tool-btn"
                  title="Open Terminal"
                  aria-label="Terminal"
                >
                  <SquareTerminal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="ch-desk-tool-btn"
                  title="Open right sidebar"
                  aria-label="Toggle right pane"
                >
                  <PanelRight className="w-4 h-4" />
                </button>
              </div>

              <div className="ch-desk-win-controls">
                <button type="button" className="ch-desk-win-btn" title="Minimize" aria-label="Minimize">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="ch-desk-win-btn" title="Maximize" aria-label="Maximize">
                  <Square className="w-3 h-3" />
                </button>
                <button type="button" className="ch-desk-win-btn close" title="Close" aria-label="Close">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Floating Activity Overlay matching FloatingWorkbenchCard in desktop App.tsx */}
          {activityOpen && (
            <div className="ch-desk-activity-popover" role="region" aria-label="Workspace Activity">
              <div className="ch-desk-activity-header">
                <div className="flex items-center gap-2">
                  <LayoutList className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Activity</span>
                </div>
                <button
                  type="button"
                  className="ch-desk-icon-btn"
                  onClick={() => setActivityOpen(false)}
                  aria-label="Close activity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="ch-desk-activity-section">
                <div className="ch-desk-activity-section-head">
                  <span>Progress</span>
                  <span>2/3</span>
                </div>
                <div className="ch-desk-activity-row">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">Audit desktop ChatCard & toolbar</span>
                </div>
                <div className="ch-desk-activity-row">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">Update landing Intelligence UI</span>
                </div>
                <div className="ch-desk-activity-row muted">
                  <Circle className="w-3 h-3 shrink-0" />
                  <span className="truncate">Verify production Next.js build</span>
                </div>
              </div>
              <div className="ch-desk-activity-section">
                <div className="ch-desk-activity-section-head">
                  <span>SubAgents &amp; Changes</span>
                  <span>2</span>
                </div>
                <div className="ch-desk-activity-row">
                  <Bot className="w-3 h-3 text-[#3b82f6] shrink-0" />
                  <span className="truncate">ui-auditor · Desktop tokens verified</span>
                </div>
                <div className="ch-desk-activity-row">
                  <FileDiff className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">HeroSection.tsx</span>
                  <span className="ml-auto text-[10.5px] font-mono text-emerald-500">+18</span>
                </div>
              </div>
            </div>
          )}

          {/* Centered Workspace Area (Greeting & Unified ChatCard matching desktop/src/components/workbench/chat-card.tsx) */}
          <div className="ch-desk-canvas-center">
            <div className="ch-desk-canvas-inner">
              {/* Centered Greeting Text */}
              <p className="ch-desk-greeting">
                Morning, how can I help?
              </p>

              {/* Unified ChatCard (Audited from chat-card.tsx lines 1379-2398) */}
              <div className="ch-desk-chat-card">
                {/* Top Header Strip: Choose Project */}
                <div className="ch-desk-card-top-strip">
                  <button
                    type="button"
                    className="ch-desk-project-btn"
                    onClick={toggleContext}
                    title="Choose project context"
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{selectedContext}</span>
                    <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                  </button>
                </div>

                {/* AI Input Box (#ffffff light / #2b2b2b dark) */}
                <div className="ch-desk-card-inner-box">
                  {/* Input Area */}
                  <div className="ch-desk-input-container">
                    <input
                      type="text"
                      className="ch-desk-input"
                      placeholder="Ask Const anything, type @ to mention files, folders, or web..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSend();
                      }}
                    />
                  </div>

                  {/* Bottom Actions Row: + , Permission Mode | Model Selector , Send */}
                  <div className="ch-desk-card-bottom-row">
                    {/* Left: Plus context + Access Mode Selector */}
                    <div className="ch-desk-actions-left">
                      <button
                        type="button"
                        className="ch-desk-plus-btn"
                        title="Add context"
                        aria-label="Add context"
                      >
                        <Plus className="w-4 h-4 stroke-[1.75]" />
                      </button>

                      <button
                        type="button"
                        className={`ch-desk-mode-btn ${authMode === "full_access" ? "full-access" : ""}`}
                        onClick={toggleAuthMode}
                        title={authModeLabel}
                      >
                        {authMode === "full_access" ? (
                          <ShieldAlert className="w-4 h-4 text-[#e79737] stroke-[1.75] shrink-0" />
                        ) : authMode === "request_review" ? (
                          <Eye className="w-4 h-4 stroke-[1.75] shrink-0" />
                        ) : (
                          <Hand className="w-4 h-4 stroke-[1.75] shrink-0" />
                        )}
                        <span className="hidden sm:inline truncate max-w-[140px]">{authModeLabel}</span>
                        <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                      </button>
                    </div>

                    {/* Right: Model Selector (opens Thinking Level popover) + Squircle Send Button */}
                    <div className="ch-desk-actions-right">
                      <div className="relative">
                        <button
                          type="button"
                          className={`ch-desk-action-pill ${modelPopoverOpen ? "active" : ""}`}
                          onClick={() => setModelPopoverOpen((prev) => !prev)}
                          title={`Model: ${model} (Thinking: ${thinkingLabel})`}
                          aria-expanded={modelPopoverOpen}
                        >
                          <span className="truncate max-w-[130px] sm:max-w-[180px]">{model}</span>
                          <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                        </button>

                        {modelPopoverOpen && (
                          <div className="ch-desk-model-popover" role="dialog" aria-label="Model and thinking level">
                            <button
                              type="button"
                              className="ch-desk-model-gear"
                              onClick={() => setModelPopoverOpen(false)}
                              title="Close"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <div className="ch-desk-model-popover-header">
                              <span className="ch-desk-thinking-title">{thinkingLabel}</span>
                              <span className="ch-desk-model-switch truncate">{model}</span>
                            </div>
                            <div className="ch-desk-thinking-track" aria-label="Thinking level slider">
                              <div
                                className="ch-desk-thinking-fill"
                                style={{
                                  width: `${Math.max(18, ((thinkingIndex + 1) / THINKING_LEVELS.length) * 100)}%`,
                                }}
                              />
                              {THINKING_LEVELS.map((lvl, i) => {
                                const leftPct = 10 + (i / (THINKING_LEVELS.length - 1)) * 80;
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    className={`ch-desk-thinking-stop ${i === thinkingIndex ? "active" : ""}`}
                                    style={{ left: `${leftPct}%` }}
                                    onClick={() => setThinkingIndex(i)}
                                    title={`Thinking: ${lvl}`}
                                    aria-label={`Thinking: ${lvl}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className={`ch-desk-send-btn ${inputMessage.trim() ? "active" : ""} ${
                          isSending ? "sending" : ""
                        }`}
                        onClick={handleSend}
                        title="Send message"
                        aria-label="Send message"
                      >
                        <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {statusNotice && (
                <p className="ch-desk-status-notice" role="status">
                  {statusNotice}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
