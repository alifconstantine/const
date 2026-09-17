/**
 * Composio Client Service for Const Learn Mobile.
 * Connects to Composio REST API v3.1 to manage sessions and execute sandboxed code
 * using the CODEINTERPRETER toolkit.
 */

export interface CodeInterpreterResult {
  success: boolean;
  stdout: string;
  stderr: string;
  results?: any;
  error?: string | null;
  sandboxId?: string;
  logId?: string;
  durationMs: number;
}

/**
 * Resolves the base URL for Composio API.
 * When running in development (localhost or LAN IP like 10.188.x.x),
 * uses the relative proxy "/composio-api" configured in Vite to bypass
 * browser CORS restrictions from backend.composio.dev.
 */
export function getComposioBaseUrl(): string {
  if (typeof window !== "undefined") {
    const isDev = Boolean((import.meta as any).env?.DEV);
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isPrivateIP =
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    const isDevPort = window.location.port === "3003" || window.location.port === "5173";

    if (isDev || isLocalhost || isPrivateIP || isDevPort) {
      return "/composio-api";
    }
  }

  return "https://backend.composio.dev/api/v3.1";
}

/**
 * Resolves the Composio API Key from Vite env or localStorage.
 */
export function getComposioApiKey(): string {
  const envKey =
    (import.meta as any).env?.VITE_COMPOSIO_API_KEY ||
    (import.meta as any).env?.COMPOSIO_API_KEY ||
    "";
  if (envKey) return envKey;

  if (typeof window !== "undefined") {
    const localKey = localStorage.getItem("composio_api_key");
    if (localKey) return localKey;
  }

  return "";
}

/**
 * Gets or creates a persistent device/user identifier for session isolation.
 */
export function getLocalDeviceId(): string {
  if (typeof window === "undefined") return "learn_mobile_user";
  let deviceId = localStorage.getItem("const_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("const_device_id", deviceId);
  }
  return deviceId;
}

/**
 * Retrieves an active Composio session ID, or creates a new one if none exists.
 */
export async function getOrCreateSessionId(forceNew = false): Promise<string> {
  const SESSION_KEY = "composio_session_id";
  const apiKey = getComposioApiKey();

  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is not configured.");
  }

  if (!forceNew && typeof window !== "undefined") {
    const cached = localStorage.getItem(SESSION_KEY);
    if (cached) return cached;
  }

  const userId = getLocalDeviceId();
  const baseUrl = getComposioBaseUrl();

  const executeCreate = async (targetBase: string) => {
    return await fetch(`${targetBase.replace(/\/+$/, "")}/tool_router/session`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        manage_connections: { enable: true },
        workbench: { enable: true },
      }),
    });
  };

  let res: Response;
  try {
    res = await executeCreate(baseUrl);
  } catch {
    // Fallback between proxy and direct URL if fetch fails
    if (baseUrl === "/composio-api") {
      res = await executeCreate("https://backend.composio.dev/api/v3.1");
    } else {
      res = await executeCreate("/composio-api");
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to create Composio session (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  const sessionId = data.session_id;

  if (typeof window !== "undefined" && sessionId) {
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Executes Python code using the Composio CODEINTERPRETER_EXECUTE_CODE tool.
 */
export async function executeCodeInterpreter(
  code: string,
  options?: {
    sandboxId?: string;
    timeout?: number;
  }
): Promise<CodeInterpreterResult> {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return {
      success: false,
      stdout: "",
      stderr: "COMPOSIO_API_KEY is not configured in environment.",
      error: "Missing API Key",
      durationMs: 0,
    };
  }

  const startTime = Date.now();
  const baseUrl = getComposioBaseUrl();

  const runRequest = async (sessionId: string, targetBase = baseUrl) => {
    return await fetch(`${targetBase.replace(/\/+$/, "")}/tool_router/session/${sessionId}/execute`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_slug: "CODEINTERPRETER_EXECUTE_CODE",
        arguments: {
          code_to_execute: code,
          ...(options?.sandboxId ? { sandbox_id: options.sandboxId } : {}),
          ...(options?.timeout ? { timeout: options.timeout } : {}),
        },
      }),
    });
  };

  try {
    let sessionId = await getOrCreateSessionId();
    let res: Response;

    try {
      res = await runRequest(sessionId, baseUrl);
    } catch {
      // If relative proxy failed or direct failed, attempt fallback
      if (baseUrl === "/composio-api") {
        res = await runRequest(sessionId, "https://backend.composio.dev/api/v3.1");
      } else {
        res = await runRequest(sessionId, "/composio-api");
      }
    }

    // If session expired or invalid (e.g., 404), refresh session once
    if (res.status === 404 || res.status === 401) {
      sessionId = await getOrCreateSessionId(true);
      res = await runRequest(sessionId, baseUrl);
    }

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        stdout: "",
        stderr: `Execution failed (HTTP ${res.status}): ${errText}`,
        error: `HTTP ${res.status}`,
        durationMs,
      };
    }

    const json = await res.json();
    const data = json.data || {};
    const hasError = Boolean(json.error || data.error);

    return {
      success: !hasError,
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      results: data.results || undefined,
      error: json.error || data.error || null,
      sandboxId: data.sandbox_id,
      logId: json.log_id,
      durationMs,
    };
  } catch (err: any) {
    return {
      success: false,
      stdout: "",
      stderr: err?.message || String(err),
      error: err?.message || "Execution exception",
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Tests the sandbox connectivity by running a fast test script.
 */
export async function testSandboxConnection(): Promise<{
  success: boolean;
  message: string;
  durationMs: number;
  stdout?: string;
  logId?: string;
}> {
  const testCode = `import sys
print(f"Composio Sandbox Ready! Python {sys.version.split()[0]} on Linux.")
`;

  const result = await executeCodeInterpreter(testCode, { timeout: 15 });

  if (result.success && result.stdout) {
    return {
      success: true,
      message: result.stdout.trim(),
      durationMs: result.durationMs,
      stdout: result.stdout,
      logId: result.logId,
    };
  }

  return {
    success: false,
    message: result.error || result.stderr || "Failed to reach Composio Sandbox",
    durationMs: result.durationMs,
    logId: result.logId,
  };
}
