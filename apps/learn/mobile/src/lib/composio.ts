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

    // Check MCP configuration stored under const_mcp_configuration_mobile_v3
    try {
      const rawMcp = localStorage.getItem("const_mcp_configuration_mobile_v3");
      if (rawMcp) {
        const parsed = JSON.parse(rawMcp);
        const composioServer = parsed?.servers?.find((s: any) => s.id === "composio");
        if (composioServer?.env?.COMPOSIO_API_KEY) {
          return composioServer.env.COMPOSIO_API_KEY;
        }
      }
    } catch {}
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

/**
 * Executes Canva MCP tool on Composio:
 * Generates presentation candidates and automatically instantiates into a real Canva presentation.
 */
export async function executeCanvaMcp(payload: {
  prompt: string;
  designType?: string;
  jobId?: string;
  candidateId?: string;
}): Promise<{
  success: boolean;
  designId?: string;
  title?: string;
  pageCount?: number;
  editUrl?: string;
  viewUrl?: string;
  thumbnails?: Array<{ url: string }>;
  message?: string;
  error?: string | null;
  durationMs: number;
}> {
  const apiKey = getComposioApiKey();
  const startTime = Date.now();
  const baseUrl = getComposioBaseUrl();

  const runExec = async (sessionId: string, toolSlug: string, args: any, targetBase = baseUrl) => {
    return await fetch(`${targetBase.replace(/\/+$/, "")}/tool_router/session/${sessionId}/execute`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_slug: toolSlug,
        arguments: args,
      }),
    });
  };

  try {
    let sessionId = await getOrCreateSessionId();

    // 1. If direct materialization was requested
    if (payload.jobId && payload.candidateId) {
      const res = await runExec(sessionId, "CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE", {
        job_id: payload.jobId,
        candidate_id: payload.candidateId,
      });
      const json = await res.json();
      const summary = json.data?.design_summary || json.data;
      const editUrl = summary?.urls?.edit_url || summary?.edit_url;
      const viewUrl = summary?.urls?.view_url || summary?.view_url;
      return {
        success: Boolean(editUrl),
        designId: summary?.id,
        title: summary?.title || payload.prompt,
        pageCount: summary?.page_count || 1,
        editUrl,
        viewUrl,
        message: `Presentasi Canva "${summary?.title || payload.prompt}" berhasil dibuat di akun Canva Anda!`,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Generate designs
    let genRes: Response;
    try {
      genRes = await runExec(sessionId, "CANVA_MCP_GENERATE_DESIGN", {
        query: payload.prompt,
        design_type: payload.designType || "presentation",
        length: "short",
      });
    } catch {
      genRes = await runExec(
        sessionId,
        "CANVA_MCP_GENERATE_DESIGN",
        {
          query: payload.prompt,
          design_type: payload.designType || "presentation",
          length: "short",
        },
        baseUrl === "/composio-api" ? "https://backend.composio.dev/api/v3.1" : "/composio-api"
      );
    }

    if (genRes.status === 404 || genRes.status === 401) {
      sessionId = await getOrCreateSessionId(true);
      genRes = await runExec(sessionId, "CANVA_MCP_GENERATE_DESIGN", {
        query: payload.prompt,
        design_type: payload.designType || "presentation",
        length: "short",
      });
    }

    if (!genRes.ok) {
      throw new Error(`Canva MCP Generate failed with HTTP ${genRes.status}`);
    }

    const genJson = await genRes.json();
    const job = genJson.data?.job || genJson.data;
    const designs = job?.result?.generated_designs || [];
    const firstCand = designs[0];

    if (job?.id && firstCand?.candidate_id) {
      // 3. Materialize first candidate into real presentation
      const createRes = await runExec(sessionId, "CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE", {
        job_id: job.id,
        candidate_id: firstCand.candidate_id,
      });

      if (createRes.ok) {
        const createJson = await createRes.json();
        const summary = createJson.data?.design_summary || createJson.data;
        const editUrl = summary?.urls?.edit_url || firstCand.url;
        const viewUrl = summary?.urls?.view_url || firstCand.url;
        const pageCount = summary?.page_count || 4;
        const title = summary?.title || payload.prompt;

        return {
          success: true,
          designId: summary?.id,
          title,
          pageCount,
          editUrl,
          viewUrl,
          thumbnails: firstCand.thumbnails || [],
          message: `Presentasi Canva "${title}" berhasil dibuat dengan ${pageCount} slide di akun Canva Anda!`,
          durationMs: Date.now() - startTime,
        };
      }
    }

    if (firstCand?.url) {
      return {
        success: true,
        title: payload.prompt,
        editUrl: firstCand.url,
        viewUrl: firstCand.url,
        thumbnails: firstCand.thumbnails || [],
        message: `Draft presentasi Canva "${payload.prompt}" berhasil dibuat!`,
        durationMs: Date.now() - startTime,
      };
    }

    throw new Error("No design candidates returned by Canva MCP");
  } catch (err: any) {
    const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(payload.prompt)}`;
    return {
      success: false,
      editUrl: fallbackUrl,
      message: `Desain Canva disiapkan untuk: "${payload.prompt}". Silakan hubungkan akun Canva di menu MCP.`,
      error: err?.message || String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Renders a HyperFrames video in the Composio Cloud Sandbox.
 * Creates the project files, installs/runs hyperframes via npx, and returns
 * either the rendered MP4 base64 or status.
 */
export async function renderVideoInSandbox(payload: {
  htmlContent: string;
  totalDurationSeconds?: number;
}): Promise<{
  success: boolean;
  mp4Base64?: string;
  error?: string | null;
  durationMs: number;
}> {
  // Python script that sets up project, runs npx hyperframes render, and extracts base64
  const pythonScript = `
import os
import sys
import subprocess
import base64

html_data = """${payload.htmlContent.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"
"""

workdir = "/tmp/hf_video"
os.makedirs(workdir, exist_ok=True)
index_path = os.path.join(workdir, "index.html")
with open(index_path, "w", encoding="utf-8") as f:
    f.write(html_data)

out_mp4 = os.path.join(workdir, "video.mp4")

cmd = ["npx", "--yes", "hyperframes", "render", ".", "-o", out_mp4]
proc = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True, timeout=120)

if os.path.exists(out_mp4):
    with open(out_mp4, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    print(f"__MP4_DATA_START__{b64}__MP4_DATA_END__")
else:
    print(f"ERROR: {proc.stderr or proc.stdout}")
`;

  const result = await executeCodeInterpreter(pythonScript, { timeout: 150 });

  if (!result.success) {
    return {
      success: false,
      error: result.error || result.stderr || "Sandbox execution failed",
      durationMs: result.durationMs,
    };
  }

  const match = result.stdout.match(/__MP4_DATA_START__([A-Za-z0-9+/=]+)__MP4_DATA_END__/);
  if (match && match[1]) {
    return {
      success: true,
      mp4Base64: match[1],
      durationMs: result.durationMs,
    };
  }

  return {
    success: false,
    error: result.stdout || result.stderr || "Video rendering failed in sandbox",
    durationMs: result.durationMs,
  };
}

