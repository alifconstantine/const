"use client";

import React, { useState } from "react";
import {
  Archive,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns2,
  Folder,
  FolderOpen,
  Globe,
  Hand,
  MessageCirclePlus,
  MessageSquare,
  Minus,
  PanelLeft,
  Plus,
  Search,
  SquareTerminal,
  Store,
  X,
} from "lucide-react";
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

function WindowsRestoreIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
    >
      <rect x="3.5" y="1.5" width="7" height="7" rx="0.5" />
      <path d="M1.5 3.5v7h7" />
    </svg>
  );
}

// Exact Reasoning / Thinking Effort icon from Image 1 & desktop chat-card
function ThinkingEffortIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <circle cx="8" cy="8" r="6" />
      <line x1="8" y1="3.5" x2="8" y2="12.5" />
      <line x1="4.5" y1="6" x2="6" y2="6" />
      <line x1="10" y1="6" x2="11.5" y2="6" />
      <line x1="4.5" y1="8" x2="6" y2="8" />
      <line x1="10" y1="8" x2="11.5" y2="8" />
      <line x1="4.5" y1="10" x2="6" y2="10" />
      <line x1="10" y1="10" x2="11.5" y2="10" />
    </svg>
  );
}

export function WorkbenchPreview({ compact = false }: { compact?: boolean }) {
  // Desktop sidebar collapse state
  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  // Mobile drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Active chat & input state
  const [activeChat, setActiveChat] = useState("hii-tess");
  const [inputMessage, setInputMessage] = useState("");
  const [selectedContext, setSelectedContext] = useState("Outside Project");
  const [model, setModel] = useState("DeepSeek v4.1 Flash:free");
  const [effort, setEffort] = useState("High");
  const [authMode, setAuthMode] = useState("Ask before ch...");
  const [isSending, setIsSending] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [isOutsideExpanded, setIsOutsideExpanded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Exact Project Folders tree from Image 3 & desktop codebase
  const [folders, setFolders] = useState<ProjectFolder[]>([
    {
      id: "const",
      name: "Const",
      open: true,
      items: [
        { id: "hii-tess", title: "hii tess", time: "7d" },
        { id: "buka-browser", title: "buka browser dan ke ...", time: "15d" },
        { id: "cek-home", title: "cek /home/constantine...", time: "25d" },
        { id: "tes-const", title: "tes", time: "25d" },
      ],
    },
    {
      id: "learn",
      name: "Learn",
      open: true,
      items: [{ id: "learn-tes", title: "tes", time: "25d" }],
    },
    {
      id: "uts",
      name: "UTS",
      open: true,
      items: [
        { id: "uts-1", title: "kamu jawab instruksi c...", time: "27d" },
        { id: "uts-2", title: "kamu jawab dan buat...", time: "27d" },
      ],
    },
    {
      id: "tes",
      name: "Tes",
      open: true,
      items: [
        { id: "tes-1", title: "apa cappability kamu...", time: "47d" },
        { id: "tes-2", title: "buat folder baru berna...", time: "47d" },
        { id: "tes-3", title: "buat folder baru dan b...", time: "47d" },
        { id: "tes-4", title: "buat folder baru dan b...", time: "47d" },
        { id: "tes-5", title: "buat folder baru beris...", time: "47d" },
        { id: "tes-6", title: "buat folder baru beris...", time: "48d" },
      ],
      totalCount: 9,
    },
  ]);

  // Outside Project state (matching Image 3)
  const [outsideOpen, setOutsideOpen] = useState(true);
  const outsideItems: ChatItem[] = [
    { id: "out-1", title: "kamu ada tool call apa...", time: "48d" },
    { id: "out-2", title: "apa yang bisa kamu la...", time: "48d" },
    { id: "out-3", title: "buatkan game tic tac ...", time: "48d" },
    { id: "out-4", title: "buat folder baru dan b...", time: "49d" },
    { id: "out-5", title: "buat folder baru dan b...", time: "49d" },
    { id: "out-6", title: "buat folder baru dan b...", time: "49d" },
    { id: "out-7", title: "buat folder baru berna...", time: "49d" },
    { id: "out-8", title: "buat folder baru berna...", time: "50d" },
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
    setInputMessage(item.title.replace(/\.\.\.$/, ""));
    setMobileDrawerOpen(false);
  };

  const handleNewChat = () => {
    setActiveChat("");
    setInputMessage("");
    setMobileDrawerOpen(false);
  };

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setInputMessage("");
    }, 900);
  };

  const toggleModel = () => {
    const models = [
      "DeepSeek v4.1 Flash:free",
      "Claude 3.7 Sonnet",
      "Gemini 2.5 Pro",
      "GPT-4o",
    ];
    const currentIndex = models.indexOf(model);
    const next = models[(currentIndex + 1) % models.length];
    if (next) setModel(next);
  };

  const toggleEffort = () => {
    const levels = ["High", "Medium", "Low"];
    const currentIndex = levels.indexOf(effort);
    const next = levels[(currentIndex + 1) % levels.length];
    if (next) setEffort(next);
  };

  const toggleAuthMode = () => {
    const modes = ["Ask before ch...", "Request review", "Full access"];
    const currentIndex = modes.indexOf(authMode);
    const next = modes[(currentIndex + 1) % modes.length];
    if (next) setAuthMode(next);
  };

  const toggleContext = () => {
    const contexts = ["Outside Project", "Const", "Learn", "UTS", "Tes"];
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
            size={18}
            variant="transparent"
            className="w-[18px] h-[18px] shrink-0"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-base font-normal tracking-tight text-foreground">
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
                {isOutsideExpanded ? "Show less" : "See all (20)"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. User Profile Bar (Clean circular 'A' initials avatar as requested) */}
      <div className="ch-desk-user-footer">
        <div className="ch-desk-user-avatar">
          <span>A</span>
        </div>
        <div className="ch-desk-user-info">
          <span className="ch-desk-user-name">Alif Constantine 2</span>
          <span className="ch-desk-user-email">alifconstantine2@gmail.com</span>
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
                <span className="text-xs font-semibold text-foreground">Navigation</span>
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

            {/* Right: Globe + Terminal + Split Panel + Windows Controls */}
            <div className="ch-desk-canvas-topbar-right">
              <div className="ch-desk-utility-tools">
                <button type="button" className="ch-desk-tool-btn" title="Open Browser">
                  <Globe className="w-4 h-4" />
                </button>
                <button type="button" className="ch-desk-tool-btn" title="Toggle Terminal / Messages">
                  <SquareTerminal className="w-4 h-4" />
                </button>
                <button type="button" className="ch-desk-tool-btn" title="Split Layout">
                  <Columns2 className="w-4 h-4" />
                </button>
              </div>

              <div className="ch-desk-win-controls">
                <button type="button" className="ch-desk-win-btn" title="Minimize">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="ch-desk-win-btn" title="Restore Down">
                  <WindowsRestoreIcon className="w-3 h-3" />
                </button>
                <button type="button" className="ch-desk-win-btn close" title="Close">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Centered Workspace Area (Greeting & Two-Tier AI ChatCard) */}
          <div className="ch-desk-canvas-center">
            <div className="ch-desk-canvas-inner">
              {/* Centered Greeting Text (Matching exact proportions from Image 2: font-size 19px, color #d4d4d4, margin 14px) */}
              <p className="ch-desk-greeting">
                Morning, how can I help?
              </p>

              {/* Two-Tier ChatCard (Audited from chat-card.tsx lines 1258-1420 & Image 2) */}
              <div className="ch-desk-chat-card">
                {/* Tier 1 (Top Strip): Choose Project header background */}
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

                {/* Tier 2 (Inner Card): Lighter container with rounded-14px & border */}
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

                  {/* Bottom Actions Row (Audited from chat-card.tsx lines 1676-2228 & Image 2) */}
                  <div className="ch-desk-card-bottom-row">
                    {/* Left: Plus attachment + Hand "Ask before changes" */}
                    <div className="ch-desk-actions-left">
                      <button
                        type="button"
                        className="ch-desk-plus-btn"
                        title="Add context"
                      >
                        <Plus className="w-4 h-4 stroke-[1.75]" />
                      </button>

                      <button
                        type="button"
                        className="ch-desk-mode-btn"
                        onClick={toggleAuthMode}
                        title="Permission Mode: Ask before changes"
                      >
                        <Hand className="w-3.5 h-3.5 stroke-[1.75] shrink-0" />
                        <span className="hidden sm:inline truncate max-w-[120px]">{authMode}</span>
                        <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                      </button>
                    </div>

                    {/* Right: Model Selector + Reasoning Meter "High" + Squircle Send Button */}
                    <div className="ch-desk-actions-right">
                      <button
                        type="button"
                        className="ch-desk-action-pill"
                        onClick={toggleModel}
                        title="Switch Model"
                      >
                        <span className="hidden sm:inline truncate max-w-[150px]">{model}</span>
                        <span className="sm:hidden truncate max-w-[75px] text-[11.5px]">DeepSeek</span>
                        <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                      </button>

                      <button
                        type="button"
                        className="ch-desk-action-pill"
                        onClick={toggleEffort}
                        title="Thinking effort: High"
                      >
                        <ThinkingEffortIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{effort}</span>
                        <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                      </button>

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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
