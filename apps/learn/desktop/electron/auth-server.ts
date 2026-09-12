import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { execFile } from "node:child_process";

export interface AuthServerResult {
  port: number;
  state: string;
  callbackUrl: string;
}

let activeServer: http.Server | null = null;
let activeState: string | null = null;
let authTimeout: NodeJS.Timeout | null = null;
const activeSockets = new Set<net.Socket>();

const BASE_PORT = 24130;
const MAX_PORT_ATTEMPTS = 10;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

const ALLOWED_ORIGINS = new Set([
  "https://accounts.const.web.id",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

/**
 * Validates that an authentication token adheres to safe character sets and lengths.
 */
export function isValidAuthToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (trimmed.length < 10 || trimmed.length > 8192) return false;
  return /^[A-Za-z0-9_\-\.\+\=\|\~]+$/.test(trimmed);
}

/**
 * Attempts to find an available port and start the loopback HTTP server.
 */
export async function startLoopbackAuthServer(
  onTokenReceived: (token: string, refreshToken?: string) => void
): Promise<AuthServerResult> {
  // Stop existing server if any
  stopLoopbackAuthServer();

  // 32 cryptographically secure random bytes (64 hex chars)
  const state = crypto.randomBytes(32).toString("hex");
  activeState = state;

  return new Promise((resolve, reject) => {
    let currentPort = BASE_PORT;
    let attempts = 0;

    function tryBind() {
      if (attempts >= MAX_PORT_ATTEMPTS) {
        return reject(new Error(`Unable to bind loopback auth server on any port ${BASE_PORT}-${BASE_PORT + MAX_PORT_ATTEMPTS}`));
      }

      const server = http.createServer((req, res) => {
        const origin = req.headers.origin;

        // Security check: Whitelist CORS origins
        if (origin) {
          if (ALLOWED_ORIGINS.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.setHeader("Vary", "Origin");
          } else {
            console.warn("[AuthServer] Blocked cross-origin request from untrusted origin:", origin);
            res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Forbidden: Untrusted Origin");
            return;
          }
        }

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          const reqUrl = new URL(req.url || "", `http://127.0.0.1:${currentPort}`);
          if (reqUrl.pathname === "/callback") {
            const token = reqUrl.searchParams.get("token");
            const refreshToken = reqUrl.searchParams.get("refreshToken") || undefined;
            const returnedState = reqUrl.searchParams.get("state");

            // Strict CSRF Defense: Validate state parameter
            if (!returnedState || returnedState !== activeState) {
              console.warn("[AuthServer] State mismatch or missing in callback. Possible CSRF attempt:", {
                hasReturnedState: Boolean(returnedState),
              });
              res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("Forbidden: Invalid authentication state nonce");
              return;
            }

            // Invalidate state immediately after validation to prevent replay attacks
            activeState = null;

            // Token sanitization and format verification
            if (!token || !isValidAuthToken(token)) {
              res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("Bad Request: Missing or malformed token parameter");
              return;
            }

            if (refreshToken && !isValidAuthToken(refreshToken)) {
              res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("Bad Request: Malformed refreshToken parameter");
              return;
            }

            // Render modern monochrome success page matching Const Learn design
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Authenticated · Const Learn</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #09090b;
      color: #e4e4e7;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 24px;
      text-align: center;
      user-select: none;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 36px 40px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #27272a;
      border: 1px solid #3f3f46;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px auto;
      color: #4ade80;
      font-size: 22px;
    }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-family: monospace;
      background: #09090b;
      border: 1px solid #27272a;
      color: #a1a1aa;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">✓</div>
    <h1>Berhasil Masuk</h1>
    <p>Autentikasi akun Const berhasil diverifikasi. Tab ini dapat ditutup dan Anda dapat kembali ke aplikasi Const Learn.</p>
    <div class="badge"><span class="dot"></span>Session verified</div>
  </div>
  <script>
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 1200);
  </script>
</body>
</html>`;
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Connection": "close",
            });
            res.end(html);

            console.log("[AuthServer] Token successfully received via loopback server on port", currentPort);

            // Notify client and cleanup
            onTokenReceived(token, refreshToken);
            setTimeout(() => {
              stopLoopbackAuthServer();
            }, 500);
            return;
          }

          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(err?.message || "Internal server error");
        }
      });

      server.on("connection", (socket) => {
        activeSockets.add(socket);
        socket.once("close", () => {
          activeSockets.delete(socket);
        });
      });

      server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          attempts++;
          currentPort++;
          tryBind();
        } else {
          reject(err);
        }
      });

      server.listen(currentPort, "127.0.0.1", () => {
        activeServer = server;
        const callbackUrl = `http://127.0.0.1:${currentPort}/callback`;
        console.log(`[AuthServer] Listening for auth callback on ${callbackUrl}`);

        // Set safety timeout to auto-close server if user never completes login
        authTimeout = setTimeout(() => {
          console.log("[AuthServer] Authentication timed out after 5 minutes, stopping server");
          stopLoopbackAuthServer();
        }, AUTH_TIMEOUT_MS);

        resolve({
          port: currentPort,
          state,
          callbackUrl,
        });
      });
    }

    tryBind();
  });
}

/**
 * Stops the active loopback authentication server and clears any active timeout.
 */
export function stopLoopbackAuthServer() {
  if (authTimeout) {
    clearTimeout(authTimeout);
    authTimeout = null;
  }
  activeState = null;

  if (activeServer) {
    try {
      if (typeof (activeServer as any).closeAllConnections === "function") {
        (activeServer as any).closeAllConnections();
      }
    } catch {}

    for (const socket of activeSockets) {
      try {
        socket.destroy();
      } catch {}
    }
    activeSockets.clear();

    try {
      activeServer.close();
    } catch {}
    activeServer = null;
  }
  console.log("[AuthServer] Loopback auth server stopped and sockets destroyed");
}

/**
 * Ensures ~/.local/share/applications/const-learn.desktop exists on Linux
 * and is registered as the default handler for x-scheme-handler/const-learn.
 */
export function registerLinuxProtocolHandler(execPath: string, mainScriptPath?: string) {
  if (process.platform !== "linux") return;

  try {
    const appsDir = path.join(os.homedir(), ".local", "share", "applications");
    if (!fs.existsSync(appsDir)) {
      fs.mkdirSync(appsDir, { recursive: true });
    }

    const desktopFilePath = path.join(appsDir, "const-learn.desktop");

    const execCommand = mainScriptPath
      ? `"${execPath}" "${mainScriptPath}" %u`
      : `"${execPath}" %u`;

    const desktopContent = `[Desktop Entry]
Name=Const Learn
Comment=Const Learn Educational & Research Agent
Exec=${execCommand}
Terminal=false
Type=Application
Icon=const-learn
Categories=Education;Development;Utility;
MimeType=x-scheme-handler/const-learn;
StartupWMClass=Const Learn
`;

    let shouldWrite = true;
    if (fs.existsSync(desktopFilePath)) {
      const existing = fs.readFileSync(desktopFilePath, "utf-8");
      if (existing.includes(execPath)) {
        shouldWrite = false;
      }
    }

    if (shouldWrite) {
      fs.writeFileSync(desktopFilePath, desktopContent, "utf-8");
      console.log("[AuthServer] Wrote Linux desktop file at:", desktopFilePath);

      execFile("xdg-mime", ["default", "const-learn.desktop", "x-scheme-handler/const-learn"], (err) => {
        if (err) {
          console.warn("[AuthServer] Failed to register xdg-mime handler:", err.message);
        } else {
          console.log("[AuthServer] Successfully registered const-learn xdg-mime handler on Linux");
        }
        execFile("update-desktop-database", [appsDir], (dbErr) => {
          if (dbErr) {
            console.warn("[AuthServer] Failed to update desktop database:", dbErr.message);
          }
        });
      });
    }
  } catch (err) {
    console.warn("[AuthServer] Error while registering Linux protocol handler:", err);
  }
}
