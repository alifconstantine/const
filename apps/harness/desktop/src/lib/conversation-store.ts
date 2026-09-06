export interface ConversationItem {
  id: string;
  title: string;
  project: string; // Folder name or "Outside Project"
  createdAt: number;
  updatedAt: number;
  messages: any[];
  isPinned?: boolean;
  isArchived?: boolean;
  model?: string;
  contextUsage?: {
    usedTokens: number;
    totalTokens: number;
  };
  diffStats?: {
    additions: number;
    deletions: number;
  };
}

const STORAGE_KEY = "const_harness_conversations";
let cachedConversations: ConversationItem[] | null = null;

/**
 * Load all stored active conversations, ordered by updatedAt descending.
 * Synchronous from memory/localStorage cache for instant React rendering.
 */
export function loadConversations(): ConversationItem[] {
  if (cachedConversations) {
    return cachedConversations.filter((c) => !c.isArchived);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ConversationItem[] = JSON.parse(raw);
    cachedConversations = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
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
            await window.electron.importLegacyConversations(localList);
          }
        } catch (e) {
          console.warn("[ConversationStore] Legacy migration error:", e);
        }
      }

      // Load fresh list from SQLite disk database
      const diskList = await window.electron.listConversations(false);
      if (Array.isArray(diskList)) {
        cachedConversations = diskList;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(diskList));
        return diskList;
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
        cachedConversations = diskList;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(diskList));
        return diskList;
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

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  if (cleaned.length <= 36) {
    return cleaned;
  }

  const words = cleaned.slice(0, 36).trim().split(" ");
  if (words.length > 1) {
    words.pop();
    return words.join(" ") + "...";
  }
  return cleaned.slice(0, 36) + "...";
}

/**
 * Generates a concise 3-5 word AI title with fallback.
 */
export async function generateAiTitle(
  prompt: string,
  onGenerated?: (title: string) => void,
  authToken?: string
): Promise<string> {
  const fallback = generateFallbackTitle(prompt);

  if (typeof window !== "undefined" && window.electron?.generateTitle) {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
      const requestPromise = window.electron.generateTitle(prompt, authToken);

      const title = await Promise.race([requestPromise, timeoutPromise]);
      if (title && typeof title === "string" && title.length > 0 && title.length <= 48) {
        onGenerated?.(title);
        return title;
      }
    } catch {}
  }

  onGenerated?.(fallback);
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
