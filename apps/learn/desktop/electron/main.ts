import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createConstAgent, DEFAULT_MODELS, type AgentMessage } from "@const/agent";
import {
  startLoopbackAuthServer,
  stopLoopbackAuthServer,
  registerLinuxProtocolHandler,
} from "./auth-server.js";

// Load environment variables if present
try {
  const envCandidates = [
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(process.cwd(), ".env"),
  ];
  for (const envFile of envCandidates) {
    if (fs.existsSync(envFile) && (process as any).loadEnvFile) {
      (process as any).loadEnvFile(envFile);
      break;
    }
  }
} catch {
  // Ignore env loading errors
}

// Explicitly set app name and userData so ALL instances share the EXACT SAME lock directory
app.setName("Const Learn");
const userDataPath = path.join(app.getPath("appData"), "Const Learn");
app.setPath("userData", userDataPath);

// Request Single Instance Lock FIRST
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // SECOND INSTANCE: Exit IMMEDIATELY so no second window or task is spawned!
  app.quit();
  process.exit(0);
}

// Register custom protocol scheme: const-learn://
const PROTOCOL_NAME = "const-learn";

if (!app.isPackaged) {
  // In development, register with exact main script path so Windows launches with same config
  const mainScriptPath = path.resolve(__dirname, "main.js");
  app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [
    mainScriptPath,
  ]);
  registerLinuxProtocolHandler(process.execPath, mainScriptPath);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
  registerLinuxProtocolHandler(process.execPath);
}

let win: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;
let activeLoginSessionState: string | null = null;

function extractTokenFromUrl(rawUrl: string): string | undefined {
  try {
    const cleaned = rawUrl.replace(/["']/g, "").trim();
    const parsed = new URL(cleaned);
    const token = parsed.searchParams.get("token");
    if (token) return token;
  } catch {
    // ignore
  }
  // Fallback regex matching
  const match = rawUrl.match(/[?&]token=([^&"'\s]+)/);
  const matchedToken = match?.[1];
  return matchedToken ? decodeURIComponent(matchedToken) : undefined;
}

function sendDeepLinkToRenderer(url: string) {
  if (!win || !win.webContents) {
    pendingDeepLink = url;
    return;
  }
  const token = extractTokenFromUrl(url);
  console.log("[Electron Main] Extracted token from deep link:", token ? "YES" : "NO");
  win.webContents.send("auth:deep-link", { url, token });
}

// PRIMARY INSTANCE: Listen for second instance launches from deep links
app.on("second-instance", (_event, commandLine) => {
  console.log("[Electron Main] Second instance triggered with args:", commandLine);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  const rawArg = commandLine.find((arg) =>
    arg.includes(`${PROTOCOL_NAME}://`)
  );
  if (rawArg) {
    const match = rawArg.match(/const-learn:\/\/[^\s"']+/);
    const deepLinkUrl = match ? match[0] : rawArg;
    sendDeepLinkToRenderer(deepLinkUrl);
  }
});

  // Handle protocol on macOS
  app.on("open-url", (event, url) => {
    event.preventDefault();
    sendDeepLinkToRenderer(url);
  });

  function createWindow() {
    win = new BrowserWindow({
      title: "Const Learn",
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: "#09090b",
      show: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.webContents.on("console-message", (event) => {
      console.log(`[Renderer Console - L${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
    });

    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[Electron did-fail-load] Code ${errorCode}: ${errorDescription} (${validatedURL})`);
    });

    win.webContents.on("did-finish-load", () => {
      if (pendingDeepLink) {
        sendDeepLinkToRenderer(pendingDeepLink);
        pendingDeepLink = null;
      }
    });

    const devUrl =
      process.env.VITE_DEV_SERVER_URL ||
      process.env.ELECTRON_RENDERER_URL ||
      (!app.isPackaged ? "http://localhost:5173" : null);

    if (devUrl) {
      console.log("[Electron Main] Loading dev URL:", devUrl);
      win.loadURL(devUrl).catch((err) => {
        console.error("[Electron Main] Failed to load dev URL, loading dist/index.html:", err.message);
        win?.loadFile(path.join(__dirname, "../dist/index.html"));
      });
      if (process.env.OPEN_DEVTOOLS === "true") {
        win.webContents.openDevTools();
      }
    } else {
      const filePath = path.join(__dirname, "../dist/index.html");
      console.log("[Electron Main] Loading file:", filePath);
      win.loadFile(filePath);
    }
  }

  // IPC Handlers
  ipcMain.handle("dialog:open-directory", async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Pilih Folder Proyek Belajar",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("auth:open-external", async (_event, url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  // Dedicated Loopback Auth Login Handlers
  ipcMain.handle("auth:start-login", async (_event, options?: { accountsUrl?: string; action?: string }) => {
    try {
      const serverRes = await startLoopbackAuthServer((token, _refreshToken) => {
        sendDeepLinkToRenderer(`const-learn://callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(serverRes.state)}`);
      });

      // Bind active session state for strict cancellation and anti-replay
      activeLoginSessionState = serverRes.state;

      const accountsBase = (options?.accountsUrl || process.env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id").replace(/\/+$/, "");
      const actionParam = options?.action ? `&action=${encodeURIComponent(options.action)}` : "&prompt=select_account";
      const continueTarget = "const-learn://callback";
      const targetUrl = `${accountsBase}/?continue=${encodeURIComponent(continueTarget)}${actionParam}&app=learn&port=${serverRes.port}&state=${encodeURIComponent(serverRes.state)}`;

      console.log("[Electron Main] Starting auth, opening external browser:", targetUrl);
      await shell.openExternal(targetUrl);

      return {
        success: true,
        port: serverRes.port,
        state: serverRes.state,
        callbackUrl: serverRes.callbackUrl,
        authUrl: targetUrl,
      };
    } catch (err: any) {
      activeLoginSessionState = null;
      console.error("[Electron Main] Failed to start loopback auth server:", err);
      return {
        success: false,
        error: err.message || "Failed to initialize authentication server",
      };
    }
  });

  ipcMain.handle("auth:cancel-login", async () => {
    activeLoginSessionState = null;
    stopLoopbackAuthServer();
    console.log("[Electron Main] Authentication session cancelled by user");
    return { success: true };
  });

  // Agent IPC Handlers
  let activeAgent: any = null;

  ipcMain.handle("agent:get-models", async () => {
    const routerBaseUrl = (
      process.env.CONST_ROUTER_BASE_URL ||
      process.env.VITE_CONST_ROUTER_BASE_URL ||
      "https://router.const.web.id/v1"
    ).replace(/\/+$/, "");

    try {
      const endpoint = routerBaseUrl.endsWith("/models")
        ? routerBaseUrl
        : `${routerBaseUrl}/models`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const json: any = await res.json();
        if (json && Array.isArray(json.data) && json.data.length > 0) {
          return json.data.map((m: any) => ({
            id: m.id,
            displayName: m.display_name || m.name || m.id,
            provider: m.provider || "const",
            supportsThinking: Boolean(
              m.supports_thinking || m.supportsThinking || m.supports_reasoning
            ),
            thinkingLevels: m.thinking_levels || ["low", "medium", "high"],
            defaultThinkingLevel: m.default_thinking_level || "medium",
            maxOutputTokens: m.max_output_tokens || 128000,
            contextWindow: m.context_length || 1000000,
          }));
        }
      }
    } catch (err) {
      console.warn("[Electron Main] Failed to fetch remote models from router, using defaults:", err);
    }
    return DEFAULT_MODELS;
  });

  ipcMain.handle(
    "agent:send-message",
    async (
      _event,
      payload: {
        messages: AgentMessage[];
        model?: string;
        workspacePath?: string;
        authToken?: string;
      }
    ) => {
      const baseUrl =
        process.env.CONST_ROUTER_BASE_URL ||
        process.env.VITE_CONST_ROUTER_BASE_URL ||
        "https://router.const.web.id/v1";

      // Use user's SSO auth token as Bearer token to Const Router, or fall back to configured key
      const apiKey =
        payload.authToken ||
        process.env.CONST_ROUTER_API_KEY ||
        process.env.CONST_ENGINE_API_KEY ||
        "const-local-dev-key";

      const model = payload.model || process.env.CONST_DEFAULT_MODEL || "gemini-3.6-flash";
      const workspacePath = payload.workspacePath || process.cwd();

      activeAgent = createConstAgent({
        baseUrl,
        apiKey,
        model,
        workspacePath,
      });

      try {
        const updatedMessages = await activeAgent.run(
          payload.messages,
          (agentEvent: any) => {
            if (win && !win.isDestroyed()) {
              win.webContents.send("agent:stream-event", agentEvent);
            }
          }
        );
        return { success: true, messages: updatedMessages };
      } catch (err: any) {
        return { success: false, error: err.message };
      } finally {
        activeAgent = null;
      }
    }
  );

  ipcMain.handle("agent:abort", async () => {
    if (activeAgent) {
      activeAgent.abort();
      activeAgent = null;
      return true;
    }
    return false;
  });

  app.whenReady().then(() => {
    // Check if launched directly with a deep link on cold start
    const initialArg = process.argv.find((arg) =>
      arg.includes(`${PROTOCOL_NAME}://`)
    );
    if (initialArg) {
      const match = initialArg.match(/const-learn:\/\/[^\s"']+/);
      pendingDeepLink = match ? match[0] : initialArg;
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
