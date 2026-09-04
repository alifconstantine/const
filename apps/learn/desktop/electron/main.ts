import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createConstAgent, DEFAULT_MODELS, type AgentMessage } from "@const/agent";

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
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}

let win: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

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

    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[Renderer Console - L${level}] ${message} (${sourceId}:${line})`);
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
      if (!app.isPackaged) {
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

  // Agent IPC Handlers
  let activeAgent: any = null;

  ipcMain.handle("agent:get-models", async () => {
    return DEFAULT_MODELS;
  });

  ipcMain.handle(
    "agent:send-message",
    async (
      _event,
      payload: { messages: AgentMessage[]; model?: string; workspacePath?: string }
    ) => {
      const baseUrl =
        process.env.CONST_ENGINE_BASE_URL ||
        process.env.VITE_CONST_ENGINE_BASE_URL ||
        "https://engine.const.web.id/v1";
      const apiKey =
        process.env.CONST_ENGINE_API_KEY ||
        process.env.VITE_CONST_ENGINE_API_KEY ||
        "";
      const model = payload.model || process.env.CONST_DEFAULT_MODEL || "Const";
      const workspacePath = payload.workspacePath || process.cwd();

      if (!apiKey) {
        return {
          success: false,
          error:
            "Engine API key is not configured. Please set CONST_ENGINE_API_KEY in your .env file.",
        };
      }

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
