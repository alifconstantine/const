/**
 * Composio Client Service for Const Learn Mobile.
 * Connects to Composio REST API v3.1 to manage sessions and execute sandboxed code
 * using the CODEINTERPRETER toolkit.
 */

import {
  checkComposioLimit,
  recordComposioToolCall,
  getStoredComposioUsage,
} from "./composio-usage";

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
 * Resolves the base URL for Const Router AI & Tool Gateway.
 */
export function getRouterBaseUrl(): string {
  const envUrl =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
    "https://router.const.web.id/v1";
  return envUrl.replace(/\/+$/, "");
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
  const startTime = Date.now();

  // 1. Primary path: Delegate to Const Router MCP Gateway
  try {
    const res = await executeComposioTool("CODEINTERPRETER_EXECUTE_CODE", {
      code_to_execute: code,
      ...(options?.sandboxId ? { sandbox_id: options.sandboxId } : {}),
      ...(options?.timeout ? { timeout: options.timeout } : {}),
    });

    if (res.success && res.data) {
      const data = res.data;
      const hasError = Boolean(data.error);
      return {
        success: !hasError,
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        results: data.results || undefined,
        error: data.error || null,
        sandboxId: data.sandbox_id,
        logId: data.log_id,
        durationMs: Date.now() - startTime,
      };
    } else if (res.error) {
      return {
        success: false,
        stdout: "",
        stderr: res.error,
        error: res.error,
        durationMs: Date.now() - startTime,
      };
    }
  } catch (gatewayErr) {
    console.warn("[executeCodeInterpreter Gateway Warning]", gatewayErr);
  }

  // 2. Direct Composio fallback if local API key is configured
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return {
      success: false,
      stdout: "",
      stderr: "Gagal mengeksekusi tool Cloud Sandbox melalui Const Router Gateway.",
      error: "Gateway unavailable",
      durationMs: Date.now() - startTime,
    };
  }

  const limit = checkComposioLimit();
  if (!limit.allowed) {
    return {
      success: false,
      stdout: "",
      stderr: limit.message || "Batas mingguan 300 tool call Composio telah tercapai.",
      error: "Weekly limit exceeded",
      durationMs: Date.now() - startTime,
    };
  }

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

    recordComposioToolCall("CODEINTERPRETER_EXECUTE_CODE", !hasError);

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
    recordComposioToolCall("CODEINTERPRETER_EXECUTE_CODE", false, undefined, err?.message);
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
  slideCount?: number;
  length?: "short" | "balanced" | "comprehensive";
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
  const startTime = Date.now();

  try {
    // 1. If direct materialization was requested
    if (payload.jobId && payload.candidateId) {
      const res = await executeComposioTool("CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE", {
        job_id: payload.jobId,
        candidate_id: payload.candidateId,
      });

      if (res.success && res.data) {
        const summary = res.data?.design_summary || res.data;
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
    }

    // Dynamic Canva length determination
    const canvaLength: "short" | "balanced" | "comprehensive" =
      payload.length ||
      (payload.slideCount && payload.slideCount > 15
        ? "comprehensive"
        : payload.slideCount && payload.slideCount > 5
        ? "balanced"
        : "short");

    // 2. Generate designs via Router Gateway
    const genRes = await executeComposioTool("CANVA_MCP_GENERATE_DESIGN", {
      query: payload.prompt,
      design_type: payload.designType || "presentation",
      length: canvaLength,
    });

    if (genRes.success && genRes.data) {
      const job = genRes.data?.job || genRes.data;
      const designs = job?.result?.generated_designs || [];
      const firstCand = designs[0];

      if (job?.id && firstCand?.candidate_id) {
        // 3. Materialize first candidate into real presentation
        const createRes = await executeComposioTool("CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE", {
          job_id: job.id,
          candidate_id: firstCand.candidate_id,
        });

        if (createRes.success && createRes.data) {
          const summary = createRes.data?.design_summary || createRes.data;
          const editUrl = summary?.urls?.edit_url || firstCand.url;
          const viewUrl = summary?.urls?.view_url || firstCand.url;
          const pageCount = summary?.page_count || 4;
          const title = summary?.title || payload.prompt;

          return {
            success: true,
            designId: summary?.id || firstCand.candidate_id,
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
    }

    const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(payload.prompt)}`;
    return {
      success: false,
      editUrl: fallbackUrl,
      message: `Desain Canva disiapkan untuk: "${payload.prompt}". Silakan hubungkan akun Canva di menu Connectors.`,
      error: genRes.error || null,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(payload.prompt)}`;
    return {
      success: false,
      editUrl: fallbackUrl,
      message: `Desain Canva disiapkan untuk: "${payload.prompt}". Silakan hubungkan akun Canva di menu Connectors.`,
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

/**
 * Generic Composio Tool Execution helper for Mobile.
 */
export async function executeComposioTool(
  toolSlug: string,
  args: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  const routerUrl = getRouterBaseUrl();
  const userId = getLocalDeviceId();

  // 1. Primary path: Delegate execution to Const Router MCP Gateway
  try {
    const res = await fetch(`${routerUrl}/mcp/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": userId,
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        toolSlug,
        arguments: args,
        userId,
      }),
    });

    const json = await res.json();
    if (res.ok && json.success) {
      recordComposioToolCall(toolSlug, true);
      return { success: true, data: json.data || json.result };
    } else if (json.error) {
      recordComposioToolCall(toolSlug, false, undefined, json.error);
      return { success: false, error: json.error };
    }
  } catch (routerErr) {
    console.warn("[Mobile Composio] Router MCP gateway unavailable, checking direct fallback:", routerErr);
  }

  // 2. Direct Composio fallback if local API key is configured
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "Gagal mengeksekusi tool via Const Router Gateway.",
    };
  }

  const limitCheck = checkComposioLimit();
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: limitCheck.message || "Batas mingguan 300 tool call Composio telah tercapai.",
    };
  }

  const baseUrl = getComposioBaseUrl();
  try {
    let sessionId = await getOrCreateSessionId();
    const runExec = async (sId: string, targetBase = baseUrl) => {
      return await fetch(`${targetBase.replace(/\/+$/, "")}/tool_router/session/${sId}/execute`, {
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

    let res = await runExec(sessionId);
    if (res.status === 404 || res.status === 401) {
      sessionId = await getOrCreateSessionId(true);
      res = await runExec(sessionId);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      recordComposioToolCall(toolSlug, false, undefined, `HTTP ${res.status}: ${errText}`);
      return { success: false, error: `Tool ${toolSlug} failed (HTTP ${res.status}): ${errText}` };
    }
    const json = await res.json();
    recordComposioToolCall(toolSlug, true);
    return { success: true, data: json.data || json };
  } catch (err: any) {
    recordComposioToolCall(toolSlug, false, undefined, err?.message);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Renders an Open-Design 1920x1080 HTML Presentation to PDF in Composio Cloud Sandbox.
 */
export async function renderPresentationPdfInSandbox(payload: {
  htmlContent: string;
}): Promise<{
  success: boolean;
  pdfBase64?: string;
  error?: string | null;
  durationMs: number;
}> {
  const pythonScript = `
import os
import sys
import subprocess
import base64

html_data = """${payload.htmlContent.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"
"""

workdir = "/tmp/const_presentation"
os.makedirs(workdir, exist_ok=True)
html_path = os.path.join(workdir, "index.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_data)

out_pdf = os.path.join(workdir, "presentation.pdf")

# Attempt weasyprint or headless chromium if installed in sandbox
cmd = ["weasyprint", "--page-size", "1920px 1080px", html_path, out_pdf]
try:
    subprocess.run(cmd, capture_output=True, text=True, timeout=60)
except Exception:
    pass

if not os.path.exists(out_pdf):
    cmd2 = ["chromium", "--headless", "--disable-gpu", f"--print-to-pdf={out_pdf}", html_path]
    try:
        subprocess.run(cmd2, capture_output=True, text=True, timeout=60)
    except Exception:
        pass

if os.path.exists(out_pdf):
    with open(out_pdf, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    print(f"__PDF_DATA_START__{b64}__PDF_DATA_END__")
else:
    print("PDF_RENDER_SKIPPED")
`;

  const result = await executeCodeInterpreter(pythonScript, { timeout: 70 });

  if (!result.success) {
    return {
      success: false,
      error: result.error || result.stderr || "Sandbox execution failed",
      durationMs: result.durationMs,
    };
  }

  const match = result.stdout.match(/__PDF_DATA_START__([A-Za-z0-9+/=]+)__PDF_DATA_END__/);
  if (match && match[1]) {
    return {
      success: true,
      pdfBase64: match[1],
      durationMs: result.durationMs,
    };
  }

  return {
    success: false,
    error: "PDF rendering in sandbox was skipped or completed without binary",
    durationMs: result.durationMs,
  };
}

/**
 * Exports a Canva presentation to downloadable file format (PDF, PPTX, PNG) via Canva MCP on Composio.
 */
export async function exportCanvaPresentation(options: {
  designId?: string;
  format?: "pdf" | "pptx" | "png";
}): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  if (!options.designId) {
    return { success: false, error: "Canva design ID is missing" };
  }

  const formatType = options.format || "pdf";

  try {
    const res = await executeComposioTool("CANVA_MCP_EXPORT_DESIGN", {
      design_id: options.designId,
      format: { type: formatType },
      user_intent: `Export presentation as ${formatType.toUpperCase()}`,
    });

    if (res?.success && res.data) {
      const downloadUrl =
        res.data.url ||
        res.data.download_url ||
        res.data.export_url ||
        res.data.job?.result?.export_url ||
        res.data.job?.result?.download_url;

      if (downloadUrl) {
        return { success: true, downloadUrl };
      }
    }
    return { success: false, error: res?.error || "Export did not return download URL" };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}


