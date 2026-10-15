/**
 * Mobile Streamable HTTP MCP Client for Const Learn Mobile.
 * Clean, lightweight, zero-dependency client strictly following official MCP protocol specifications.
 */

export interface MobileMcpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MobileMcpTestResult {
  success: boolean;
  tools?: MobileMcpTool[];
  count?: number;
  sessionId?: string;
  error?: string;
}

/**
 * Tests connection to a remote HTTP or SSE MCP server using web fetch.
 * Implements the standard MCP handshake:
 * 1. POST initialize
 * 2. Capture Mcp-Session-Id header (Streamable HTTP)
 * 3. POST notifications/initialized
 * 4. POST tools/list
 */
export async function testRemoteMcpConnection(
  url: string,
  headers?: Record<string, string>,
  timeoutMs: number = 20000
): Promise<MobileMcpTestResult> {
  const targetUrl = url.trim();
  if (!targetUrl) {
    return { success: false, error: "URL server MCP tidak boleh kosong." };
  }

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Initialize Handshake
    const initRes = await fetch(targetUrl, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "const-learn-mobile",
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
        error: `Server merespons status ${initRes.status}. ${text.slice(0, 150)}`,
      };
    }

    // Capture Mcp-Session-Id header if returned by server (Streamable HTTP spec)
    const sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id") || undefined;
    if (sessionId) {
      reqHeaders["mcp-session-id"] = sessionId;
    }

    // 2. Send initialized notification (Standard MCP protocol requirement)
    try {
      await fetch(targetUrl, {
        method: "POST",
        headers: reqHeaders,
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

    // 3. Request Tools List
    const toolsRes = await fetch(targetUrl, {
      method: "POST",
      headers: reqHeaders,
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
        error: `Gagal memuat tools: status ${toolsRes.status}. ${text.slice(0, 150)}`,
      };
    }

    const data = await toolsRes.json();
    const rawTools = data.result?.tools || [];
    const tools: MobileMcpTool[] = rawTools.map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema,
    }));

    return {
      success: true,
      tools,
      count: tools.length,
      sessionId,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: `Batas waktu (${Math.round(timeoutMs / 1000)}s) habis saat menghubungi server.`,
      };
    }
    return {
      success: false,
      error: `Koneksi gagal: ${err.message || "Pastikan URL dapat diakses."}`,
    };
  }
}

/**
 * Disconnects from an active remote MCP HTTP/SSE server.
 * Per the MCP Streamable HTTP specification, sends a DELETE request with Mcp-Session-Id.
 */
export async function disconnectRemoteMcpServer(
  url: string,
  sessionId?: string,
  headers?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const targetUrl = url.trim();
  if (!targetUrl) return { success: true };

  if (sessionId) {
    try {
      const reqHeaders: Record<string, string> = {
        ...(headers || {}),
        "mcp-session-id": sessionId,
      };
      await fetch(targetUrl, {
        method: "DELETE",
        headers: reqHeaders,
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    } catch {
      // Best-effort session teardown
    }
  }

  return { success: true };
}
