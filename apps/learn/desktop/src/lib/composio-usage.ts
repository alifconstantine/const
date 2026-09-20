/**
 * Composio MCP Tool Call Usage & Weekly Rate Limiter for Const Learn.
 * Enforces a strict weekly limit of 300 tool calls per user,
 * resetting every week on Monday at 00:00:00 UTC.
 */

export const WEEKLY_TOOL_CALL_LIMIT = 300;

export interface ComposioCallRecord {
  id: string;
  toolSlug: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface ComposioUsageRecord {
  limit: number;
  used: number;
  remaining: number;
  windowStart: number; // Start of current week (Monday 00:00:00 UTC)
  resetAt: number; // End of current week (Next Monday 00:00:00 UTC)
  lastUsedAt?: number;
  byTool: Record<string, number>;
  recentCalls: ComposioCallRecord[];
}

/**
 * Calculates the start timestamp of the current week (Monday 00:00:00 UTC).
 */
export function getWeekWindowStart(date = new Date()): number {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(d.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Calculates the reset timestamp (next Monday 00:00:00 UTC).
 */
export function getNextResetTimestamp(windowStart: number): number {
  return windowStart + 7 * 24 * 60 * 60 * 1000;
}

/**
 * Categorizes a tool slug into a friendly service name.
 */
export function categorizeComposioTool(toolSlug: string): "canva" | "sandbox" | "google" | "youtube" | "other" {
  const slug = (toolSlug || "").toUpperCase();
  if (slug.includes("CANVA")) return "canva";
  if (slug.includes("CODEINTERPRETER") || slug.includes("SANDBOX") || slug.includes("PYTHON")) return "sandbox";
  if (slug.includes("GOOGLE") || slug.includes("GMAIL") || slug.includes("DRIVE") || slug.includes("DOCS") || slug.includes("SLIDES") || slug.includes("SHEETS") || slug.includes("FORMS")) return "google";
  if (slug.includes("YOUTUBE")) return "youtube";
  return "other";
}

const STORAGE_KEY_PREFIX = "const_composio_usage_v1";

export function getUsageStorageKey(userId?: string): string {
  const cleanId = (userId || "default_user").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${STORAGE_KEY_PREFIX}_${cleanId}`;
}

/**
 * Retrieves the current week usage record from localStorage or initializes a new one.
 */
export function getStoredComposioUsage(userId?: string): ComposioUsageRecord {
  const now = Date.now();
  const currentWindowStart = getWeekWindowStart();
  const currentResetAt = getNextResetTimestamp(currentWindowStart);

  const defaultRecord: ComposioUsageRecord = {
    limit: WEEKLY_TOOL_CALL_LIMIT,
    used: 0,
    remaining: WEEKLY_TOOL_CALL_LIMIT,
    windowStart: currentWindowStart,
    resetAt: currentResetAt,
    byTool: {},
    recentCalls: [],
  };

  if (typeof window === "undefined") {
    return defaultRecord;
  }

  try {
    const key = getUsageStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: ComposioUsageRecord = JSON.parse(raw);
      // Check if weekly window has passed (auto-reset)
      if (!parsed.windowStart || now >= parsed.resetAt || parsed.windowStart < currentWindowStart) {
        // Window expired, auto-reset
        saveComposioUsage(defaultRecord, userId);
        return defaultRecord;
      }

      return {
        ...defaultRecord,
        ...parsed,
        limit: WEEKLY_TOOL_CALL_LIMIT,
        remaining: Math.max(0, WEEKLY_TOOL_CALL_LIMIT - (parsed.used || 0)),
      };
    }
  } catch {}

  saveComposioUsage(defaultRecord, userId);
  return defaultRecord;
}

/**
 * Saves usage record to localStorage and broadcasts live event.
 */
export function saveComposioUsage(record: ComposioUsageRecord, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getUsageStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("composio_usage_changed", { detail: record }));
  } catch {}
}

/**
 * Checks if a user is permitted to execute a Composio tool call.
 */
export function checkComposioLimit(userId?: string): {
  allowed: boolean;
  used: number;
  remaining: number;
  resetAt: number;
  message?: string;
} {
  const usage = getStoredComposioUsage(userId);
  if (usage.used >= usage.limit) {
    const resetDate = new Date(usage.resetAt).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    return {
      allowed: false,
      used: usage.used,
      remaining: 0,
      resetAt: usage.resetAt,
      message: `Batas mingguan 300 tool call Composio telah tercapai. Kuota Anda akan di-reset otomatis pada ${resetDate}.`,
    };
  }

  return {
    allowed: true,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
  };
}

/**
 * Increments usage count, updates tool breakdown, and adds to recent call history.
 */
export function recordComposioToolCall(
  toolSlug: string,
  success: boolean,
  userId?: string,
  error?: string
): ComposioUsageRecord {
  const current = getStoredComposioUsage(userId);
  const now = Date.now();

  const newUsed = current.used + 1;
  const newRemaining = Math.max(0, current.limit - newUsed);

  const updatedByTool = { ...current.byTool };
  updatedByTool[toolSlug] = (updatedByTool[toolSlug] || 0) + 1;

  const newCall: ComposioCallRecord = {
    id: `call_${now}_${Math.random().toString(36).substring(2, 7)}`,
    toolSlug,
    timestamp: now,
    success,
    error,
  };

  // Keep last 30 calls in history
  const updatedRecent = [newCall, ...(current.recentCalls || [])].slice(0, 30);

  const updated: ComposioUsageRecord = {
    ...current,
    used: newUsed,
    remaining: newRemaining,
    lastUsedAt: now,
    byTool: updatedByTool,
    recentCalls: updatedRecent,
  };

  saveComposioUsage(updated, userId);
  return updated;
}

/**
 * Formats time remaining until weekly reset.
 */
export function getResetCountdown(resetAt: number): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
} {
  const now = Date.now();
  const diff = Math.max(0, resetAt - now);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  let formatted = "";
  if (days > 0) {
    formatted = `${days} hari ${hours} jam`;
  } else if (hours > 0) {
    formatted = `${hours} jam ${minutes} mnt`;
  } else {
    formatted = `${minutes} menit`;
  }

  return { days, hours, minutes, formatted };
}
