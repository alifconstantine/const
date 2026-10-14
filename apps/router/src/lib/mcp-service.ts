import fs from "node:fs";
import path from "node:path";

export interface McpUsageRecord {
  count: number;
  resetDate: string;
  calls: Array<{
    tool: string;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
}

export interface McpUsageStore {
  [userId: string]: McpUsageRecord;
}

const WEEKLY_TOOL_LIMIT = 300;
const USAGE_FILE = path.join(process.cwd(), ".mcp-usage.json");

// In-memory cache for speed and hot lambda reuse
let usageCache: McpUsageStore | null = null;
const sessionCache = new Map<string, { sessionId: string; expiresAt: number }>();

function loadUsageStore(): McpUsageStore {
  if (usageCache) return usageCache;
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const data = fs.readFileSync(USAGE_FILE, "utf-8");
      usageCache = JSON.parse(data);
      return usageCache || {};
    }
  } catch (err) {
    console.warn("[MCP Service] Failed to load usage file, initializing fresh store:", err);
  }
  usageCache = {};
  return usageCache;
}

function saveUsageStore(store: McpUsageStore) {
  usageCache = store;
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    // In read-only serverless environments, in-memory cache remains active
    console.warn("[MCP Service] Could not write usage file, using in-memory store:", err);
  }
}

/**
 * Returns Composio API Key from environment.
 */
export function getComposioApiKey(): string {
  const raw =
    process.env.COMPOSIO_API_KEY ||
    process.env.VITE_COMPOSIO_API_KEY ||
    "";
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * Checks if the user is allowed to make an MCP tool call within weekly 300-call quota.
 */
export function checkMcpLimit(userId: string = "learn_default_user"): {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetDate: string;
  message?: string;
} {
  const store = loadUsageStore();
  const now = Date.now();
  const userUsage = store[userId];

  // If no record or reset date passed, reset window
  if (!userUsage || now > new Date(userUsage.resetDate).getTime()) {
    const nextReset = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    store[userId] = {
      count: 0,
      resetDate: nextReset,
      calls: [],
    };
    saveUsageStore(store);
    return {
      allowed: true,
      count: 0,
      limit: WEEKLY_TOOL_LIMIT,
      remaining: WEEKLY_TOOL_LIMIT,
      resetDate: nextReset,
    };
  }

  const remaining = Math.max(0, WEEKLY_TOOL_LIMIT - userUsage.count);
  const allowed = userUsage.count < WEEKLY_TOOL_LIMIT;

  return {
    allowed,
    count: userUsage.count,
    limit: WEEKLY_TOOL_LIMIT,
    remaining,
    resetDate: userUsage.resetDate,
    message: allowed
      ? undefined
      : `Batas mingguan 300 tool call MCP telah tercapai. Kuota Anda akan di-reset otomatis pada ${new Date(
          userUsage.resetDate
        ).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
  };
}

/**
 * Records an executed MCP tool call for rate-limiting analytics.
 */
export function recordMcpToolCall(
  toolSlug: string,
  success: boolean,
  userId: string = "learn_default_user",
  error?: string
) {
  const store = loadUsageStore();
  const now = Date.now();
  let userUsage = store[userId];

  if (!userUsage || now > new Date(userUsage.resetDate).getTime()) {
    const nextReset = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    userUsage = {
      count: 0,
      resetDate: nextReset,
      calls: [],
    };
  }

  userUsage.count += 1;
  userUsage.calls.unshift({
    tool: toolSlug,
    timestamp: now,
    success,
    error,
  });

  // Keep last 50 calls per user to prevent unbounded growth
  if (userUsage.calls.length > 50) {
    userUsage.calls = userUsage.calls.slice(0, 50);
  }

  store[userId] = userUsage;
  saveUsageStore(store);
}

const authConfigCache = new Map<string, string>();

/**
 * Gets or creates the Composio Auth Config ID for a given toolkit without requiring session permissions.
 */
export async function getOrCreateAuthConfigId(
  toolkitSlug: string,
  apiKey: string
): Promise<string> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "").trim();
  const norm = normalizeToolkitSlug(toolkitSlug);
  if (authConfigCache.has(norm)) {
    return authConfigCache.get(norm)!;
  }

  // 1. Check existing auth_configs
  try {
    const listRes = await fetch("https://backend.composio.dev/api/v3.1/auth_configs", {
      headers: { "x-api-key": cleanKey },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const match = listData.items?.find((item: any) => {
        const itemSlug = (item.toolkit?.slug || item.toolkit || "").toLowerCase().replace(/[-_]/g, "");
        const cleanNorm = norm.replace(/[-_]/g, "");
        return (
          itemSlug === cleanNorm ||
          cleanNorm.startsWith(itemSlug) ||
          itemSlug.startsWith(cleanNorm) ||
          item.name?.toLowerCase().includes(cleanNorm)
        );
      });
      if (match?.id) {
        authConfigCache.set(norm, match.id);
        return match.id;
      }
    } else {
      const errTxt = await listRes.text().catch(() => "");
      console.warn(`[getOrCreateAuthConfigId] list failed (${listRes.status}):`, errTxt);
    }
  } catch (err) {
    console.warn("[getOrCreateAuthConfigId] list failed:", err);
  }

  // 2. Create / retrieve managed auth_config for this toolkit
  const authScheme = norm.includes("canva") ? "DCR_OAUTH" : "OAUTH2";
  const createRes = await fetch("https://backend.composio.dev/api/v3.1/auth_configs", {
    method: "POST",
    headers: {
      "x-api-key": cleanKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolkit: { slug: norm },
      auth_scheme: authScheme,
    }),
  });

  if (createRes.ok) {
    const createData = await createRes.json();
    const acId = createData.auth_config?.id || createData.id;
    if (acId) {
      authConfigCache.set(norm, acId);
      return acId;
    }
  }

  const errText = await createRes.text().catch(() => "");
  throw new Error(
    `Failed to resolve auth_config for toolkit: ${toolkitSlug} (${createRes.status}): ${errText || "Check Composio API permissions"}`
  );
}

/**
 * Standardizes toolkit slugs for OAuth links (e.g. google-sheets -> googlesheets, canva -> canva_mcp).
 */
export function normalizeToolkitSlug(rawToolkit: string): string {
  const clean = (rawToolkit || "").toLowerCase().trim();
  const noDashes = clean.replace(/[-_]/g, "");

  if (noDashes.includes("canva")) {
    return "canva_mcp";
  }
  if (noDashes.startsWith("google") && !noDashes.includes("workspace")) {
    return noDashes;
  }
  if (noDashes.includes("youtube")) {
    return "youtube";
  }
  if (noDashes.includes("github")) {
    return "github";
  }
  return clean;
}

/**
 * Standardizes tool slug mapping between agent aliases and official Composio slugs.
 */
export function normalizeToolSlug(rawSlug: string): string {
  const norm = rawSlug.trim();
  const lower = norm.toLowerCase().replace(/[-_]/g, "");

  // Code interpreter / Sandbox
  if (lower.includes("codeinterpreter") || lower.includes("cloudsandbox") || lower === "runpython") {
    return "CODEINTERPRETER_EXECUTE_CODE";
  }

  // Canva MCP
  if (lower.includes("canva") && lower.includes("candidate")) {
    return "CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE";
  }
  if (lower.includes("canva") && lower.includes("export")) {
    return "CANVA_MCP_EXPORT_DESIGN";
  }
  if (lower.includes("canva")) {
    return "CANVA_MCP_GENERATE_DESIGN";
  }

  // Google Sheets
  if (lower.includes("sheet")) {
    return "GOOGLESHEETS_CREATE_SPREADSHEET";
  }

  // Google Docs
  if (lower.includes("doc")) {
    return "GOOGLEDOCS_CREATE_DOCUMENT";
  }

  // Google Slides
  if (lower.includes("slide")) {
    return "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN";
  }

  // Google Drive
  if (lower.includes("drive")) {
    return "GOOGLEDRIVE_SEARCH_FILES_OR_FOLDERS";
  }

  // Google Tasks
  if (lower.includes("task")) {
    return "GOOGLETASKS_INSERT_TASK";
  }

  // Google Forms
  if (lower.includes("form")) {
    return "GOOGLEFORMS_CREATE_FORM";
  }

  // Google Classroom
  if (lower.includes("classroom")) {
    return "GOOGLECLASSROOM_LIST_COURSES";
  }

  // YouTube
  if (lower.includes("youtube")) {
    return "YOUTUBE_SEARCH_YOU_TUBE";
  }

  return norm;
}

/**
 * Executes a tool on Composio Cloud Tool Router.
 */
export async function executeMcpTool(
  toolSlug: string,
  args: Record<string, any> = {},
  userId: string = "learn_default_user"
): Promise<{ success: boolean; data?: any; error?: string; status?: string }> {
  // 1. Quota check (300 calls / week)
  const quota = checkMcpLimit(userId);
  if (!quota.allowed) {
    return {
      success: false,
      error: quota.message || "Batas mingguan 300 tool call MCP telah tercapai.",
      status: "limit_exceeded",
    };
  }

  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "COMPOSIO_API_KEY belum dikonfigurasi di server Const Router.",
      status: "missing_api_key",
    };
  }

  const targetSlug = normalizeToolSlug(toolSlug);

  // Normalize arguments for specific tools
  let normalizedArgs = { ...args };
  if (targetSlug === "CODEINTERPRETER_EXECUTE_CODE" && !normalizedArgs.code_to_execute) {
    normalizedArgs.code_to_execute = args.code || args.script || "";
  }

  // Canva MCP length parameter
  if (targetSlug === "CANVA_MCP_GENERATE_DESIGN" && normalizedArgs.length) {
    const validLengths = ["short", "medium", "long"];
    if (!validLengths.includes(normalizedArgs.length)) {
      normalizedArgs.length = "medium";
    }
  }

  // YouTube query parameter
  if (targetSlug === "YOUTUBE_SEARCH_YOU_TUBE" && !normalizedArgs.q) {
    normalizedArgs.q = args.topic || args.query || args.q || "Materi Pelajaran";
    if (!normalizedArgs.type) normalizedArgs.type = "video";
  }

  // Google Forms info structure
  if (targetSlug === "GOOGLEFORMS_CREATE_FORM" && !normalizedArgs.info && normalizedArgs.title) {
    normalizedArgs.info = {
      title: normalizedArgs.title,
      description: normalizedArgs.description || "Dibuat otomatis oleh Const Learn",
    };
  }

  // Google Tasks task title
  if (targetSlug === "GOOGLETASKS_INSERT_TASK" && !normalizedArgs.title && normalizedArgs.task) {
    normalizedArgs.title = normalizedArgs.task;
  }

  // Google Drive query parameter
  if (targetSlug === "GOOGLEDRIVE_SEARCH_FILES_OR_FOLDERS" && !normalizedArgs.query && normalizedArgs.topic) {
    normalizedArgs.query = normalizedArgs.topic;
  }

  try {
    const execRes = await fetch(`https://backend.composio.dev/api/v3/tools/execute/${targetSlug}`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        arguments: normalizedArgs,
      }),
    });

    if (!execRes.ok) {
      const errText = await execRes.text().catch(() => "");
      recordMcpToolCall(targetSlug, false, userId, `HTTP ${execRes.status}: ${errText}`);
      return {
        success: false,
        error: `Composio tool execution failed (${execRes.status}): ${errText}`,
        status: `http_${execRes.status}`,
      };
    }

    const data = await execRes.json();
    if (data.successful === false || (data.error && !data.data)) {
      const errMsg =
        typeof data.error === "object"
          ? data.error.message || JSON.stringify(data.error)
          : data.error;
      recordMcpToolCall(targetSlug, false, userId, errMsg);
      return {
        success: false,
        error: errMsg || "Tool execution failed on Composio.",
        status: "execution_error",
      };
    }

    recordMcpToolCall(targetSlug, true, userId);

    return {
      success: true,
      data: data.data || data,
    };
  } catch (err: any) {
    recordMcpToolCall(targetSlug, false, userId, err.message || String(err));
    return {
      success: false,
      error: err.message || "Failed to execute MCP tool on cloud router.",
      status: "execution_error",
    };
  }
}

/**
 * Initiates an OAuth authorization session for apps (Canva, Google Suite, YouTube).
 */
export async function getMcpAuthLink(
  toolkit: string,
  userId: string = "learn_default_user",
  callbackUrl?: string
): Promise<{ success: boolean; redirectUrl?: string; connectedAccountId?: string; error?: string }> {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "COMPOSIO_API_KEY is not configured on Const Router.",
    };
  }

  const normalizedToolkit = normalizeToolkitSlug(toolkit);

  try {
    const authConfigId = await getOrCreateAuthConfigId(normalizedToolkit, apiKey);

    const linkRes = await fetch("https://backend.composio.dev/api/v3.1/connected_accounts/link", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        auth_config_id: authConfigId,
        callback_url:
          callbackUrl || "https://accounts.const.web.id/auth-success?connector=" + normalizedToolkit,
      }),
    });

    if (!linkRes.ok) {
      const errText = await linkRes.text().catch(() => "");
      return {
        success: false,
        error: `Composio link failed (${linkRes.status}): ${errText}`,
      };
    }

    const linkData = await linkRes.json();
    const redirectUrl = linkData.redirect_url || linkData.redirectUrl;

    if (!redirectUrl) {
      return {
        success: false,
        error: "No redirect_url returned by Composio.",
      };
    }

    return {
      success: true,
      redirectUrl,
      connectedAccountId: linkData.connected_account_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to generate auth link.",
    };
  }
}

/**
 * Lists connected OAuth accounts for a user.
 */
export async function getMcpConnectedAccounts(userId: string = "learn_default_user") {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return { success: false, error: "COMPOSIO_API_KEY is not configured.", accounts: [] };
  }

  try {
    const userIds = Array.from(
      new Set(
        [userId, "learn_desktop_user", "learn_default_user"]
          .filter(Boolean)
          .map((id) => id.trim())
      )
    ).join(",");

    const res = await fetch(
      `https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(
        userIds
      )}`,
      {
        headers: { "x-api-key": apiKey },
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: errText, accounts: [] };
    }

    const data = await res.json();
    return {
      success: true,
      accounts: data.items || data.data || data || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error", accounts: [] };
  }
}

/**
 * Disconnects an active OAuth account in Composio.
 */
export async function disconnectMcpAccount(accountId: string) {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return { success: false, error: "COMPOSIO_API_KEY is not configured." };
  }

  try {
    const res = await fetch(
      `https://backend.composio.dev/api/v3.1/connected_accounts/${accountId}`,
      {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      }
    );

    return { success: res.ok };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Gets aggregated MCP stats for the dashboard.
 */
export function getGlobalMcpStats(): {
  totalCalls: number;
  activeUsers: number;
  weeklyLimit: number;
  topTools: Array<{ tool: string; count: number }>;
} {
  const store = loadUsageStore();
  let totalCalls = 0;
  const toolCounts: Record<string, number> = {};
  const activeUsers = Object.keys(store).length;

  for (const usage of Object.values(store)) {
    totalCalls += usage.count;
    for (const call of usage.calls || []) {
      toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;
    }
  }

  const topTools = Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalCalls,
    activeUsers,
    weeklyLimit: WEEKLY_TOOL_LIMIT,
    topTools,
  };
}
