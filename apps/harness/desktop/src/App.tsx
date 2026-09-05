import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LogIn,
  Loader2,
  Globe,
} from "lucide-react";
import { ConstLogoIcon, Button, toast, ScrollArea } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConvexClientProvider } from "./components/convex-provider";
import { Sidebar } from "./components/sidebar";
import { TopToolbar } from "./components/workbench/top-toolbar";
import { ChatCard } from "./components/workbench/chat-card";
import { MarkdownContent } from "./components/workbench/markdown-content";
import { ExecutionTrace } from "./components/workbench/execution-trace";
import { SettingsDialog } from "./components/settings-dialog";
import {
  loadConversations,
  saveConversation,
  deleteConversation,
  generateFallbackTitle,
  generateAiTitle,
  type ConversationItem,
} from "./lib/conversation-store";
import type { FileMutationRecord } from "./vite-env";
import authArt from "./assets/auth-art.jpg";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Morning, how can I help?";
  if (hour >= 12 && hour < 18) return "Afternoon, how can I help?";
  return "Evening, how can I help?";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: any;
    result?: any;
    isError?: boolean;
  }>;
  mutations?: FileMutationRecord[];
  timestamp: number;
}

function AuthenticatedContent({
  onSignOut,
  onSwitchAccount,
}: {
  onSignOut: () => void;
  onSwitchAccount: () => void;
}) {
  const user = useQuery(api.auth.queries.currentUser, {});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const greeting = getGreeting();

  // Conversation history & state
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    return loadConversations();
  });
  const [conversationId, setConversationId] = useState<string>(
    () => `session_${Date.now()}`
  );
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<string>(() => {
    return localStorage.getItem("const_harness_current_project") || "Outside Project";
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Compute accumulated diff stats across assistant messages in this conversation
  const diffStats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const msg of messages) {
      if (msg.mutations) {
        for (const mut of msg.mutations) {
          if (mut.rolledBack) continue;
          if (mut.operation === "create") {
            additions += mut.newContent ? mut.newContent.split("\n").length : 1;
          } else if (mut.operation === "modify") {
            const prev = mut.previousContent ? mut.previousContent.split("\n").length : 0;
            const next = mut.newContent ? mut.newContent.split("\n").length : 0;
            if (next >= prev) {
              additions += next - prev + 1;
            } else {
              additions += 1;
              deletions += prev - next;
            }
          } else if (mut.operation === "delete") {
            deletions += mut.previousContent ? mut.previousContent.split("\n").length : 1;
          }
        }
      }
    }
    return { additions, deletions };
  }, [messages]);

  // Clean display project name (e.g. "small-web" instead of full path)
  const displayProject = useMemo(() => {
    if (currentProject === "Outside Project") return "";
    return currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;
  }, [currentProject]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isExecuting]);

  // Handle agent streaming events from Electron main process
  useEffect(() => {
    if (!window.electron?.onAgentEvent) return;

    const unsubscribe = window.electron.onAgentEvent((event: any) => {
      if (event.type === "token") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const updated: ChatMessage = {
            ...last,
            content: last.content + (event.token || ""),
          };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "thinking") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const updated: ChatMessage = {
            ...last,
            thinking: (last.thinking || "") + (event.thinking || ""),
          };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "tool_call") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const tools = last.toolCalls ? [...last.toolCalls] : [];
          tools.push({
            id: event.toolCallId || `tc_${Date.now()}`,
            name: event.toolName || "tool",
            args: event.args,
          });
          const updated: ChatMessage = { ...last, toolCalls: tools };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "tool_result") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const tools = (last.toolCalls || []).map((tc) =>
            tc.id === event.toolCallId
              ? { ...tc, result: event.result, isError: event.isError }
              : tc
          );
          const updated: ChatMessage = { ...last, toolCalls: tools };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "file_mutation") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const mutations = last.mutations ? [...last.mutations] : [];
          if (event.record) {
            mutations.push(event.record);
          }
          const updated: ChatMessage = { ...last, mutations };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "done") {
        setIsExecuting(false);
        setMessages((latest) => {
          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.messages = latest;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
          return latest;
        });
      } else if (event.type === "error") {
        setIsExecuting(false);
        toast.error(event.error || "Agent execution error");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  const handleSendMessage = async ({
    prompt,
    project,
    mode,
    model,
  }: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
  }) => {
    if (!prompt.trim() || isExecuting) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: "assistant",
      content: "",
      thinking: "",
      toolCalls: [],
      mutations: [],
      timestamp: Date.now(),
    };

    const currentStreamMessages = [...messages, userMsg];
    setMessages([...currentStreamMessages, assistantPlaceholder]);
    setIsExecuting(true);

    const isFirstMessage = messages.length === 0;
    let titleToUse = conversationTitle;

    if (isFirstMessage) {
      titleToUse = generateFallbackTitle(prompt);
      setConversationTitle(titleToUse);

      // Asynchronously request AI to generate an ultra-clean title
      generateAiTitle(prompt, (aiTitle) => {
        setConversationTitle(aiTitle);
        const stored = loadConversations();
        const target = stored.find((c) => c.id === conversationId);
        if (target) {
          target.title = aiTitle;
          target.updatedAt = Date.now();
          saveConversation(target);
          setConversations(loadConversations());
        }
      });
    }

    const updatedConvo: ConversationItem = {
      id: conversationId,
      title: titleToUse || "New task",
      project: project,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: currentStreamMessages,
    };
    saveConversation(updatedConvo);
    setConversations(loadConversations());

    if (window.electron?.sendMessage) {
      try {
        const payloadMessages = currentStreamMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model,
          workspacePath: project,
          mode,
          conversationId,
        });

        if (!res.success && res.error) {
          toast.error(res.error);
          setIsExecuting(false);
        }
      } catch (err: any) {
        toast.error(err.message || "Communication error with agent");
        setIsExecuting(false);
      }
    } else {
      setTimeout(() => {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const next = [...prev];
          const updated: ChatMessage = {
            ...last,
            content: "Const Agent is ready! Running with complete workspace integration.",
          };
          next[lastIdx] = updated;
          return next;
        });
        setIsExecuting(false);
      }, 600);
    }
  };

  const handleRollback = async (record: FileMutationRecord) => {
    if (!window.electron?.rollbackFile) {
      toast.error("Rollback is only available in the desktop application");
      return;
    }
    try {
      const res = await window.electron.rollbackFile(record);
      if (res.success) {
        toast.success(res.message || `Reverted ${record.targetFile}`);
        setMessages((prev) => {
          const next = prev.map((msg) => ({
            ...msg,
            mutations: msg.mutations?.map((m) =>
              m.id === record.id ? { ...m, rolledBack: true } : m
            ),
          }));
          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.messages = next;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
          return next;
        });
      } else {
        toast.error(res.message || `Failed to rollback ${record.targetFile}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Rollback error");
    }
  };

  const handleAbort = async () => {
    if (window.electron?.abortAgent) {
      await window.electron.abortAgent();
    }
    setIsExecuting(false);
  };

  const handleNewChat = () => {
    if (isExecuting) {
      handleAbort();
    }
    setMessages([]);
    setConversationTitle("");
    setConversationId(`session_${Date.now()}`);
    setIsExecuting(false);
  };

  const handleSelectConversation = (id: string) => {
    if (isExecuting) {
      handleAbort();
    }
    const target = conversations.find((c) => c.id === id);
    if (target) {
      setConversationId(target.id);
      setConversationTitle(target.title);
      setCurrentProject(target.project || "Outside Project");
      setMessages(target.messages || []);
      setIsExecuting(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    if (id === conversationId) {
      handleNewChat();
    }
  };

  const handleOpenFolder = async () => {
    if (window.electron?.openDirectoryDialog) {
      const selectedDir = await window.electron.openDirectoryDialog();
      if (selectedDir) {
        setCurrentProject(selectedDir);
        localStorage.setItem("const_harness_current_project", selectedDir);
        try {
          const raw = localStorage.getItem("const_harness_workspaces");
          const existing = raw ? JSON.parse(raw) : [];
          const next = existing.includes(selectedDir) ? existing : [selectedDir, ...existing];
          localStorage.setItem("const_harness_workspaces", JSON.stringify(next));
        } catch {}
      }
    }
  };

  // Keyboard shortcut Ctrl+N for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExecuting]);

  return (
    <div className="h-screen w-screen flex bg-[#2b2b2b] text-[#d4d4d4] overflow-hidden select-none">
      {/* Left Sidebar (Only visible when isSidebarOpen = true) */}
      {isSidebarOpen && (
        <Sidebar
          user={user}
          onSignOut={onSignOut}
          onSwitchAccount={onSwitchAccount}
          onCollapse={() => setIsSidebarOpen(false)}
          onNewChat={handleNewChat}
          conversations={conversations}
          activeConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Main Content Area: Background #161616, text #d4d4d4, rounded only on left */}
      <main
        className={`flex-1 h-full bg-[#161616] text-[#d4d4d4] overflow-hidden flex flex-col relative transition-[border-radius] duration-200 ${
          isSidebarOpen ? "rounded-l-2xl sm:rounded-l-3xl border-l border-[#333333]/40" : ""
        }`}
      >
        {/* Top Window Toolbar */}
        <TopToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onNewChat={handleNewChat}
          conversationTitle={conversationTitle}
          project={displayProject}
          diffStats={diffStats}
          onOpenFolder={handleOpenFolder}
        />

        {/* Dynamic Canvas: Landing Layout when 0 messages vs Active Stream Layout */}
        {messages.length === 0 ? (
          <div className="flex-1 relative flex flex-col items-center justify-center px-4 sm:px-8 pt-6 pb-6 overflow-y-auto">
            {/* Centered Conversation Container */}
            <div className="relative flex flex-col items-center w-full max-w-2xl z-10 translate-y-6 sm:translate-y-8">
              {/* Faint Logo: Placed slightly above, fading and blurred into background */}
              <div
                className="absolute -top-36 sm:-top-44 left-1/2 -translate-x-1/2 pointer-events-none select-none opacity-20 dark:opacity-25"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0) 90%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0) 90%)",
                  filter: "blur(0.75px)",
                }}
              >
                <ConstLogoIcon
                  size="lg"
                  className="w-64 h-64 sm:w-80 sm:h-80 text-[#d4d4d4]"
                />
              </div>

              {/* Greeting Text: Color #d4d4d4 */}
              <h1 className="text-2xl sm:text-[28px] font-medium tracking-tight text-[#d4d4d4] text-center mb-6 z-10 font-sans">
                {greeting}
              </h1>

              {/* Floating Chat Input Card */}
              <div className="w-full z-10">
                <ChatCard
                  onSendMessage={handleSendMessage}
                  isExecuting={isExecuting}
                  onAbort={handleAbort}
                  project={currentProject}
                  onProjectChange={setCurrentProject}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {/* Scrollable Message Stream with @const/ui ScrollArea */}
            <ScrollArea className="flex-1 w-full h-full [&>div>div[style]]:!block">
              <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
                {messages.map((msg, idx) => (
                  <div key={msg.id} className="w-full flex flex-col">
                    {msg.role === "user" ? (
                      <div className="w-full flex justify-end">
                        <div className="max-w-2xl rounded-2xl bg-[#222222] border border-[#383838] px-4 py-3 text-[14px] text-[#ececec] select-text leading-relaxed whitespace-pre-wrap shadow-sm">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-2.5 max-w-3xl">
                        {/* Execution Trace (Worked for, Thinking, Tool calls, File diffs +X -Y) */}
                        <ExecutionTrace
                          thinking={msg.thinking}
                          toolCalls={msg.toolCalls}
                          mutations={msg.mutations}
                          isExecuting={isExecuting && idx === messages.length - 1}
                          onRollback={handleRollback}
                        />

                        {/* Formatted Markdown Content */}
                        {msg.content ? (
                          <div className="px-0.5">
                            <MarkdownContent content={msg.content} />
                          </div>
                        ) : isExecuting && idx === messages.length - 1 ? (
                          <div className="flex items-center gap-2 text-xs text-[#888888] px-1 py-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff7a00]" />
                            <span>Working on task...</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Anchored Bottom Chat Input (No dividing line!) */}
            <div className="w-full px-4 sm:px-8 pb-4 pt-2 flex justify-center bg-[#161616] shrink-0">
              <div className="w-full max-w-3xl">
                <ChatCard
                  compact
                  isExecuting={isExecuting}
                  onSendMessage={handleSendMessage}
                  onAbort={handleAbort}
                  project={currentProject}
                  onProjectChange={setCurrentProject}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_harness_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to localhost:3001 in local dev, accounts.const.web.id in production
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) ||
    (typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
      ? "https://accounts.const.web.id"
      : "http://localhost:3001");

  // Listen for deep link callback in Electron or browser redirect
  useEffect(() => {
    // 1. Electron deep-link listener
    if (window.electron?.onAuthCallback) {
      const unsubscribe = window.electron.onAuthCallback(
        (data: { url: string; token?: string }) => {
          if (data.token) {
            localStorage.setItem("const_harness_auth_token", data.token);
            setToken(data.token);
            setIsWaitingAuth(false);
          }
        }
      );
      return () => unsubscribe();
    }

    // 2. Storage event listener (sync across windows or tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_harness_auth_token" && e.newValue) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Browser query param fallback (if tested in browser)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken) {
      localStorage.setItem("const_harness_auth_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Poll localStorage while waiting for authentication
  useEffect(() => {
    if (!isWaitingAuth) return;
    const interval = setInterval(() => {
      const saved = localStorage.getItem("const_harness_auth_token");
      if (saved) {
        setToken(saved);
        setIsWaitingAuth(false);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isWaitingAuth]);

  const handleSignIn = async () => {
    const continueTarget = window.electron?.openExternal
      ? "const-harness://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account`;
    setIsWaitingAuth(true);

    if (window.electron?.openExternal) {
      await window.electron.openExternal(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_harness_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  const handleSwitchAccount = async () => {
    localStorage.removeItem("const_harness_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(true);

    const continueTarget = window.electron?.openExternal
      ? "const-harness://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account`;

    if (window.electron?.openExternal) {
      await window.electron.openExternal(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  };

  // -------------------------------------------------------------
  // 1. Authenticated View: Sidebar + Left-Rounded Canvas
  // -------------------------------------------------------------
  if (token) {
    return (
      <ConvexClientProvider token={token} signOut={handleSignOut}>
        <AuthenticatedContent
          onSignOut={handleSignOut}
          onSwitchAccount={handleSwitchAccount}
        />
      </ConvexClientProvider>
    );
  }

  // -------------------------------------------------------------
  // 2. Unauthenticated View: Redesigned Split Login Page with @const/ui
  // -------------------------------------------------------------
  return (
    <div className="h-screen max-h-screen w-full overflow-hidden flex bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left Column: Sign-in Card */}
      <div className="flex h-full w-full flex-col justify-between p-6 sm:p-8 lg:p-10 lg:w-1/2 overflow-hidden">
        {/* Brand Mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ConstLogoIcon size="sm" className="w-6 h-6 text-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-normal tracking-tight text-foreground">
              Const
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Harness
            </span>
          </div>
        </div>

        {/* Center: Sign in content */}
        <div className="my-auto mx-auto w-full max-w-sm shrink-0 py-2">
          <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Sign in to Const Harness.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in to start building and debugging with native AI agents — no complex setup required.
          </p>

          <div className="mt-8 space-y-4">
            <Button
              onClick={handleSignIn}
              size="lg"
              className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4" />
              {isWaitingAuth ? "Return to Login Tab" : "Sign in to Const Harness"}
            </Button>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>English</span>
          </div>
          <span>© 2026 Const · All rights reserved.</span>
        </div>
      </div>

      {/* Right Column: Artwork image (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 h-full p-4 overflow-hidden items-center justify-center">
        <div className="relative h-full w-full max-h-full overflow-hidden rounded-3xl border border-border shadow-inner">
          <img
            src={authArt}
            alt="Const Harness Art"
            className="h-full w-full object-cover select-none"
          />
        </div>
      </div>
    </div>
  );
}
