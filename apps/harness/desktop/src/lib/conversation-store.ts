import { shiftIntelligenceUiState } from "../components/intelligence-ui/protocol";

export interface ConversationItem {
  id: string;
  title: string;
  project: string; // Folder name or "Outside Project"
  createdAt: number;
  updatedAt: number;
  messages: any[];
  isPinned?: boolean;
  isArchived?: boolean;
  isScheduled?: boolean;
  model?: string;
  mode?: "request_review" | "ask_before_changes" | "full_access";
  contextUsage?: {
    usedTokens: number;
    totalTokens: number;
    systemPromptTokens?: number;
    toolsTokens?: number;
    messagesTokens?: number;
  };
  diffStats?: {
    additions: number;
    deletions: number;
  };
}

export function getDefaultAgentMode(): "request_review" | "ask_before_changes" | "full_access" {
  try {
    const saved = localStorage.getItem("const_harness_default_mode");
    if (saved === "request_review" || saved === "full_access" || saved === "ask_before_changes") {
      return saved;
    }
  } catch {}
  return "ask_before_changes";
}

export function getCleanConversationTitle(title?: string): string {
  if (!title) return "Untitled task";
  return title.replace(/^\[Scheduled\]\s*/i, "");
}

export function isScheduledTaskConversation(convo?: {
  id?: string;
  title?: string;
  isScheduled?: boolean;
}): boolean {
  if (!convo) return false;
  if (convo.isScheduled) return true;
  if (convo.id && convo.id.startsWith("scheduled_")) return true;
  if (convo.title && convo.title.startsWith("[Scheduled]")) return true;
  return false;
}

export function isSideChatConversation(convo?: { id?: string } | string | null): boolean {
  if (!convo) return false;
  const id = typeof convo === "string" ? convo : convo.id;
  if (!id) return false;
  return id.startsWith("side_conversation_") || id.startsWith("side_chat_");
}

export function normalizeUiMessages(rawMessages: any[]): any[] {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return [];
  rawMessages = rawMessages.filter(message => !message?.toolObservationId);

  const hasToolRole = rawMessages.some((m) => m && m.role === "tool");
  if (!hasToolRole) {
    return rawMessages;
  }

  const normalized: any[] = [];
  let currentAssistant: any = null;

  for (let i = 0; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    if (!msg) continue;

    if (msg.role === "user") {
      if (currentAssistant) {
        normalized.push(currentAssistant);
        currentAssistant = null;
      }
      normalized.push(msg);
    } else if (msg.role === "assistant") {
      if (!currentAssistant) {
        currentAssistant = {
          id: msg.id || `msg_${msg.timestamp || Date.now()}_assistant`,
          role: "assistant",
          content: msg.content || "",
          thinking: msg.thinking || "",
          traceSteps: Array.isArray(msg.traceSteps) ? [...msg.traceSteps] : [],
          toolCalls: Array.isArray(msg.toolCalls) ? [...msg.toolCalls] : [],
          mutations: Array.isArray(msg.mutations) ? [...msg.mutations] : [],
          durationMs: msg.durationMs,
          intelligenceUiState: msg.intelligenceUiState,
          timestamp: msg.timestamp || msg.createdAt || Date.now(),
        };
      } else {
        if (msg.content) {
          if (msg.intelligenceUiState) {
            const offset = currentAssistant.content ? currentAssistant.content.length + 2 : 0;
            currentAssistant.intelligenceUiState = {
              ...currentAssistant.intelligenceUiState,
              ...shiftIntelligenceUiState(msg.intelligenceUiState, offset),
            };
          }
          currentAssistant.content = currentAssistant.content
            ? `${currentAssistant.content}\n\n${msg.content}`
            : msg.content;
        }
        if (msg.thinking) {
          currentAssistant.thinking = (currentAssistant.thinking || "") + msg.thinking;
        }
        if (Array.isArray(msg.traceSteps)) {
          currentAssistant.traceSteps.push(...msg.traceSteps);
        }
        if (msg.durationMs) {
          currentAssistant.durationMs = (currentAssistant.durationMs || 0) + msg.durationMs;
        }
      }

      // Handle raw assistant tool_calls from LLM API format
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const fn = tc.function || tc;
          const callId = tc.id || `call_${Date.now()}`;
          let parsedArgs = fn.arguments;
          try {
            if (typeof parsedArgs === "string") parsedArgs = JSON.parse(parsedArgs);
          } catch {}
          currentAssistant.toolCalls.push({
            id: callId,
            name: fn.name || "tool",
            args: parsedArgs,
          });
          currentAssistant.traceSteps.push({
            id: callId,
            type: "tool",
            toolCallId: callId,
            name: fn.name || "tool",
            args: parsedArgs,
          });
        }
      }
    } else if (msg.role === "tool") {
      // Raw tool result message -> attach to current assistant's traceSteps
      if (!currentAssistant) {
        currentAssistant = {
          id: `msg_${msg.timestamp || Date.now()}_assistant`,
          role: "assistant",
          content: "",
          thinking: "",
          traceSteps: [],
          toolCalls: [],
          mutations: [],
          timestamp: msg.timestamp || msg.createdAt || Date.now(),
        };
      }
      const toolId = msg.tool_call_id || msg.id;
      const existingStep = currentAssistant.traceSteps.find(
        (st: any) => st.type === "tool" && (st.toolCallId === toolId || st.id === toolId)
      );
      if (existingStep) {
        existingStep.result = msg.content;
      } else {
        currentAssistant.traceSteps.push({
          id: toolId || `tool_${Date.now()}_${currentAssistant.traceSteps.length}`,
          type: "tool",
          toolCallId: toolId,
          name: msg.name || "tool",
          result: msg.content,
        });
      }
      const existingCall = currentAssistant.toolCalls.find((tc: any) => tc.id === toolId);
      if (existingCall) {
        existingCall.result = msg.content;
      }
    }
  }

  if (currentAssistant) {
    normalized.push(currentAssistant);
  }

  return normalized;
}

const STORAGE_KEY = "const_harness_conversations";
let cachedConversations: ConversationItem[] | null = null;

/**
 * Load all stored active conversations, ordered by updatedAt descending.
 * Synchronous from memory/localStorage cache for instant React rendering.
 */
export function loadConversations(): ConversationItem[] {
  const normalize = (c: ConversationItem): ConversationItem => ({
    ...c,
    title: getCleanConversationTitle(c.title),
    isScheduled: isScheduledTaskConversation(c),
    mode: c.mode,
    messages: normalizeUiMessages(c.messages || []),
  });

  const sortFn = (a: ConversationItem, b: ConversationItem) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  };

  if (cachedConversations) {
    return cachedConversations
      .filter((c) => !c.isArchived && !isSideChatConversation(c.id))
      .map(normalize)
      .sort(sortFn);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ConversationItem[] = JSON.parse(raw);
    cachedConversations = parsed
      .filter((c) => !isSideChatConversation(c.id))
      .map(normalize)
      .sort(sortFn);
    return cachedConversations.filter((c) => !c.isArchived);
  } catch {
    return [];
  }
}

/**
 * Initialize store and sync from disk SQLite.
 * Migrates localStorage to SQLite if needed.
 */
export async function initConversationStore(): Promise<ConversationItem[]> {
  try {
    // 1. Check if Electron disk database is available
    if (typeof window !== "undefined" && window.electron?.listConversations) {
      // Check if we need to migrate local storage to SQLite
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && window.electron.importLegacyConversations) {
        try {
          const localList: ConversationItem[] = JSON.parse(raw);
          if (Array.isArray(localList) && localList.length > 0) {
            const cleanList = localList.filter((c) => !isSideChatConversation(c.id));
            if (cleanList.length > 0) {
              await window.electron.importLegacyConversations(cleanList);
            }
          }
        } catch (e) {
          console.warn("[ConversationStore] Legacy migration error:", e);
        }
      }

      // Load fresh list from SQLite disk database
      const diskList = await window.electron.listConversations(false);
      if (Array.isArray(diskList)) {
        const normalized = diskList
          .filter((c) => !isSideChatConversation(c.id))
          .map((c) => ({
            ...c,
            title: getCleanConversationTitle(c.title),
            isScheduled: isScheduledTaskConversation(c),
            messages: normalizeUiMessages(c.messages || []),
          }));
        cachedConversations = normalized;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch (err) {
    console.warn("[ConversationStore] Failed to initialize from SQLite, using cache:", err);
  }
  return loadConversations();
}

/**
 * Refresh store directly from SQLite database.
 */
export async function refreshConversationsFromDisk(): Promise<ConversationItem[]> {
  if (typeof window !== "undefined" && window.electron?.listConversations) {
    try {
      const diskList = await window.electron.listConversations(false);
      if (Array.isArray(diskList)) {
        const normalized = diskList
          .filter((c) => !isSideChatConversation(c.id))
          .map((c) => ({
            ...c,
            title: getCleanConversationTitle(c.title),
            isScheduled: isScheduledTaskConversation(c),
            messages: normalizeUiMessages(c.messages || []),
          }));
        cachedConversations = normalized;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (err) {
      console.warn("[ConversationStore] Disk refresh error:", err);
    }
  }
  return loadConversations();
}

/**
 * Load archived conversations.
 */
export async function loadArchivedConversations(): Promise<ConversationItem[]> {
  if (typeof window !== "undefined" && window.electron?.listArchivedConversations) {
    try {
      const archived = await window.electron.listArchivedConversations();
      if (Array.isArray(archived)) return archived;
    } catch (e) {
      console.warn("[ConversationStore] Error loading archived from disk:", e);
    }
  }
  // Fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: ConversationItem[] = JSON.parse(raw);
    return list.filter((c) => c.isArchived);
  } catch {
    return [];
  }
}

/**
 * Save or update a conversation.
 */
export function saveConversation(conversation: ConversationItem): void {
  if (!conversation?.id || isSideChatConversation(conversation.id)) {
    return;
  }
  try {
    const list = loadConversations();
    const index = list.findIndex((c) => c.id === conversation.id);
    const updatedConvo = { ...conversation, updatedAt: Date.now() };

    if (index >= 0) {
      list[index] = updatedConvo;
    } else {
      list.unshift(updatedConvo);
    }
    cachedConversations = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Persist asynchronously to SQLite disk database
    if (typeof window !== "undefined" && window.electron?.saveConversation) {
      window.electron.saveConversation(updatedConvo).catch((err) => {
        console.warn("[ConversationStore] Failed to save conversation to disk:", err);
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Delete a conversation by ID.
 */
export function deleteConversation(id: string): void {
  try {
    const list = loadConversations().filter((c) => c.id !== id);
    cachedConversations = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Delete from SQLite disk database
    if (typeof window !== "undefined" && window.electron?.deleteConversation) {
      window.electron.deleteConversation(id).catch((err) => {
        console.warn("[ConversationStore] Failed to delete from disk:", err);
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Rename a conversation.
 */
export function renameConversation(id: string, title: string): void {
  try {
    const list = loadConversations();
    const item = list.find((c) => c.id === id);
    if (item) {
      item.title = title;
      item.updatedAt = Date.now();
      cachedConversations = list;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    if (typeof window !== "undefined" && window.electron?.renameConversation) {
      window.electron.renameConversation(id, title).catch((err) => {
        console.warn("[ConversationStore] Failed to rename on disk:", err);
      });
    }
  } catch {}
}

/**
 * Archive a conversation.
 */
export function archiveConversation(id: string): void {
  try {
    const list = loadConversations();
    const item = list.find((c) => c.id === id);
    if (item) {
      item.isArchived = true;
      item.updatedAt = Date.now();
      cachedConversations = list.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    if (typeof window !== "undefined" && window.electron?.archiveConversation) {
      window.electron.archiveConversation(id).catch((err) => {
        console.warn("[ConversationStore] Failed to archive on disk:", err);
      });
    }
  } catch {}
}

/**
 * Unarchive a conversation.
 */
export async function unarchiveConversation(id: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.electron?.unarchiveConversation) {
      await window.electron.unarchiveConversation(id);
      await refreshConversationsFromDisk();
      return;
    }
    // Fallback
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list: ConversationItem[] = JSON.parse(raw);
      const target = list.find((c) => c.id === id);
      if (target) {
        target.isArchived = false;
        target.updatedAt = Date.now();
        cachedConversations = list;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch {}
}

/**
 * Pin or unpin a conversation/task.
 */
export async function pinConversation(id: string, isPinned: boolean): Promise<void> {
  try {
    const list = loadConversations();
    const item = list.find((c) => c.id === id);
    if (item) {
      item.isPinned = isPinned;
      item.updatedAt = Date.now();
      cachedConversations = list;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    if (typeof window !== "undefined" && window.electron?.pinConversation) {
      await window.electron.pinConversation(id, isPinned);
    }
  } catch (err) {
    console.warn("[ConversationStore] Failed to pin conversation:", err);
  }
}

/**
 * Pin or unpin a project.
 */
export async function setProjectPinned(projectName: string, isPinned: boolean): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.electron?.pinProject) {
      await window.electron.pinProject(projectName, isPinned);
    }
  } catch {}
}

/**
 * Get pinned projects from SQLite disk.
 */
export async function getPinnedProjects(): Promise<string[]> {
  try {
    if (typeof window !== "undefined" && window.electron?.getProjectPins) {
      const pins = await window.electron.getProjectPins();
      if (Array.isArray(pins)) return pins;
    }
  } catch {}
  return [];
}

/**
 * Generates an instant high-quality fallback title from user prompt.
 */
export function generateFallbackTitle(prompt: string): string {
  if (!prompt || !prompt.trim()) return "New Task";

  let cleaned = prompt
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/^[@#/\\*`~>\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "New Task";

  const firstLine = (cleaned.split("\n")[0] || "").trim();
  if (firstLine.length <= 120) {
    return firstLine;
  }
  return firstLine.slice(0, 120).trim();
}

/**
 * Generates a concise 3-5 word AI title with fallback.
 * Returns fallback immediately for instant UI responsiveness,
 * and asynchronously calls onGenerated when AI generates the title.
 */
export async function generateAiTitle(
  prompt: string,
  onGenerated?: (title: string) => void,
  authToken?: string,
  model?: string
): Promise<string> {
  const fallback = generateFallbackTitle(prompt);

  if (typeof window !== "undefined" && window.electron?.generateTitle) {
    // Non-blocking asynchronous AI refinement
    window.electron
      .generateTitle(prompt, authToken, model)
      .then((aiTitle) => {
        if (
          aiTitle &&
          typeof aiTitle === "string" &&
          aiTitle.trim().length > 0 &&
          aiTitle.trim().length <= 100
        ) {
          onGenerated?.(aiTitle.trim());
        }
      })
      .catch((err) => {
        console.warn("[ConversationStore] Background AI title generation error:", err);
      });
  }

  return fallback;
}

/**
 * Formats relative time matching the UI format: "3d", "19d", "2h", "just now"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return "now";
}

export interface SideConversationItem {
  id: string;
  parentConversationId: string;
  title: string;
  project: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  model?: string;
  thinkingLevel?: string;
  mode?: "request_review" | "ask_before_changes" | "full_access";
}

const SIDE_STORAGE_PREFIX = "const_harness_side_chat_";

export function loadSideConversations(parentConversationId: string): SideConversationItem[] {
  if (!parentConversationId) return [];
  try {
    const raw = localStorage.getItem(`${SIDE_STORAGE_PREFIX}${parentConversationId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function loadSideConversation(
  parentConversationId: string,
  sideId: string
): SideConversationItem | null {
  const list = loadSideConversations(parentConversationId);
  return list.find((c) => c.id === sideId) || null;
}

export function saveSideConversation(sideConvo: SideConversationItem): void {
  if (!sideConvo.parentConversationId) return;
  try {
    const list = loadSideConversations(sideConvo.parentConversationId);
    const idx = list.findIndex((c) => c.id === sideConvo.id);
    const updated = { ...sideConvo, updatedAt: Date.now() };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    localStorage.setItem(
      `${SIDE_STORAGE_PREFIX}${sideConvo.parentConversationId}`,
      JSON.stringify(list)
    );
  } catch (err) {
    console.warn("[ConversationStore] Failed to save side conversation:", err);
  }
}

export function deleteSideConversation(parentConversationId: string, sideId: string): void {
  if (!parentConversationId) return;
  try {
    const list = loadSideConversations(parentConversationId).filter((c) => c.id !== sideId);
    localStorage.setItem(
      `${SIDE_STORAGE_PREFIX}${parentConversationId}`,
      JSON.stringify(list)
    );
  } catch {}
}

