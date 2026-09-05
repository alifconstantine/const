export interface ConversationItem {
  id: string;
  title: string;
  project: string; // Folder name or "Outside Project"
  createdAt: number;
  updatedAt: number;
  messages: any[];
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

/**
 * Load all stored conversations, ordered by updatedAt descending.
 */
export function loadConversations(): ConversationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ConversationItem[] = JSON.parse(raw);
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
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
    if (index >= 0) {
      list[index] = { ...conversation, updatedAt: Date.now() };
    } else {
      list.unshift({ ...conversation, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Generates an instant high-quality fallback title from user prompt.
 * e.g. "remote kan ke sini https://github.com..." -> "Remote kan ke sini"
 * or "buat folder baru dan buat navbar" -> "Buat folder baru dan buat navbar"
 */
export function generateFallbackTitle(prompt: string): string {
  if (!prompt || !prompt.trim()) return "New Task";

  // Remove URLs, leading markdown characters, extra spaces
  let cleaned = prompt
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/^[@#/\\*`~>\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "New Task";

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Maximum 36 characters
  if (cleaned.length <= 36) {
    return cleaned;
  }

  // Slice cleanly at nearest word boundary
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
  onGenerated?: (title: string) => void
): Promise<string> {
  const fallback = generateFallbackTitle(prompt);

  // If electron generateTitle is available, call lightweight completion
  if (typeof window !== "undefined" && window.electron?.generateTitle) {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
      const requestPromise = window.electron.generateTitle(prompt);

      const title = await Promise.race([requestPromise, timeoutPromise]);
      if (title && typeof title === "string" && title.length > 0 && title.length <= 48) {
        onGenerated?.(title);
        return title;
      }
    } catch {
      // ignore, use fallback
    }
  }

  onGenerated?.(fallback);
  return fallback;
}

/**
 * Formats relative time matching the UI format in Image 2: "3d", "19d", "2h", "just now"
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
  return "just now";
}
