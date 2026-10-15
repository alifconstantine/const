import http from "node:http";
import net from "node:net";

export const CANVA_LOOPBACK_PORT = 24135;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

let activeCanvaServer: http.Server | null = null;
const activeCanvaSockets = new Set<net.Socket>();
let canvaAuthTimeout: NodeJS.Timeout | null = null;
let activeExpectedState: string | null = null;

export function stopCanvaLoopbackServer() {
  if (canvaAuthTimeout) {
    clearTimeout(canvaAuthTimeout);
    canvaAuthTimeout = null;
  }
  activeExpectedState = null;
  if (activeCanvaServer) {
    for (const socket of activeCanvaSockets) {
      socket.destroy();
    }
    activeCanvaSockets.clear();
    try {
      activeCanvaServer.close();
    } catch {}
    activeCanvaServer = null;
  }
}

export function startCanvaLoopbackServer(
  onResult: (result: { success: boolean; code?: string; state?: string; error?: string }) => void,
  expectedState?: string
): Promise<{ port: number; callbackUrl: string }> {
  stopCanvaLoopbackServer();
  activeExpectedState = expectedState || null;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers allowing web bridge (e.g. accounts.const.web.id) to notify loopback
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        const reqUrl = new URL(req.url || "", `http://127.0.0.1:${CANVA_LOOPBACK_PORT}`);
        const pathname = reqUrl.pathname.toLowerCase();

        if (pathname === "/canva/callback" || pathname === "/callback") {
          const code = reqUrl.searchParams.get("code");
          const state = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error") || reqUrl.searchParams.get("error_description");

          // Validate state if provided
          if (activeExpectedState && state && state !== activeExpectedState) {
            console.warn("[CanvaAuthServer] State mismatch in callback:", { state, activeExpectedState });
          }

          const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Canva Terhubung · Const Learn</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #09090b;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
      user-select: none;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 36px 32px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #22d3ee;
      font-size: 24px;
    }
    h1 { font-size: 20px; font-weight: 600; color: #fff; margin-bottom: 8px; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 20px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      background: #09090b;
      border: 1px solid #27272a;
      color: #a1a1aa;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #22d3ee; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>${error ? "Otorisasi Gagal" : "Canva Berhasil Terhubung"}</h1>
    <p>${error ? `Terjadi kesalahan: ${error}` : "Otorisasi akun Canva Anda berhasil diverifikasi. Tab ini dapat ditutup dan Anda dapat kembali ke aplikasi Const Learn."}</p>
    <div class="badge"><span class="dot"></span>OAuth PKCE Verified</div>
  </div>
  <script>
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 1500);
  </script>
</body>
</html>`;

          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Connection": "close",
          });
          res.end(html);

          if (error) {
            onResult({ success: false, error });
          } else if (code) {
            onResult({ success: true, code, state: state || undefined });
          } else {
            onResult({ success: false, error: "Tidak ada kode otorisasi pada URL kembalian." });
          }

          setTimeout(() => {
            stopCanvaLoopbackServer();
          }, 1000);
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err?.message || "Internal error");
      }
    });

    server.on("connection", (socket) => {
      activeCanvaSockets.add(socket);
      socket.on("close", () => activeCanvaSockets.delete(socket));
    });

    server.once("error", (err: any) => {
      console.error("[CanvaAuthServer] Failed to bind port:", err);
      reject(err);
    });

    server.listen(CANVA_LOOPBACK_PORT, "127.0.0.1", () => {
      activeCanvaServer = server;
      console.log(`[CanvaAuthServer] Canva loopback server listening on http://127.0.0.1:${CANVA_LOOPBACK_PORT}`);

      canvaAuthTimeout = setTimeout(() => {
        console.warn("[CanvaAuthServer] Canva auth timed out after 5 minutes.");
        onResult({ success: false, error: "Waktu otorisasi Canva habis (timeout)." });
        stopCanvaLoopbackServer();
      }, AUTH_TIMEOUT_MS);

      resolve({
        port: CANVA_LOOPBACK_PORT,
        callbackUrl: `http://127.0.0.1:${CANVA_LOOPBACK_PORT}/canva/callback`,
      });
    });
  });
}
