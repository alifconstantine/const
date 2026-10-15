import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { shell } from "electron";

export const MCP_OAUTH_PORT = 24138;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface McpTestResult {
  success: boolean;
  tools?: McpToolInfo[];
  count?: number;
  sessionId?: string;
  error?: string;
}

export interface McpServerConfigPayload {
  id?: string;
  name?: string;
  transport?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  timeoutMs?: number;
  sessionId?: string;
}

// Active MCP Sessions Registry for Clean Teardown & Disconnection
interface ActiveSessionEntry {
  serverId: string;
  transport: "stdio" | "http" | "sse";
  url?: string;
  sessionId?: string;
  headers?: Record<string, string>;
  process?: any;
}
const activeMcpSessions = new Map<string, ActiveSessionEntry>();

// Active OAuth loopback server state
let activeOAuthServer: http.Server | null = null;
const activeOAuthSockets = new Set<net.Socket>();
let oauthTimeoutTimer: NodeJS.Timeout | null = null;
let activeExpectedState: string | null = null;
let pendingOAuthResolver: ((result: { success: boolean; token?: string; error?: string }) => void) | null = null;
let activeCanvaPkce: {
  verifier: string;
  clientId: string;
  clientSecret?: string;
  callbackUrl: string;
} | null = null;

export function stopMcpOAuthServer() {
  if (oauthTimeoutTimer) {
    clearTimeout(oauthTimeoutTimer);
    oauthTimeoutTimer = null;
  }
  activeExpectedState = null;
  activeCanvaPkce = null;
  if (pendingOAuthResolver) {
    pendingOAuthResolver({ success: false, error: "Otentikasi dibatalkan atau waktu habis." });
    pendingOAuthResolver = null;
  }
  if (activeOAuthServer) {
    for (const socket of activeOAuthSockets) {
      socket.destroy();
    }
    activeOAuthSockets.clear();
    try {
      activeOAuthServer.close();
    } catch {}
    activeOAuthServer = null;
  }
}

/**
 * Starts a local loopback server and opens user's default browser for OAuth flow.
 * Supports official Canva Connect / MCP DCR PKCE RFC 7636 and GitHub tokens.
 */
export async function startMcpOAuthFlow(
  providerId: string,
  rawAuthUrl?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  stopMcpOAuthServer();

  const state = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  activeExpectedState = state;

  const callbackUrl = `http://127.0.0.1:${MCP_OAUTH_PORT}/callback`;

  // Default preset auth URLs if not provided
  let authUrl = rawAuthUrl;
  const isCanva = providerId === "canva" || (rawAuthUrl && rawAuthUrl.includes("canva.com"));

  if (isCanva) {
    // Generate PKCE code_verifier and S256 code_challenge
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

    // Dynamic Client Registration (RFC 7591) via Canva Remote MCP
    let clientId = process.env.CANVA_CLIENT_ID || "";
    let clientSecret = process.env.CANVA_CLIENT_SECRET || "";

    if (!clientId) {
      try {
        const dcrRes = await fetch("https://mcp.canva.com/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: "Const Learn",
            redirect_uris: [callbackUrl],
          }),
        });
        if (dcrRes.ok) {
          const dcrData = (await dcrRes.json()) as any;
          if (dcrData.client_id) {
            clientId = dcrData.client_id;
            clientSecret = dcrData.client_secret || "";
          }
        }
      } catch (err) {
        console.warn("[McpRunner] Canva DCR attempt failed, using verified fallback client:", err);
      }
    }

    if (!clientId) {
      // Verified fallback client registered on Canva MCP
      clientId = "lUxJjfj2oD9dq3yI";
    }

    activeCanvaPkce = {
      verifier,
      clientId,
      clientSecret: clientSecret || undefined,
      callbackUrl,
    };

    authUrl = `https://mcp.canva.com/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&state=${encodeURIComponent(state)}`;
  } else if (!authUrl) {
    if (providerId === "github") {
      authUrl = "https://github.com/settings/tokens/new?scopes=repo,read:org,user&description=Const%20Learn%20MCP";
    } else {
      authUrl = `https://accounts.const.web.id/oauth/authorize?client_id=const_learn&scope=mcp_${providerId}`;
    }
  }

  if (!isCanva && authUrl) {
    try {
      const parsed = new URL(authUrl);
      if (!parsed.searchParams.has("redirect_uri")) {
        parsed.searchParams.set("redirect_uri", callbackUrl);
      }
      if (!parsed.searchParams.has("state")) {
        parsed.searchParams.set("state", state);
      }
      authUrl = parsed.toString();
    } catch {}
  }

  return new Promise((resolve) => {
    pendingOAuthResolver = resolve;

    const server = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        const reqUrl = new URL(req.url || "", `http://127.0.0.1:${MCP_OAUTH_PORT}`);
        const pathname = reqUrl.pathname.toLowerCase();

        if (pathname === "/callback" || pathname === "/oauth/callback") {
          const code = reqUrl.searchParams.get("code") || reqUrl.searchParams.get("token") || reqUrl.searchParams.get("access_token");
          const returnedState = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error") || reqUrl.searchParams.get("error_description");

          const htmlSuccess = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Otentikasi Berhasil · Const Learn</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #121212;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      user-select: none;
    }
    .card {
      background: #1e1e1e;
      border: 1px solid #333333;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 48px rgba(0,0,0,0.6);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: #10b981;
      font-size: 28px;
    }
    h2 {
      font-size: 20px;
      margin: 0 0 10px 0;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 14px;
      color: #a1a1aa;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }
    .badge {
      font-size: 12px;
      color: #71717a;
      background: #27272a;
      padding: 8px 16px;
      border-radius: 9999px;
      display: inline-block;
      margin-bottom: 20px;
      border: 1px solid #3f3f46;
    }
    .timer-bar {
      height: 4px;
      background: #27272a;
      border-radius: 2px;
      overflow: hidden;
      margin: 0 auto 16px;
      max-width: 240px;
    }
    .timer-progress {
      height: 100%;
      background: #10b981;
      width: 100%;
      animation: countdownBar 5s linear forwards;
    }
    @keyframes countdownBar {
      from { width: 100%; }
      to { width: 0%; }
    }
    .close-btn {
      background: #ffffff;
      color: #000000;
      border: none;
      font-weight: 500;
      font-size: 13px;
      padding: 8px 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .close-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Otentikasi Berhasil!</h2>
    <p>Akun Anda telah berhasil terhubung dengan Const Learn.</p>
    <div class="timer-bar">
      <div class="timer-progress"></div>
    </div>
    <div class="badge">
      Menutup tab dalam <span id="seconds" style="color: #10b981; font-weight: 600;">5</span> detik...
    </div>
    <div>
      <button class="close-btn" onclick="closeNow()">Tutup Sekarang</button>
    </div>
  </div>
  <script>
    let remaining = 5;
    const el = document.getElementById("seconds");
    function closeNow() {
      try { window.close(); } catch(e){}
    }
    const timer = setInterval(() => {
      remaining -= 1;
      if (el) el.textContent = remaining > 0 ? remaining : "0";
      if (remaining <= 0) {
        clearInterval(timer);
        closeNow();
      }
    }, 1000);
  </script>
</body>
</html>`;

          const htmlError = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Otentikasi Gagal - Const Learn</title>
  <style>
    body { background-color: #161616; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #222222; border: 1px solid #383838; border-radius: 16px; padding: 36px 32px; max-width: 420px; text-align: center; }
    .icon { width: 52px; height: 52px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; color: #ef4444; font-size: 26px; }
    h2 { font-size: 20px; margin: 0 0 10px 0; }
    p { font-size: 14px; color: #d4d4d4; margin: 0 0 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h2>Otentikasi Gagal</h2>
    <p>${error || "Terjadi kesalahan saat otorisasi kredensial."}</p>
  </div>
</body>
</html>`;

          if (error) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(htmlError);
            const resolver = pendingOAuthResolver;
            pendingOAuthResolver = null;
            if (resolver) resolver({ success: false, error });
            setTimeout(() => stopMcpOAuthServer(), 1000);
            return;
          }

          if (activeExpectedState && returnedState && returnedState !== activeExpectedState) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(htmlError);
            const resolver = pendingOAuthResolver;
            pendingOAuthResolver = null;
            if (resolver) resolver({ success: false, error: "Status otentikasi (state) tidak cocok." });
            setTimeout(() => stopMcpOAuthServer(), 1000);
            return;
          }

          // Exchange authorization code for token if Canva PKCE was active
          let finalToken = code || "connected";
          if (activeCanvaPkce && code) {
            try {
              const headers: Record<string, string> = {
                "Content-Type": "application/x-www-form-urlencoded",
              };
              if (activeCanvaPkce.clientSecret) {
                headers["Authorization"] = `Basic ${Buffer.from(
                  `${activeCanvaPkce.clientId}:${activeCanvaPkce.clientSecret}`
                ).toString("base64")}`;
              }
              const tokenRes = await fetch("https://mcp.canva.com/token", {
                method: "POST",
                headers,
                body: new URLSearchParams({
                  grant_type: "authorization_code",
                  client_id: activeCanvaPkce.clientId,
                  code,
                  redirect_uri: activeCanvaPkce.callbackUrl,
                  code_verifier: activeCanvaPkce.verifier,
                }),
              });
              if (tokenRes.ok) {
                const tokenData = (await tokenRes.json()) as any;
                if (tokenData.access_token) {
                  finalToken = tokenData.access_token;
                }
              } else {
                const errText = await tokenRes.text().catch(() => "");
                console.warn("[McpRunner] Canva token exchange returned non-ok:", tokenRes.status, errText);
              }
            } catch (exchangeErr) {
              console.warn("[McpRunner] Canva token exchange error:", exchangeErr);
            }
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(htmlSuccess);

          // Resolve pending promise successfully FIRST, and cleanly close server after browser gets HTML
          const resolver = pendingOAuthResolver;
          pendingOAuthResolver = null;
          activeExpectedState = null;
          activeCanvaPkce = null;
          if (resolver) {
            resolver({ success: true, token: finalToken });
          }

          setTimeout(() => {
            stopMcpOAuthServer();
          }, 5000);
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });

    server.on("connection", (socket) => {
      activeOAuthSockets.add(socket);
      socket.on("close", () => activeOAuthSockets.delete(socket));
    });

    server.on("error", (err: any) => {
      stopMcpOAuthServer();
      resolve({ success: false, error: `Gagal menjalankan server otentikasi loopback: ${err.message}` });
    });

    server.listen(MCP_OAUTH_PORT, "127.0.0.1", () => {
      activeOAuthServer = server;
      // Open in default user browser
      if (authUrl) {
        shell.openExternal(authUrl);
      }

      oauthTimeoutTimer = setTimeout(() => {
        stopMcpOAuthServer();
      }, OAUTH_TIMEOUT_MS);
    });
  });
}

/**
 * Tests connection to an MCP server (Stdio or HTTP/SSE) and retrieves its tools list.
 */
export async function testMcpServerConnection(server: McpServerConfigPayload): Promise<McpTestResult> {
  const transport = server.transport || (server.command ? "stdio" : "http");
  const timeoutMs = server.timeoutMs || 25000;

  if (transport === "stdio") {
    return testStdioMcpServer(server, timeoutMs);
  } else {
    return testHttpMcpServer(server, timeoutMs);
  }
}

/**
 * Tests a local stdio MCP server by spawning process and executing JSON-RPC handshake.
 */
async function testStdioMcpServer(server: McpServerConfigPayload, timeoutMs: number): Promise<McpTestResult> {
  const command = (server.command || "").trim();
  if (!command) {
    return { success: false, error: "Command perintah lokal tidak boleh kosong." };
  }

  const args = server.args || [];
  const env = { ...process.env, ...(server.env || {}) };

  return new Promise((resolve) => {
    let resolved = false;
    let proc: any = null;
    let buffer = "";

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (proc) {
          try { proc.kill("SIGKILL"); } catch {}
        }
        resolve({ success: false, error: `Batas waktu pengujian (${Math.round(timeoutMs / 1000)} detik) terlampaui.` });
      }
    }, timeoutMs);

    try {
      proc = spawn(command, args, {
        env,
        shell: process.platform === "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: any) {
      clearTimeout(timer);
      return resolve({ success: false, error: `Gagal menjalankan perintah ${command}: ${err.message}` });
    }

    let stderrOutput = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString("utf8");
    });

    proc.on("error", (err: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ success: false, error: `Proses gagal dimulai: ${err.message}` });
      }
    });

    proc.on("close", (code: number) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Proses berhenti mendadak dengan kode keluar ${code}. ${stderrOutput.slice(0, 300)}`,
        });
      }
    });

    // Helper to send JSON-RPC message
    function sendJsonRpc(msg: any) {
      if (proc && proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write(JSON.stringify(msg) + "\n");
      }
    }

    let isInitialized = false;

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);

          // Handle initialize response
          if (parsed.id === 1 && parsed.result) {
            isInitialized = true;
            // Send initialized notification
            sendJsonRpc({
              jsonrpc: "2.0",
              method: "notifications/initialized",
            });
            // Request tools list
            sendJsonRpc({
              jsonrpc: "2.0",
              id: 2,
              method: "tools/list",
              params: {},
            });
          }

          // Handle tools/list response
          if (parsed.id === 2 && parsed.result) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              const rawTools = parsed.result.tools || [];
              const tools: McpToolInfo[] = rawTools.map((t: any) => ({
                name: t.name,
                description: t.description || "",
                inputSchema: t.inputSchema,
              }));

              try { proc.kill(); } catch {}
              resolve({
                success: true,
                tools,
                count: tools.length,
              });
            }
          }
        } catch {
          // Ignore non-JSON output (e.g. log lines from npx)
        }
      }
    });

    // Send initialize request
    sendJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "const-learn-desktop",
          version: "1.0.0",
        },
      },
    });
  });
}

/**
 * Tests a remote HTTP or SSE MCP server using standard fetch.
 */
async function testHttpMcpServer(server: McpServerConfigPayload, timeoutMs: number): Promise<McpTestResult> {
  const url = (server.url || "").trim();
  if (!url) {
    return { success: false, error: "URL server MCP tidak boleh kosong." };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(server.headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Send initialize request
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "const-learn-desktop",
            version: "1.0.0",
          },
        },
      }),
      signal: controller.signal,
    });

    if (!initRes.ok) {
      clearTimeout(timer);
      const text = await initRes.text().catch(() => "");
      return {
        success: false,
        error: `Server merespons status ${initRes.status} (${initRes.statusText}). ${text.slice(0, 200)}`,
      };
    }

    // Extract Mcp-Session-Id header if returned by server (Streamable HTTP spec)
    const sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id") || undefined;
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    // 2. Send initialized notification (Standard MCP protocol requirement)
    try {
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        }),
        signal: controller.signal,
      });
    } catch {
      // Best-effort notification
    }

    // 3. Send tools/list request
    const toolsRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!toolsRes.ok) {
      const text = await toolsRes.text().catch(() => "");
      return {
        success: false,
        error: `Gagal mengambil daftar alat: status ${toolsRes.status}. ${text.slice(0, 200)}`,
      };
    }

    const data = await toolsRes.json();
    const rawTools = data.result?.tools || [];
    const tools: McpToolInfo[] = rawTools.map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema,
    }));

    // Register active session for clean teardown
    if (server.id) {
      activeMcpSessions.set(server.id, {
        serverId: server.id,
        transport: "http",
        url,
        sessionId,
        headers,
      });
    }

    return {
      success: true,
      tools,
      count: tools.length,
      sessionId,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { success: false, error: `Batas waktu pengujian (${Math.round(timeoutMs / 1000)} detik) terlampaui.` };
    }
    return { success: false, error: `Koneksi gagal: ${err.message}` };
  }
}

/**
 * Disconnects from an active MCP server:
 * - For Streamable HTTP: sends DELETE to server URL with Mcp-Session-Id to terminate session.
 * - For Stdio: terminates child process gracefully and closes pipes.
 */
export async function disconnectMcpServer(
  server: McpServerConfigPayload
): Promise<{ success: boolean; error?: string }> {
  const id = server.id;
  const session = id ? activeMcpSessions.get(id) : null;

  // 1. If HTTP/SSE session exists, send DELETE request per MCP protocol spec
  const url = server.url || session?.url;
  const sessionId = server.sessionId || session?.sessionId;
  if (url && (server.transport !== "stdio")) {
    try {
      const deleteHeaders: Record<string, string> = {
        ...(server.headers || {}),
        ...(session?.headers || {}),
      };
      if (sessionId) {
        deleteHeaders["mcp-session-id"] = sessionId;
      }
      await fetch(url, {
        method: "DELETE",
        headers: deleteHeaders,
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    } catch {
      // Best effort cleanup
    }
  }

  // 2. If stdio subprocess is running, terminate it
  if (session?.process) {
    try {
      session.process.stdin?.end();
      session.process.kill("SIGTERM");
      setTimeout(() => {
        try {
          session.process?.kill("SIGKILL");
        } catch {}
      }, 1000);
    } catch {
      // Best effort cleanup
    }
  }

  if (id) {
    activeMcpSessions.delete(id);
  }

  return { success: true };
}
