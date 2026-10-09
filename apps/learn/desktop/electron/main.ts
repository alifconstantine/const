import { app, BrowserWindow, shell, ipcMain, dialog, Menu, nativeTheme, protocol, net, session } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { Readable } from "node:stream";
import {
  createConstAgent,
  DEFAULT_MODELS,
  rollbackFileMutation,
  CONST_LEARN_TOOLS,
  COMPOSIO_TOOL_MAP,
  getComposioToolBySlugOrId,
  type AgentMessage,
  type FileMutationRecord,
  type NativeToolDefinition,
} from "@const/agent";
import {
  startLoopbackAuthServer,
  stopLoopbackAuthServer,
  registerLinuxProtocolHandler,
} from "./auth-server.js";

// Top-level crash guards to prevent unexpected termination or silent app exits
process.on("uncaughtException", (err) => {
  console.error("[Electron Main uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Electron Main unhandledRejection]", reason);
});

// Register privileged custom protocol for streaming local video artifacts
protocol.registerSchemesAsPrivileged([
  {
    scheme: "const-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

// Initialize ~/.const/learn directory hierarchy
const constHomeDir = path.join(os.homedir(), ".const");
const learnHomeDir = path.join(constHomeDir, "learn");
const learnWorkspacesDir = path.join(learnHomeDir, "workspaces");
const learnConfigFile = path.join(learnHomeDir, "config.json");
const rootConfigFile = path.join(constHomeDir, "config.json");

if (!fs.existsSync(learnHomeDir)) {
  try {
    fs.mkdirSync(learnHomeDir, { recursive: true });
    if (!fs.existsSync(learnConfigFile) && fs.existsSync(rootConfigFile)) {
      fs.copyFileSync(rootConfigFile, learnConfigFile);
    }
  } catch {}
}

if (!fs.existsSync(learnWorkspacesDir)) {
  try {
    fs.mkdirSync(learnWorkspacesDir, { recursive: true });
  } catch {}
}

// Optional runtime environment variables loader (e.g. from ~/.const/learn/.env or current working directory)
try {
  const envCandidates = [
    path.join(learnHomeDir, ".env"),
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

const composioUsageFile = path.join(learnHomeDir, "composio-usage.json");
const WEEKLY_TOOL_CALL_LIMIT = 300;

function getWeekWindowStart(date = new Date()): number {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

function getNextResetTimestamp(windowStart: number): number {
  return windowStart + 7 * 24 * 60 * 60 * 1000;
}

function loadComposioUsage(userId = "learn_desktop_user") {
  const now = Date.now();
  const currentWindowStart = getWeekWindowStart();
  const currentResetAt = getNextResetTimestamp(currentWindowStart);

  const defaultRecord = {
    limit: WEEKLY_TOOL_CALL_LIMIT,
    used: 0,
    remaining: WEEKLY_TOOL_CALL_LIMIT,
    windowStart: currentWindowStart,
    resetAt: currentResetAt,
    byTool: {} as Record<string, number>,
    recentCalls: [] as any[],
  };

  try {
    if (fs.existsSync(composioUsageFile)) {
      const raw = fs.readFileSync(composioUsageFile, "utf-8");
      const allUsages = JSON.parse(raw);
      const userUsage = allUsages[userId];
      if (userUsage) {
        if (!userUsage.windowStart || now >= userUsage.resetAt || userUsage.windowStart < currentWindowStart) {
          allUsages[userId] = defaultRecord;
          fs.writeFileSync(composioUsageFile, JSON.stringify(allUsages, null, 2), "utf-8");
          return defaultRecord;
        }
        return {
          ...defaultRecord,
          ...userUsage,
          limit: WEEKLY_TOOL_CALL_LIMIT,
          remaining: Math.max(0, WEEKLY_TOOL_CALL_LIMIT - (userUsage.used || 0)),
        };
      }
    }
  } catch {}

  return defaultRecord;
}

function saveComposioUsage(usage: any, userId = "learn_desktop_user") {
  try {
    let allUsages: Record<string, any> = {};
    if (fs.existsSync(composioUsageFile)) {
      try {
        allUsages = JSON.parse(fs.readFileSync(composioUsageFile, "utf-8"));
      } catch {}
    }
    allUsages[userId] = usage;
    fs.writeFileSync(composioUsageFile, JSON.stringify(allUsages, null, 2), "utf-8");
  } catch (err) {
    console.error("[saveComposioUsage Error]", err);
  }
}

function checkComposioLimit(userId = "learn_desktop_user") {
  const usage = loadComposioUsage(userId);
  if (usage.used >= usage.limit) {
    const resetDate = new Date(usage.resetAt).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
    return {
      allowed: false,
      used: usage.used,
      remaining: 0,
      resetAt: usage.resetAt,
      message: `Batas mingguan 300 tool call Composio telah tercapai. Kuota Anda akan di-reset otomatis pada ${resetDate}.`,
    };
  }
  return {
    allowed: true,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
  };
}

function recordComposioToolCall(toolSlug: string, success: boolean, userId = "learn_desktop_user", error?: string) {
  const current = loadComposioUsage(userId);
  const now = Date.now();
  const newUsed = current.used + 1;
  const newRemaining = Math.max(0, current.limit - newUsed);
  const updatedByTool = { ...current.byTool };
  updatedByTool[toolSlug] = (updatedByTool[toolSlug] || 0) + 1;

  const newCall = {
    id: `call_${now}_${Math.random().toString(36).substring(2, 7)}`,
    toolSlug,
    timestamp: now,
    success,
    error,
  };

  const updatedRecent = [newCall, ...(current.recentCalls || [])].slice(0, 30);

  const updated = {
    ...current,
    used: newUsed,
    remaining: newRemaining,
    lastUsedAt: now,
    byTool: updatedByTool,
    recentCalls: updatedRecent,
  };

  saveComposioUsage(updated, userId);
  return updated;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface InworldVoiceConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  voiceId: string;
  voiceName?: string;
  deliveryMode?: "BALANCED" | "STABLE" | "CREATIVE";
  speakingRate?: number;
  language?: string;
}

export interface VoiceConfig {
  activeProvider: "inworld" | string;
  inworld: InworldVoiceConfig;
}

export interface ImageConfig {
  activeProvider: string;
  providers: Record<string, { apiKey: string; baseUrl?: string; model?: string }>;
}

export interface UserConfig {
  activeModel: string;
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  voice?: VoiceConfig;
  image?: ImageConfig;
  customModels?: Array<{
    id: string;
    displayName: string;
    provider: string;
    baseUrl?: string;
    supportsThinking?: boolean;
    supportsTools?: boolean;
  }>;
}

const defaultUserConfig: UserConfig = {
  activeModel: "gemini-3.8-flash",
  activeProvider: "const",
  voice: {
    activeProvider: "inworld",
    inworld: {
      baseUrl: "https://api.inworld.ai",
      apiKey: process.env.INWORLD_API_KEY || "",
      model: "inworld-tts-2",
      voiceId: "Ashley",
      voiceName: "Ashley",
      deliveryMode: "BALANCED",
      speakingRate: 1.0,
      language: "id-ID",
    },
  },
  providers: {
    const: {
      name: "Const Router",
      baseUrl: process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1",
      apiKey: process.env.CONST_ROUTER_API_KEY || "",
    },
    openai: {
      name: "OpenAI",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
    },
    ollama: {
      name: "Ollama (Local)",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      apiKey: "ollama",
    },
  },
  customModels: [],
};

function loadUserConfig(): UserConfig {
  try {
    const targetFile = fs.existsSync(learnConfigFile) ? learnConfigFile : rootConfigFile;
    if (fs.existsSync(targetFile)) {
      const raw = fs.readFileSync(targetFile, "utf-8");
      const parsed = JSON.parse(raw);
      const merged: UserConfig = {
        ...defaultUserConfig,
        ...parsed,
        providers: {
          ...defaultUserConfig.providers,
          ...(parsed.providers || {}),
        },
        voice: {
          activeProvider:
            parsed.voice?.activeProvider || defaultUserConfig.voice?.activeProvider || "inworld",
          inworld: {
            ...defaultUserConfig.voice?.inworld,
            ...(parsed.voice?.inworld || {}),
          },
        },
      };

      if (!merged.activeProvider || merged.activeProvider === "const-engine") {
        merged.activeProvider = "const";
      }
      if (
        !merged.activeModel ||
        merged.activeModel === "Const" ||
        merged.activeModel.includes("(Const Router)") ||
        merged.activeModel.includes("(Native)")
      ) {
        merged.activeModel = "gemini-3.8-flash";
      }

      if (!merged.providers.const) {
        merged.providers.const = {
          name: "Const Router",
          baseUrl: process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1",
          apiKey: "",
        };
      } else {
        merged.providers.const.baseUrl =
          process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1";
      }

      return merged;
    }
  } catch (err) {
    console.error("[Electron Main] Failed to read config.json, using default:", err);
  }
  return defaultUserConfig;
}

function saveUserConfig(config: Partial<UserConfig>): UserConfig {
  const current = loadUserConfig();
  const merged: UserConfig = {
    ...current,
    ...config,
    providers: {
      ...current.providers,
      ...(config.providers || {}),
    },
    voice: config.voice
      ? {
          activeProvider:
            config.voice.activeProvider || current.voice?.activeProvider || "inworld",
          inworld: {
            ...(current.voice?.inworld || defaultUserConfig.voice?.inworld || {}),
            ...(config.voice.inworld || {}),
          },
        }
      : current.voice,
  };
  try {
    const configDir = path.dirname(learnConfigFile);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(learnConfigFile, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error("[Electron Main] Failed to write config.json:", err);
  }
  return merged;
}

let lastAuthToken: string = "";

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
    const isMac = process.platform === "darwin";
    const isDark = nativeTheme.shouldUseDarkColors;

    // Disable default native menu bar so it does not clutter the UI
    Menu.setApplicationMenu(null);

    const iconCandidate = process.platform === "win32"
      ? path.join(__dirname, "../build/icon.ico")
      : path.join(__dirname, "../build/icon.png");

    const appIcon = fs.existsSync(iconCandidate)
      ? iconCandidate
      : fs.existsSync(path.join(__dirname, "build/icon.png"))
      ? path.join(__dirname, "build/icon.png")
      : undefined;

    win = new BrowserWindow({
      title: "Const Learn",
      icon: appIcon,
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: isDark ? "#161616" : "#ffffff",
      titleBarStyle: isMac ? "hiddenInset" : "hidden",
      titleBarOverlay: isMac
        ? false
        : {
            color: isDark ? "#161616" : "#ffffff",
            symbolColor: isDark ? "#a1a1aa" : "#3f3f46",
            height: 36,
          },
      show: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true,
      },
    });

    win.on("maximize", () => {
      win?.webContents.send("window:maximized-change", true);
    });
    win.on("unmaximize", () => {
      win?.webContents.send("window:maximized-change", false);
    });

    nativeTheme.on("updated", () => {
      if (win && !win.isDestroyed()) {
        const dark = nativeTheme.shouldUseDarkColors;
        win.setBackgroundColor(dark ? "#161616" : "#ffffff");
        if (process.platform === "win32") {
          try {
            win.setTitleBarOverlay?.({
              color: dark ? "#161616" : "#ffffff",
              symbolColor: dark ? "#a1a1aa" : "#3f3f46",
              height: 36,
            });
          } catch {}
        }
        win.webContents.send("theme:system-changed", dark ? "dark" : "light");
      }
    });

    win.webContents.on("console-message", (event) => {
      console.log(`[Renderer Console - L${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
    });

    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[Electron did-fail-load] Code ${errorCode}: ${errorDescription} (${validatedURL})`);
    });

    win.webContents.on("render-process-gone", (_event, details) => {
      console.error(`[Electron] Renderer process gone! Reason: ${details.reason}, exitCode: ${details.exitCode}`);
    });

    win.on("unresponsive", () => {
      console.warn("[Electron] Window message pump became unresponsive!");
    });

    win.on("responsive", () => {
      console.log("[Electron] Window message pump is responsive again.");
    });

    win.webContents.on("did-finish-load", () => {
      if (pendingDeepLink) {
        sendDeepLinkToRenderer(pendingDeepLink);
        pendingDeepLink = null;
      }
    });

    // Intercept external link popups / target="_blank" and route to Learn's internal browser
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        if (win && !win.isDestroyed()) {
          win.webContents.send("app:open-browser-url", url);
        }
        return { action: "deny" };
      }
      return { action: "allow" };
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
  // Window control IPC handlers
  ipcMain.on("window:minimize", () => {
    win?.minimize();
  });

  ipcMain.on("window:maximize", () => {
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    win?.close();
  });

  ipcMain.handle("window:is-maximized", () => {
    return win?.isMaximized() || false;
  });

  ipcMain.on("window:toggle-fullscreen", () => {
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  ipcMain.on("window:toggle-devtools", () => {
    win?.webContents.toggleDevTools();
  });

  ipcMain.on("window:reload", () => {
    win?.webContents.reload();
  });

  ipcMain.handle("window:set-zoom-level", (_event, level: number) => {
    if (win) {
      win.webContents.setZoomLevel(level);
    }
  });

  ipcMain.handle("window:get-zoom-level", () => {
    return win?.webContents.getZoomLevel() ?? 0;
  });

  ipcMain.handle(
    "window:set-theme-mode",
    (_event, mode: "system" | "light" | "dark") => {
      try {
        if (mode === "system") {
          nativeTheme.themeSource = "system";
        } else if (mode === "dark") {
          nativeTheme.themeSource = "dark";
        } else if (mode === "light") {
          nativeTheme.themeSource = "light";
        }

        if (win && !win.isDestroyed()) {
          const dark = nativeTheme.shouldUseDarkColors;
          win.setBackgroundColor(dark ? "#161616" : "#ffffff");
          if (process.platform === "win32") {
            try {
              win.setTitleBarOverlay?.({
                color: dark ? "#161616" : "#ffffff",
                symbolColor: dark ? "#a1a1aa" : "#3f3f46",
                height: 36,
              });
            } catch {}
          }
        }
        return { isDark: nativeTheme.shouldUseDarkColors, themeSource: nativeTheme.themeSource };
      } catch (err) {
        console.error("[Electron Main] Failed to setThemeMode:", err);
        return { error: String(err) };
      }
    }
  );

  ipcMain.handle(
    "window:set-title-bar-overlay",
    (_event, options: { color?: string; symbolColor?: string; height?: number; themeMode?: "system" | "light" | "dark" }) => {
      try {
        if (win && !win.isDestroyed() && process.platform === "win32") {
          if (options?.themeMode === "system") {
            nativeTheme.themeSource = "system";
          } else if (options?.themeMode === "dark") {
            nativeTheme.themeSource = "dark";
          } else if (options?.themeMode === "light") {
            nativeTheme.themeSource = "light";
          }

          const shouldUseDark = nativeTheme.shouldUseDarkColors;
          const targetColor = options?.color || (shouldUseDark ? "#161616" : "#ffffff");
          const targetSymbol = options?.symbolColor || (shouldUseDark ? "#a1a1aa" : "#3f3f46");

          win.setBackgroundColor(targetColor);
          win.setTitleBarOverlay?.({
            color: targetColor,
            symbolColor: targetSymbol,
            height: options?.height || 36,
          });
        }
      } catch (err) {
        console.error("[Electron Main] Failed to setTitleBarOverlay:", err);
      }
    }
  );

  ipcMain.handle("updater:check", async () => {
    return {
      isPackaged: app.isPackaged,
      version: app.getVersion(),
    };
  });

  ipcMain.on("updater:quit-and-install", () => {
    try {
      console.log("[Updater] quit-and-install invoked. Relaunching app...");
      app.relaunch();
      app.exit(0);
    } catch (err) {
      console.error("[Updater] Failed to quit and install:", err);
    }
  });

  ipcMain.handle("dialog:open-directory", async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Select Project Workspace Folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:open-file", async (_event, options?: { multiple?: boolean }) => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Select Source Files",
      properties: options?.multiple !== false ? ["openFile", "multiSelections"] : ["openFile"],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths;
  });

  ipcMain.handle("auth:open-external", async (_event, url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle(
    "composio:get-auth-link",
    async (
      _event,
      payload: { toolkit: string; userId?: string; callbackUrl?: string; apiKey?: string }
    ) => {
      try {
        const apiKey =
          payload.apiKey ||
          process.env.COMPOSIO_API_KEY ||
          process.env.VITE_COMPOSIO_API_KEY ||
          "";

        if (!apiKey) {
          throw new Error("Composio API Key belum dikonfigurasi. Silakan periksa COMPOSIO_API_KEY di file .env.");
        }

        const userId = payload.userId || "learn_desktop_user";

        // 1. Create or resume session in Composio REST API v3.1
        const sessRes = await fetch("https://backend.composio.dev/api/v3.1/tool_router/session", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            manage_connections: { enable: true },
          }),
        });

        if (!sessRes.ok) {
          const errText = await sessRes.text();
          throw new Error(`Composio session creation failed (${sessRes.status}): ${errText}`);
        }

        const sessData = await sessRes.json();
        const sessionId = sessData.session_id;

        // 2. Request connect link for the specified toolkit
        const linkRes = await fetch(
          `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/link`,
          {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              toolkit: payload.toolkit,
              callback_url:
                payload.callbackUrl || "https://accounts.const.web.id/auth-success",
            }),
          }
        );

        if (!linkRes.ok) {
          const errText = await linkRes.text();
          throw new Error(`Composio link failed (${linkRes.status}): ${errText}`);
        }

        const linkData = await linkRes.json();
        const redirectUrl = linkData.redirect_url || linkData.redirectUrl;

        if (redirectUrl) {
          // Open the authorization link directly in the default system browser
          await shell.openExternal(redirectUrl);
          return {
            success: true,
            redirectUrl,
            sessionId,
            connectedAccountId: linkData.connected_account_id,
            linkToken: linkData.link_token,
          };
        }

        throw new Error("No redirect_url returned by Composio");
      } catch (err: any) {
        console.error("[Composio IPC get-auth-link Error]", err);
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle(
    "composio:disconnect-account",
    async (_event, payload: { accountId: string; apiKey?: string }) => {
      try {
        const apiKey =
          payload.apiKey ||
          process.env.COMPOSIO_API_KEY ||
          process.env.VITE_COMPOSIO_API_KEY ||
          "";

        if (!apiKey) return { success: false, error: "Missing API Key" };

        const delRes = await fetch(
          `https://backend.composio.dev/api/v3.1/connected_accounts/${payload.accountId}`,
          {
            method: "DELETE",
            headers: { "x-api-key": apiKey },
          }
        );
        return { success: delRes.ok };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle(
    "composio:get-connected-accounts",
    async (_event, payload?: { userId?: string; apiKey?: string }) => {
      try {
        const apiKey =
          payload?.apiKey ||
          process.env.COMPOSIO_API_KEY ||
          process.env.VITE_COMPOSIO_API_KEY ||
          "";

        if (!apiKey) return { success: false, items: [] };

        const userId = payload?.userId || "learn_desktop_user";
        const res = await fetch(
          `https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(
            userId
          )}`,
          {
            headers: { "x-api-key": apiKey },
          }
        );

        if (res.ok) {
          const data = await res.json();
          return { success: true, items: data.items || [] };
        }
        return { success: false, items: [] };
      } catch {
        return { success: false, items: [] };
      }
    }
  );

  ipcMain.handle(
    "composio:execute-tool",
    async (
      _event,
      payload: { toolSlug: string; arguments: any; userId?: string; apiKey?: string }
    ) => {
      const userId = payload.userId || "learn_desktop_user";

      // Enforce weekly 300 tool call limit
      const limitCheck = checkComposioLimit(userId);
      if (!limitCheck.allowed) {
        return { success: false, error: limitCheck.message };
      }

      try {
        const apiKey =
          payload.apiKey ||
          process.env.COMPOSIO_API_KEY ||
          process.env.VITE_COMPOSIO_API_KEY ||
          "";
        if (!apiKey) {
          throw new Error("COMPOSIO_API_KEY is not configured. Please set COMPOSIO_API_KEY in .env.");
        }

        // 1. Create or resume session
        const sessRes = await fetch("https://backend.composio.dev/api/v3.1/tool_router/session", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            manage_connections: { enable: true },
          }),
        });

        if (!sessRes.ok) {
          const errText = await sessRes.text();
          throw new Error(`Composio session creation failed (${sessRes.status}): ${errText}`);
        }

        const sessData = await sessRes.json();
        const sessionId = sessData.session_id;

        // 2. Execute tool
        const execRes = await fetch(
          `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/execute`,
          {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tool_slug: payload.toolSlug,
              arguments: payload.arguments,
            }),
          }
        );

        if (!execRes.ok) {
          const errText = await execRes.text();
          recordComposioToolCall(payload.toolSlug, false, userId, `HTTP ${execRes.status}: ${errText}`);
          throw new Error(`Composio execute failed for ${payload.toolSlug} (${execRes.status}): ${errText}`);
        }

        const data = await execRes.json();
        recordComposioToolCall(payload.toolSlug, true, userId);
        return { success: true, data: data.data || data };
      } catch (err: any) {
        console.error("[Composio execute-tool Error]", err);
        recordComposioToolCall(payload.toolSlug, false, userId, err?.message);
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle("composio:get-usage", async (_event, userId?: string) => {
    return loadComposioUsage(userId || "learn_desktop_user");
  });

  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return false;
    const res = await shell.openPath(targetPath);
    return res === "";
  });

  ipcMain.handle("workspace:read-file", async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      return await fs.promises.readFile(filePath, "utf-8");
    } catch (err: any) {
      return null;
    }
  });

  ipcMain.handle("workspace:read-media", async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const buf = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const mime =
        ext === "svg"
          ? "image/svg+xml"
          : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "application/octet-stream";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle("workspace:get-default-path", async (_event, learnId?: string) => {
    const folderName = learnId ? learnId.replace(/[^a-zA-Z0-9_-]/g, "_") : "default";
    const targetDir = path.join(learnWorkspacesDir, folderName);
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {}
    }
    return targetDir;
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

  // ---------------------------------------------------------------------------
  // Agent & Execution IPC Handlers (Router AI & Learn Preset Integration)
  // ---------------------------------------------------------------------------
  let activeAgent: any = null;
  const sessionAllowedMap = new Map<string, Set<string>>();
  let currentSessionMode: "ask_before_changes" | "full_access" = "ask_before_changes";
  const pendingQuestions = new Map<string, (answer: any) => void>();

  ipcMain.handle(
    "agent:update-mode",
    async (_event, { mode, learnId }: { mode: "ask_before_changes" | "full_access"; learnId?: string }) => {
      currentSessionMode = mode;
      if (activeAgent && typeof activeAgent.updateMode === "function") {
        activeAgent.updateMode(mode);
        return { success: true };
      }
      return { success: true, pending: true };
    }
  );

  ipcMain.handle(
    "agent:answer-question",
    async (_event, { toolCallId, answer }: { toolCallId: string; answer: any }) => {
      const resolver = pendingQuestions.get(toolCallId);
      if (resolver) {
        pendingQuestions.delete(toolCallId);
        resolver(answer);
        return true;
      }
      return false;
    }
  );

  ipcMain.handle(
    "agent:respond-approval",
    async (
      _event,
      payload: {
        approvalId: string;
        decision?: string;
        approved?: boolean;
        feedback?: string;
      }
    ) => {
      if (activeAgent && typeof activeAgent.resolveApproval === "function") {
        const decision =
          payload.decision || (payload.approved !== false ? "allow_once" : "deny");
        const resolved = activeAgent.resolveApproval(payload.approvalId, {
          approvalId: payload.approvalId,
          decision,
          approved: decision !== "deny",
          feedback: payload.feedback,
          timestamp: Date.now(),
        });
        return { success: true, resolved };
      }
      return { success: false, error: "Active agent not found or resolveApproval not supported" };
    }
  );

  ipcMain.handle("agent:get-models", async () => {
    const config = loadUserConfig();
    const provCfg =
      config.providers[config.activeProvider || "const"] || config.providers["const"];
    const routerBaseUrl = (
      provCfg?.baseUrl ||
      process.env.CONST_ROUTER_BASE_URL ||
      process.env.VITE_CONST_ROUTER_BASE_URL ||
      "https://router.const.web.id/v1"
    ).replace(/\/+$/, "");

    let apiKey = provCfg?.apiKey || "";
    if (!apiKey && lastAuthToken) {
      apiKey = lastAuthToken;
    }

    let remoteModels: any[] = [];
    try {
      const endpoint = routerBaseUrl.endsWith("/models")
        ? routerBaseUrl
        : `${routerBaseUrl}/models`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });
      if (res.ok) {
        const json: any = await res.json();
        if (json && Array.isArray(json.data) && json.data.length > 0) {
          remoteModels = json.data.map((m: any) => {
            const supportsThinking = Boolean(
              m.supports_thinking || m.supportsThinking || m.supports_reasoning
            );
            return {
              id: m.id,
              displayName: m.display_name || m.name || m.id,
              provider: m.provider || "const",
              providerName: m.provider_name || (m.provider === "const" ? "Const Router" : "Custom"),
              baseUrl: routerBaseUrl,
              supportsThinking,
              supportsTools: Boolean(m.supports_tools ?? true),
              thinkingLevels:
                m.thinking_levels ||
                m.thinkingLevels ||
                (supportsThinking ? ["low", "medium", "high"] : undefined),
              defaultThinkingLevel: m.default_thinking_level || m.defaultThinkingLevel || "medium",
              maxOutputTokens: m.max_output_tokens || m.maxOutputTokens || 128000,
              contextWindow:
                m.context_window ||
                m.contextWindow ||
                (m.id.includes("gemini") ? 1048576 : 128000),
            };
          });
        }
      }
    } catch (err) {
      console.warn("[Electron Main] Could not fetch remote models from router, using fallback:", err);
    }

    const baseModels = remoteModels.length > 0 ? remoteModels : DEFAULT_MODELS;

    const custom = (config.customModels || []).map((m) => ({
      id: m.id,
      displayName: m.displayName || m.id,
      provider: m.provider || "custom",
      providerName: config.providers[m.provider]?.name || "Custom",
      baseUrl: m.baseUrl || config.providers[m.provider]?.baseUrl,
      supportsThinking: Boolean(m.supportsThinking),
      supportsTools: m.supportsTools ?? true,
      thinkingLevels:
        (m as any).thinkingLevels ||
        (m.supportsThinking ? ["low", "medium", "high"] : undefined),
      defaultThinkingLevel: (m as any).defaultThinkingLevel || "medium",
      maxOutputTokens: (m as any).maxOutputTokens || 65536,
      contextWindow: (m as any).contextWindow || 128000,
    }));

    const seenIds = new Set<string>();
    const combined: any[] = [];
    for (const m of [...baseModels, ...custom]) {
      const rawId = m.id || "";
      let displayName = m.displayName || m.name || rawId;
      let supportsThinking = m.supportsThinking;
      let thinkingLevels = m.thinkingLevels;
      let defaultThinkingLevel = m.defaultThinkingLevel;

      if (
        rawId === "combo/auto" ||
        displayName === "Auto Router" ||
        displayName === "Auto (Best Available)" ||
        displayName === "combo/auto"
      ) {
        displayName = "combo/auto";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high"];
        defaultThinkingLevel = "medium";
      } else if (
        rawId === "combo/fast" ||
        displayName === "Fast (Low Latency)" ||
        displayName === "combo/fast"
      ) {
        displayName = "combo/fast";
        supportsThinking = false;
        thinkingLevels = undefined;
      } else if (
        rawId === "combo/coding" ||
        displayName === "Coding & Reasoning" ||
        displayName === "combo/coding"
      ) {
        displayName = "combo/coding";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high"];
        defaultThinkingLevel = "high";
      }

      const normId = rawId.toLowerCase().replace(/\s+/g, "-").trim();
      if (!normId || seenIds.has(normId)) continue;
      seenIds.add(normId);

      combined.push({
        ...m,
        displayName,
        supportsThinking,
        thinkingLevels,
        defaultThinkingLevel,
      });
    }

    return combined;
  });

  ipcMain.handle(
    "agent:send-message",
    async (
      _event,
      payload: {
        messages: AgentMessage[];
        model?: string;
        workspacePath?: string;
        learnId?: string;
        authToken?: string;
        mode?: "ask_before_changes" | "full_access";
        thinkingLevel?: string;
        maxOutputTokens?: number;
        systemPrompt?: string;
        temperature?: number;
        mcpServers?: any[];
      }
    ) => {
      const config = loadUserConfig();
      let model = payload.model || config.activeModel || "gemini-3.8-flash";
      if (model === "gemini-3.6-flash") {
        model = "gemini-3.8-flash";
      }

      if (payload.authToken) {
        lastAuthToken = payload.authToken;
      }

      // Match model to provider
      const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
      const modelDef = allModels.find((m) => m.id === model || m.displayName === model);
      const providerKey = modelDef?.provider || config.activeProvider || "const";
      const providerCfg =
        config.providers[providerKey] || config.providers["const"];

      let baseUrl =
        modelDef?.baseUrl ||
        providerCfg?.baseUrl ||
        process.env.CONST_ROUTER_BASE_URL ||
        process.env.VITE_CONST_ROUTER_BASE_URL ||
        "https://router.const.web.id/v1";

      let apiKey = providerCfg?.apiKey || "";
      if (!apiKey && (providerKey === "const" || providerKey === "const-engine")) {
        apiKey =
          payload.authToken ||
          lastAuthToken ||
          process.env.CONST_ROUTER_API_KEY ||
          process.env.CONST_ENGINE_API_KEY ||
          "const-local-dev-key";
      }

      let targetWorkspace = payload.workspacePath;
      if (!targetWorkspace || targetWorkspace === "Outside Project" || !fs.existsSync(targetWorkspace)) {
        const folderName = payload.learnId ? payload.learnId.replace(/[^a-zA-Z0-9_-]/g, "_") : "default";
        targetWorkspace = path.join(learnWorkspacesDir, folderName);
        if (!fs.existsSync(targetWorkspace)) {
          fs.mkdirSync(targetWorkspace, { recursive: true });
        }
      }

      // Collect active Composio tools from payload.mcpServers, strictly excluding Cloud Sandbox / Code Interpreter on Desktop
      const activeComposioTools: NativeToolDefinition[] = [];
      if (payload.mcpServers && Array.isArray(payload.mcpServers)) {
        for (const s of payload.mcpServers) {
          const id = (s.id || s.name || "").toLowerCase().replace(/[-_]/g, "");
          if (id.includes("cloudsandbox") || id.includes("codeinterpreter")) {
            continue; // Exclude Cloud Sandbox / Code Interpreter on Desktop as instructed
          }
          const matchedTool =
            COMPOSIO_TOOL_MAP[s.id] ||
            COMPOSIO_TOOL_MAP[s.toolkitSlug] ||
            getComposioToolBySlugOrId(s.id || s.toolkitSlug);
          if (matchedTool && !activeComposioTools.some((t) => t.function.name === matchedTool.function.name)) {
            activeComposioTools.push(matchedTool);
          }
        }
      }

      let effectiveSystemPrompt = payload.systemPrompt;
      if (payload.mcpServers && Array.isArray(payload.mcpServers) && payload.mcpServers.length > 0) {
        const mcpSummary = payload.mcpServers
          .filter((s: any) => {
            const id = (s.id || s.name || "").toLowerCase().replace(/[-_]/g, "");
            return !id.includes("cloudsandbox") && !id.includes("codeinterpreter");
          })
          .map((s: any) => {
            const detail = s.command
              ? `${s.command} ${s.args?.join(" ") || ""}`
              : s.url || s.description || (s.skills ? s.skills.join(", ") : "Active");
            return `- ${s.name} (${s.transport || "connector"}): ${detail}`;
          })
          .join("\n");
        if (mcpSummary) {
          effectiveSystemPrompt =
            (effectiveSystemPrompt || "") +
            `\n\n[CONNECTED MCP SERVERS & APP CONNECTORS]:\nYou have the following Model Context Protocol (MCP) servers and applications connected in your workspace:\n${mcpSummary}\nYou can interact with, query, and invoke these tools whenever relevant to user instructions.`;
        }
      }

      if (activeComposioTools.length > 0) {
        effectiveSystemPrompt =
          (effectiveSystemPrompt || "") +
          `\n\n[ACTIVE COMPOSIO CONNECTORS & SPECIALIZED TOOLS]:\n` +
          `You have active integrations for the following apps. When user instructions involve any of these services, you MUST invoke the corresponding tool call directly:\n` +
          activeComposioTools
            .map((t) => `- '${t.function.name}': ${t.function.description}`)
            .join("\n") +
          `\nDo not merely talk about doing it—execute the tool call so the user sees the active connector working process card!` +
          `\nWhen the student asks to create a presentation, slides, infographic, or visual document in Canva, invoke 'canva_mcp_generate_design' with the prompt/topic and designType='presentation'. The backend will automatically generate the slides and instantiate a real presentation in the student's Canva account, returning 'edit_url' and 'view_url'. After the tool completes, present the presentation title, number of slides, and clickable links clearly to the student!`;
      }

      const agentTools = [...CONST_LEARN_TOOLS, ...activeComposioTools];

      const sessionKey = payload.learnId || "default";
      const initialAllowedTools = sessionAllowedMap.get(sessionKey);

      activeAgent = createConstAgent({
        baseUrl,
        apiKey,
        model,
        workspacePath: targetWorkspace,
        preset: "learn",
        tools: agentTools,
        systemPrompt: effectiveSystemPrompt,
        mode: payload.mode || currentSessionMode || "ask_before_changes",
        initialAllowedTools,
        thinkingLevel: payload.thinkingLevel as any,
        maxOutputTokens: payload.maxOutputTokens ?? (modelDef as any)?.maxOutputTokens,
        onAskQuestion: (toolCallId, questionData) => {
          return new Promise((resolve) => {
            pendingQuestions.set(toolCallId, resolve);
            if (win && !win.isDestroyed()) {
              const extra = typeof questionData === "object" && questionData !== null && !Array.isArray(questionData)
                ? questionData
                : { questions: questionData };
              win.webContents.send("agent:stream-event", {
                type: "ask_question",
                toolCallId,
                ...extra,
              });
            }
          });
        },
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
        if (activeAgent) {
          const updatedAllowed = activeAgent.sessionAllowedToolsSet;
          if (updatedAllowed && updatedAllowed.size > 0) {
            sessionAllowedMap.set(sessionKey, updatedAllowed);
          }
        }
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

  ipcMain.handle(
    "agent:rollback-file",
    async (_event, payload: { record: FileMutationRecord }) => {
      return await rollbackFileMutation(payload.record);
    }
  );

  ipcMain.handle("agent:generate-title", async (_event, prompt: string, authToken?: string) => {
    try {
      const config = loadUserConfig();
      const baseUrl = config.providers["const"]?.baseUrl || "https://router.const.web.id/v1";
      const apiKey =
        authToken ||
        lastAuthToken ||
        config.providers["const"]?.apiKey ||
        process.env.CONST_ROUTER_API_KEY ||
        "";

      const endpoint = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.activeModel || "gemini-3.6-flash",
          messages: [
            {
              role: "user",
              content: `Summarize this learning inquiry into a concise 3 to 5 word title in Indonesian. Return ONLY the title text with no punctuation, no quotes, no extra words:\n\n${prompt.slice(0, 300)}`,
            },
          ],
          stream: false,
        }),
      });

      if (!res.ok) return null;
      const json: any = await res.json();
      const rawTitle = json.choices?.[0]?.message?.content;
      if (rawTitle) {
        return rawTitle.replace(/^["']|["']$/g, "").replace(/[.\n]/g, "").trim();
      }
      return null;
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "agent:generate-completion",
    async (
      _event,
      payload: {
        messages: { role: string; content: string }[];
        model?: string;
        authToken?: string;
        temperature?: number;
        timeoutMs?: number;
        requestId?: string;
      }
    ) => {
      try {
        const config = loadUserConfig();
        let model = payload.model || config.activeModel || "gemini-3.8-flash";
        if (model === "gemini-3.6-flash") {
          model = "gemini-3.8-flash";
        }

        const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
        const modelDef = allModels.find((m) => m.id === model || m.displayName === model);
        const providerKey = modelDef?.provider || config.activeProvider || "const";
        const normalizedKey =
          providerKey === "const-router" || providerKey === "const-engine" ? "const" : providerKey;
        const providerCfg =
          config.providers[providerKey] || config.providers[normalizedKey] || config.providers["const"];

        const baseUrl =
          modelDef?.baseUrl ||
          providerCfg?.baseUrl ||
          process.env.CONST_ROUTER_BASE_URL ||
          process.env.VITE_CONST_ROUTER_BASE_URL ||
          "https://router.const.web.id/v1";

        let apiKey = providerCfg?.apiKey || "";

        // Check customProviders if apiKey is empty in provider config
        if (!apiKey && Array.isArray((config as any).customProviders)) {
          const customProv = (config as any).customProviders.find(
            (cp: any) =>
              cp.apiKey &&
              (cp.id === providerKey ||
                cp.baseUrl?.replace(/\/+$/, "") === baseUrl.replace(/\/+$/, "") ||
                (baseUrl.includes("router.const.web.id") && cp.apiKey.startsWith("sk-const")))
          );
          if (customProv?.apiKey) {
            apiKey = customProv.apiKey;
          }
        }

        if (
          !apiKey &&
          (providerKey === "const" ||
            providerKey === "const-engine" ||
            providerKey === "const-router" ||
            baseUrl.includes("router.const.web.id"))
        ) {
          apiKey =
            payload.authToken ||
            lastAuthToken ||
            process.env.CONST_ROUTER_API_KEY ||
            process.env.CONST_ENGINE_API_KEY ||
            "";
        }

        const endpoint = baseUrl.endsWith("/chat/completions")
          ? baseUrl
          : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const controller = new AbortController();
        const maxTimeoutMs = payload.timeoutMs || 180000; // 3 minutes total ceiling
        const inactivityMs = 60000; // 60 seconds without any chunk/reasoning

        let inactivityTimer: NodeJS.Timeout | null = setTimeout(() => {
          controller.abort();
        }, inactivityMs);

        const resetInactivityTimer = () => {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            controller.abort();
          }, inactivityMs);
        };

        const hardTimeoutId = setTimeout(() => {
          controller.abort();
        }, maxTimeoutMs);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages: payload.messages,
            temperature: payload.temperature ?? 0.3,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          clearTimeout(hardTimeoutId);
          const errText = await res.text().catch(() => "");
          let parsedError = "";
          try {
            const errJson = JSON.parse(errText);
            parsedError = errJson?.error?.message || errJson?.message || "";
          } catch {}
          return {
            success: false,
            error: parsedError || `HTTP ${res.status}: ${errText.slice(0, 300)}`,
          };
        }

        if (!res.body) {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          clearTimeout(hardTimeoutId);
          throw new Error("Response body is null");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          resetInactivityTimer();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const delta = json.choices?.[0]?.delta;
              if (!delta) continue;

              // If thinking reasoning tokens arrive, keep connection alive
              if (delta.reasoning_content) {
                resetInactivityTimer();
              }

              if (delta.content) {
                resetInactivityTimer();
                accumulatedContent += delta.content;
                if (payload.requestId && win && !win.isDestroyed()) {
                  win.webContents.send("studio:stream-token", {
                    requestId: payload.requestId,
                    token: delta.content,
                  });
                }
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }

        if (inactivityTimer) clearTimeout(inactivityTimer);
        clearTimeout(hardTimeoutId);

        return { success: true, content: accumulatedContent };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to generate completion" };
      }
    }
  );

  ipcMain.handle("config:get", async () => {
    return loadUserConfig();
  });

  ipcMain.handle("config:save", async (_event, newConfig: Partial<UserConfig>) => {
    return saveUserConfig(newConfig);
  });

  ipcMain.handle("inworld:list-voices", async (_event, { apiKey }: { apiKey: string }) => {
    try {
      const cleanKey = (apiKey || "").trim();
      if (!cleanKey) {
        return { success: false, error: "API Key is required to fetch voices." };
      }
      let authHeader = cleanKey;
      if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
        if (authHeader.includes(":") && !authHeader.includes(" ")) {
          authHeader = `Basic ${Buffer.from(authHeader).toString("base64")}`;
        } else {
          authHeader = `Basic ${authHeader}`;
        }
      }
      const res = await fetch("https://api.inworld.ai/voices/v1/voices", {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Inworld Voices Error (${res.status}): ${errorText || res.statusText}`,
        };
      }
      const data = (await res.json()) as any;
      const rawVoices = data?.voices || [];
      const voices = rawVoices.map((v: any) => ({
        voiceId: v.voiceId || v.voice_id || v.id,
        displayName: v.displayName || v.display_name || v.name || v.voiceId || v.voice_id || v.id,
        langCode: v.langCode || v.lang_code || v.language || "en-US",
        gender: v.gender || "VOICE_GENDER_UNSPECIFIED",
        description: v.description || "",
        tags: v.tags || [],
      }));
      return { success: true, voices };
    } catch (err: any) {
      console.error("[Electron Main] Inworld list-voices failed:", err);
      return { success: false, error: err.message || "Failed to connect to Inworld AI" };
    }
  });

  ipcMain.handle(
    "inworld:test-voice",
    async (
      _event,
      payload: {
        apiKey: string;
        voiceId: string;
        model?: string;
        text?: string;
        deliveryMode?: string;
        speakingRate?: number;
      }
    ) => {
      try {
        const cleanKey = (payload.apiKey || "").trim();
        if (!cleanKey) {
          return { success: false, error: "API Key is required for testing voice." };
        }
        let authHeader = cleanKey;
        if (authHeader.toLowerCase().startsWith("bearer ")) {
          authHeader = `Basic ${authHeader.slice(7).trim()}`;
        } else if (!authHeader.toLowerCase().startsWith("basic ")) {
          if (authHeader.includes(":") && !authHeader.includes(" ")) {
            authHeader = `Basic ${Buffer.from(authHeader).toString("base64")}`;
          } else {
            authHeader = `Basic ${authHeader}`;
          }
        }
        const voiceId = payload.voiceId || "Ashley";
        const modelId = payload.model || "inworld-tts-2";
        const customText = (payload.text || "").trim();

        let audioBuffer: Buffer | null = null;
        let lastErrorMsg = "";

        // 1. If text is provided, perform real Text-to-Speech synthesis
        if (customText) {
          // 1a. Try Inworld native TTS endpoint (/tts/v1/voice) with MP3 encoding
          try {
            const synthRes = await fetch("https://api.inworld.ai/tts/v1/voice", {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: customText,
                voiceId: voiceId,
                modelId: modelId,
                audioConfig: {
                  audioEncoding: "MP3",
                },
              }),
            });

            if (synthRes.ok) {
              const contentType = synthRes.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                const json: any = await synthRes.json();
                const b64 = json.audioContent || json.audio_content || json.audio;
                if (b64) {
                  audioBuffer = Buffer.from(b64, "base64");
                }
              } else {
                const arrayBuf = await synthRes.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuf);
              }
            } else {
              const errBody = await synthRes.text();
              lastErrorMsg = `Inworld TTS (${synthRes.status}): ${errBody || synthRes.statusText}`;
              console.warn("[Electron Main] Inworld native TTS failed, trying OpenAI audio speech format...", lastErrorMsg);
            }
          } catch (synthErr: any) {
            lastErrorMsg = synthErr.message || "Synthesis request error";
            console.warn("[Electron Main] Inworld native TTS request threw:", synthErr);
          }

          // 1b. Fallback to OpenAI-compatible speech synthesis endpoint (/v1/audio/speech)
          if (!audioBuffer) {
            try {
              const openAiRes = await fetch("https://api.inworld.ai/v1/audio/speech", {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: modelId,
                  voice: voiceId,
                  input: customText,
                  response_format: "mp3",
                  speed: payload.speakingRate || 1.0,
                }),
              });

              if (openAiRes.ok) {
                const arrayBuf = await openAiRes.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuf);
              } else {
                const openAiErr = await openAiRes.text();
                lastErrorMsg = `Inworld Speech (${openAiRes.status}): ${openAiErr || openAiRes.statusText}`;
              }
            } catch (openAiCatch: any) {
              lastErrorMsg = openAiCatch.message || "OpenAI compatible speech request error";
            }
          }
        }

        // 2. If text was not provided or synthesis endpoints were unreachable, fallback to preview
        if (!audioBuffer && !customText) {
          try {
            const previewUrl = new URL("https://api.inworld.ai/tts/v1/voice:preview");
            previewUrl.searchParams.set("voice_id", voiceId);
            if (modelId) {
              previewUrl.searchParams.set("model_id", modelId);
            }

            const previewRes = await fetch(previewUrl.toString(), {
              headers: { Authorization: authHeader },
            });

            if (previewRes.ok) {
              const contentType = previewRes.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                const json: any = await previewRes.json();
                const b64 = json.audioContent || json.audio_content || json.audio;
                if (b64) {
                  audioBuffer = Buffer.from(b64, "base64");
                }
              } else {
                const arrayBuf = await previewRes.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuf);
              }
            } else {
              lastErrorMsg = `Voice Preview (${previewRes.status}): ${previewRes.statusText}`;
            }
          } catch (previewErr: any) {
            lastErrorMsg = previewErr.message || "Preview request error";
          }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
          return {
            success: false,
            error: lastErrorMsg || "Could not synthesize audio from Inworld AI.",
          };
        }

        const base64Audio = audioBuffer.toString("base64");
        const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;
        return { success: true, audioUrl: dataUrl, audioBase64: dataUrl };
      } catch (err: any) {
        console.error("[Electron Main] Inworld test-voice failed:", err);
        return { success: false, error: err.message || "Failed to generate audio sample" };
      }
    }
  );

  // ==================== VIDEO SUMMARY IPC HANDLERS ====================
  ipcMain.handle(
    "video:get-project-path",
    async (_event, payload: { learnId: string; artifactId: string }) => {
      const projDir = path.join(
        learnWorkspacesDir,
        payload.learnId || "default",
        "video_summaries",
        payload.artifactId || `art_${Date.now()}`
      );
      const audioDir = path.join(projDir, "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      return { success: true, projectPath: projDir, audioPath: audioDir };
    }
  );

  ipcMain.handle(
    "video:synthesize-scenes",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        apiKey: string;
        model?: string;
        voiceId?: string;
        language?: string;
        scenes: Array<{ sceneNumber: number; id: string; narrationText: string }>;
      }
    ) => {
      try {
        const cleanKey = (payload.apiKey || "").trim();
        let authHeader = cleanKey;
        if (authHeader) {
          if (authHeader.toLowerCase().startsWith("bearer ")) {
            authHeader = `Basic ${authHeader.slice(7).trim()}`;
          } else if (!authHeader.toLowerCase().startsWith("basic ")) {
            if (authHeader.includes(":") && !authHeader.includes(" ")) {
              authHeader = `Basic ${Buffer.from(authHeader).toString("base64")}`;
            } else {
              authHeader = `Basic ${authHeader}`;
            }
          }
        }

        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "video_summaries",
          payload.artifactId || `art_${Date.now()}`
        );
        const audioDir = path.join(projDir, "audio");
        if (!fs.existsSync(audioDir)) {
          fs.mkdirSync(audioDir, { recursive: true });
        }

        const modelId = payload.model || "inworld-tts-2";
        const voiceId = payload.voiceId || "Ashley";
        const sceneAudios: Array<{
          sceneNumber: number;
          id: string;
          filename: string;
          filePath: string;
          audioBase64?: string;
          durationSeconds: number;
        }> = [];

        for (const scene of payload.scenes) {
          const text = (scene.narrationText || "").trim();
          if (!text) continue;

          const filename = `scene_${scene.sceneNumber}.mp3`;
          const outPath = path.join(audioDir, filename);

          let audioBuffer: Buffer | null = null;
          if (authHeader) {
            try {
              const synthRes = await fetch("https://api.inworld.ai/tts/v1/voice", {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  text,
                  voiceId,
                  modelId,
                  audioConfig: { audioEncoding: "MP3" },
                }),
              });

              if (synthRes.ok) {
                const contentType = synthRes.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                  const json: any = await synthRes.json();
                  const b64 = json.audioContent || json.audio_content || json.audio;
                  if (b64) audioBuffer = Buffer.from(b64, "base64");
                } else {
                  audioBuffer = Buffer.from(await synthRes.arrayBuffer());
                }
              } else {
                const errText = await synthRes.text().catch(() => "");
                console.error(`[Electron Video] Scene ${scene.sceneNumber} TTS HTTP ${synthRes.status}:`, errText);
              }
            } catch (err) {
              console.warn(`[Electron Video] Scene ${scene.sceneNumber} TTS error:`, err);
            }
          }

          let measuredDur = 4.0;
          let sceneBase64: string | undefined = undefined;
          if (audioBuffer && audioBuffer.length > 0) {
            fs.writeFileSync(outPath, audioBuffer);
            sceneBase64 = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;
            // Probe audio duration via ffprobe or estimate from MP3 byte size (~128kbps = 16000 bytes/sec)
            try {
              const { exec } = await import("node:child_process");
              await new Promise<void>((resolveProbe) => {
                exec(
                  `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outPath}"`,
                  { encoding: "utf-8", timeout: 3000 },
                  (err, stdout) => {
                    if (!err && stdout) {
                      const durParsed = parseFloat(stdout.trim());
                      if (!isNaN(durParsed) && durParsed > 0.5) {
                        measuredDur = durParsed;
                      }
                    }
                    resolveProbe();
                  }
                );
              });
            } catch {
              measuredDur = Math.max(3.0, Math.round((audioBuffer.length / 16000) * 10) / 10);
            }
          } else {
            // Fallback word count if TTS failed
            const words = text.split(/\s+/).filter(Boolean).length;
            measuredDur = Math.max(3.5, Math.round((words / 2.3) * 10) / 10 + 0.8);
          }

          sceneAudios.push({
            sceneNumber: scene.sceneNumber,
            id: scene.id,
            filename,
            filePath: outPath,
            audioBase64: sceneBase64,
            durationSeconds: measuredDur,
          });
        }

        return { success: true, sceneAudios, projectPath: projDir, audioPath: audioDir };
      } catch (err: any) {
        console.error("[Electron Video] synthesize-scenes error:", err);
        return { success: false, error: err.message || "Failed to synthesize scenes" };
      }
    }
  );

  ipcMain.handle(
    "video:stitch-audio",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        sceneAudios: Array<{
          sceneNumber: number;
          filename: string;
          startMs: number;
        }>;
        totalDurationSeconds: number;
      }
    ) => {
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "video_summaries",
          payload.artifactId || `art_${Date.now()}`
        );
        const audioDir = path.join(projDir, "audio");
        const outMasterPath = path.join(audioDir, "full_narration.mp3");

        const validAudios = (payload.sceneAudios || []).filter((s) =>
          fs.existsSync(path.join(audioDir, s.filename))
        );

        if (validAudios.length === 0) {
          return { success: false, error: "No scene audio files found to stitch." };
        }

        if (validAudios.length === 1) {
          const singleSrc = path.join(audioDir, validAudios[0]!.filename);
          fs.copyFileSync(singleSrc, outMasterPath);
          const masterB64 = fs.readFileSync(outMasterPath).toString("base64");
          return {
            success: true,
            masterAudioPath: outMasterPath,
            masterAudioRelative: "audio/full_narration.mp3",
            masterAudioBase64: `data:audio/mp3;base64,${masterB64}`,
          };
        }

        // Build ffmpeg adelay + amix filter complex
        let inputsStr = "";
        let filterStr = "";
        let amixInputs = "";

        validAudios.forEach((scene, idx) => {
          const src = path.join(audioDir, scene.filename);
          inputsStr += `-i "${src}" `;
          const delay = Math.max(0, Math.round(scene.startMs));
          filterStr += `[${idx}:a]adelay=${delay}|${delay}[a${idx}]; `;
          amixInputs += `[a${idx}]`;
        });

        filterStr += `${amixInputs}amix=inputs=${validAudios.length}:duration=longest:dropout_transition=0:normalize=0[out]`;

        const totalSec = Math.max(1, payload.totalDurationSeconds).toFixed(2);
        const cmd = `ffmpeg -y ${inputsStr}-filter_complex "${filterStr}" -map "[out]" -t ${totalSec} "${outMasterPath}"`;

        const { exec } = await import("node:child_process");
        await new Promise<void>((resolveFfmpeg) => {
          exec(cmd, { timeout: 45000 }, (ffmpegErr) => {
            if (ffmpegErr) {
              console.warn("[Electron Video] ffmpeg stitch failed or unavailable, falling back to buffer concatenation:", ffmpegErr.message);
              try {
                const buffers: Buffer[] = validAudios.map((s) => fs.readFileSync(path.join(audioDir, s.filename)));
                fs.writeFileSync(outMasterPath, Buffer.concat(buffers));
              } catch (concatErr) {
                console.error("[Electron Video] Fallback concat error:", concatErr);
              }
            }
            resolveFfmpeg();
          });
        });

        const masterB64 = fs.readFileSync(outMasterPath).toString("base64");
        return {
          success: true,
          masterAudioPath: outMasterPath,
          masterAudioRelative: "audio/full_narration.mp3",
          masterAudioBase64: `data:audio/mp3;base64,${masterB64}`,
        };
      } catch (err: any) {
        console.error("[Electron Video] stitch-audio error:", err);
        return { success: false, error: err.message || "Failed to stitch audio" };
      }
    }
  );

  ipcMain.handle(
    "video:save-composition",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        htmlContent: string;
        hyperframesJson?: string;
      }
    ) => {
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "video_summaries",
          payload.artifactId || `art_${Date.now()}`
        );
        if (!fs.existsSync(projDir)) {
          fs.mkdirSync(projDir, { recursive: true });
        }

        const indexPath = path.join(projDir, "index.html");
        fs.writeFileSync(indexPath, payload.htmlContent, "utf-8");

        const hfConfigPath = path.join(projDir, "hyperframes.json");
        const defaultHfConfig = JSON.stringify(
          {
            $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
            media: { autoProxy: true },
            paths: {
              assets: "assets",
              blocks: "compositions",
              components: "compositions/components",
            },
            registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
          },
          null,
          2
        );
        fs.writeFileSync(hfConfigPath, payload.hyperframesJson || defaultHfConfig, "utf-8");

        const packageJsonPath = path.join(projDir, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(
              {
                name: `video-summary-${payload.artifactId}`,
                private: true,
                type: "module",
                scripts: {
                  check: "npx --yes hyperframes check",
                  preview: "npx --yes hyperframes preview",
                  render: "npx --yes hyperframes render",
                },
              },
              null,
              2
            ),
            "utf-8"
          );
        }

        return {
          success: true,
          projectPath: projDir,
          indexPath,
          hyperframesJsonPath: hfConfigPath,
        };
      } catch (err: any) {
        console.error("[Electron Video] save-composition error:", err);
        return { success: false, error: err.message || "Failed to save composition" };
      }
    }
  );

  ipcMain.handle(
    "video:render-mp4",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
      }
    ) => {
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "video_summaries",
          payload.artifactId || `art_${Date.now()}`
        );
        const outMp4Path = path.join(projDir, "video.mp4");

        if (!fs.existsSync(projDir)) {
          return { success: false, error: `Project directory does not exist: ${projDir}` };
        }

        const indexPath = path.join(projDir, "index.html");
        if (!fs.existsSync(indexPath)) {
          return { success: false, error: `Composition index.html not found in: ${projDir}` };
        }

        console.log("[Electron Video] Starting non-blocking async HyperFrames render in:", projDir);

        const { spawn } = await import("node:child_process");

        return await new Promise<{ success: boolean; mp4Path?: string; mp4Url?: string; error?: string }>((resolve) => {
          const isWin = process.platform === "win32";
          const cmd = isWin ? "npx.cmd" : "npx";
          const args = ["--yes", "hyperframes", "render", ".", "-o", outMp4Path];

          let stdoutData = "";
          let stderrData = "";

          const child = spawn(cmd, args, {
            cwd: projDir,
            shell: true,
            windowsHide: true,
            env: {
              ...process.env,
              PUPPETEER_DISABLE_HEADLESS_WARNING: "true",
            },
          });

          child.stdout?.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stdoutData += text;
            console.log("[HyperFrames Render]", text.trim());
            if (win && !win.isDestroyed()) {
              win.webContents.send("video:render-progress", {
                artifactId: payload.artifactId,
                chunk: text,
              });
            }
          });

          child.stderr?.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stderrData += text;
            console.warn("[HyperFrames Render stderr]", text.trim());
          });

          child.on("error", (err: any) => {
            console.error("[Electron Video] Spawn error:", err);
            resolve({ success: false, error: err?.message || "Failed to start render process" });
          });

          child.on("close", (code: number) => {
            console.log("[Electron Video] HyperFrames render process exited with code:", code);
            if (code === 0 && fs.existsSync(outMp4Path)) {
              resolve({
                success: true,
                mp4Path: outMp4Path,
                mp4Url: `const-media://file/${outMp4Path.replace(/\\/g, "/")}`,
              });
            } else {
              const errMsg = stderrData.trim() || stdoutData.trim() || `Render exited with code ${code}`;
              resolve({
                success: false,
                error: errMsg.slice(-400),
              });
            }
          });

          // 5 minute safeguard timeout
          const timer = setTimeout(() => {
            try {
              child.kill();
            } catch {}
            resolve({
              success: false,
              error: "Render timed out after 5 minutes",
            });
          }, 300000);

          child.on("exit", () => clearTimeout(timer));
        });
      } catch (err: any) {
        console.error("[Electron Video] render-mp4 error:", err);
        return { success: false, error: err.message || "Failed to render video" };
      }
    }
  );

  ipcMain.handle(
    "video:check-status",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        projectPath?: string;
      }
    ) => {
      try {
        let mp4Path = "";
        if (payload.projectPath && fs.existsSync(path.join(payload.projectPath, "video.mp4"))) {
          mp4Path = path.join(payload.projectPath, "video.mp4");
        } else if (payload.artifactId) {
          const projDir = path.join(
            learnWorkspacesDir,
            payload.learnId || "default",
            "video_summaries",
            payload.artifactId
          );
          if (fs.existsSync(path.join(projDir, "video.mp4"))) {
            mp4Path = path.join(projDir, "video.mp4");
          }
        }

        if (mp4Path && fs.existsSync(mp4Path)) {
          const stats = fs.statSync(mp4Path);
          if (stats.size > 1000) {
            return {
              success: true,
              exists: true,
              mp4Path,
              mp4Url: `const-media://file/${mp4Path.replace(/\\/g, "/")}`,
            };
          }
        }
        return { success: true, exists: false };
      } catch (err: any) {
        return { success: false, exists: false, error: err.message };
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Presentation Slides IPC Handlers (Native Harness Execution & PDF Export)
  // ---------------------------------------------------------------------------
  ipcMain.handle(
    "presentation:save",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        htmlContent: string;
      }
    ) => {
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "presentations",
          payload.artifactId || `pres_${Date.now()}`
        );
        if (!fs.existsSync(projDir)) {
          fs.mkdirSync(projDir, { recursive: true });
        }

        const htmlPath = path.join(projDir, "presentation.html");
        fs.writeFileSync(htmlPath, payload.htmlContent, "utf-8");

        return {
          success: true,
          projectPath: projDir,
          htmlPath,
          htmlUrl: `const-media://file/${htmlPath.replace(/\\/g, "/")}`,
        };
      } catch (err: any) {
        console.error("[Electron Presentation] save error:", err);
        return { success: false, error: err.message || "Failed to save presentation" };
      }
    }
  );

  ipcMain.handle(
    "presentation:export-pdf",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
        htmlPath?: string;
        htmlContent?: string;
      }
    ) => {
      let printWin: BrowserWindow | null = null;
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "presentations",
          payload.artifactId || `pres_${Date.now()}`
        );
        if (!fs.existsSync(projDir)) {
          fs.mkdirSync(projDir, { recursive: true });
        }

        let targetHtmlPath = payload.htmlPath;
        if (!targetHtmlPath || !fs.existsSync(targetHtmlPath)) {
          targetHtmlPath = path.join(projDir, "presentation.html");
          if (payload.htmlContent) {
            fs.writeFileSync(targetHtmlPath, payload.htmlContent, "utf-8");
          }
        }

        if (!fs.existsSync(targetHtmlPath)) {
          return { success: false, error: "presentation.html does not exist on disk." };
        }

        const pdfPath = path.join(projDir, "presentation.pdf");

        // Hidden window for Chromium 1920x1080 PDF render
        printWin = new BrowserWindow({
          show: false,
          width: 1920,
          height: 1080,
          webPreferences: {
            offscreen: true,
            webSecurity: false,
          },
        });

        await printWin.loadFile(targetHtmlPath);
        // Let Google fonts, styles, and scripts settle
        await new Promise((r) => setTimeout(r, 700));

        const pdfBuffer = await printWin.webContents.printToPDF({
          printBackground: true,
          landscape: true,
          pageSize: {
            width: 1920000,
            height: 1080000,
          },
          margins: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          },
        });

        fs.writeFileSync(pdfPath, pdfBuffer);

        return {
          success: true,
          pdfPath,
          pdfUrl: `const-media://file/${pdfPath.replace(/\\/g, "/")}`,
          sizeBytes: pdfBuffer.length,
        };
      } catch (err: any) {
        console.error("[Electron Presentation] export-pdf error:", err);
        return { success: false, error: err.message || "Failed to export presentation PDF" };
      } finally {
        if (printWin) {
          try {
            printWin.close();
          } catch {}
        }
      }
    }
  );

  ipcMain.handle(
    "presentation:check-status",
    async (
      _event,
      payload: {
        learnId: string;
        artifactId: string;
      }
    ) => {
      try {
        const projDir = path.join(
          learnWorkspacesDir,
          payload.learnId || "default",
          "presentations",
          payload.artifactId
        );
        const htmlPath = path.join(projDir, "presentation.html");
        const pdfPath = path.join(projDir, "presentation.pdf");

        const hasHtml = fs.existsSync(htmlPath);
        const hasPdf = fs.existsSync(pdfPath);

        return {
          success: true,
          hasHtml,
          hasPdf,
          htmlPath: hasHtml ? htmlPath : undefined,
          htmlUrl: hasHtml ? `const-media://file/${htmlPath.replace(/\\/g, "/")}` : undefined,
          pdfPath: hasPdf ? pdfPath : undefined,
          pdfUrl: hasPdf ? `const-media://file/${pdfPath.replace(/\\/g, "/")}` : undefined,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  // CheatSheet Export to PDF IPC Handler
  ipcMain.handle(
    "cheatsheet:export-pdf",
    async (_event, { title, htmlContent }: { title: string; htmlContent: string }) => {
      let printWin: BrowserWindow | null = null;
      try {
        const sanitized = (title || "cheatsheet")
          .replace(/[^a-zA-Z0-9_\-\s]/g, "")
          .trim()
          .replace(/\s+/g, "_");
        const defaultFileName = `${sanitized || "cheatsheet"}.pdf`;

        const { canceled, filePath } = await dialog.showSaveDialog({
          title: "Simpan Lembar Contekan (PDF)",
          defaultPath: defaultFileName,
          filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        });

        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }

        printWin = new BrowserWindow({
          show: false,
          width: 1200,
          height: 1600,
          webPreferences: {
            offscreen: true,
            webSecurity: false,
          },
        });

        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        await new Promise((r) => setTimeout(r, 600));

        const pdfBuffer = await printWin.webContents.printToPDF({
          printBackground: true,
          landscape: false,
          pageSize: "A4",
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4,
          },
        });

        fs.writeFileSync(filePath, pdfBuffer);

        return {
          success: true,
          filePath,
          sizeBytes: pdfBuffer.length,
        };
      } catch (err: any) {
        console.error("[Electron CheatSheet] export-pdf error:", err);
        return { success: false, error: err?.message || "Failed to export PDF" };
      } finally {
        if (printWin) {
          printWin.destroy();
          printWin = null;
        }
      }
    }
  );

  app.whenReady().then(() => {
    // Register protocol handler for streaming local video, audio, pdf, and html artifacts
    protocol.handle("const-media", (request) => {
      try {
        const urlObj = new URL(request.url);
        let filePath = decodeURIComponent(urlObj.pathname);
        if (process.platform === "win32" && filePath.startsWith("/")) {
          filePath = filePath.slice(1);
        }
        if (urlObj.host && urlObj.host !== "file") {
          filePath = `${urlObj.host}:${filePath}`;
        }
        filePath = path.normalize(filePath);

        if (!fs.existsSync(filePath)) {
          return new Response("Media not found", { status: 404 });
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".ogg": "video/ogg",
          ".mp3": "audio/mpeg",
          ".wav": "audio/wav",
          ".m4a": "audio/mp4",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".pdf": "application/pdf",
          ".html": "text/html",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";

        const rangeHeader = request.headers.get("Range") || request.headers.get("range");
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match && match[1]) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize || start > end) {
              return new Response(null, {
                status: 416,
                statusText: "Range Not Satisfiable",
                headers: {
                  "Content-Range": `bytes */${fileSize}`,
                  "Accept-Ranges": "bytes",
                },
              });
            }

            const chunkSize = end - start + 1;
            const nodeStream = fs.createReadStream(filePath, { start, end });
            const webStream = Readable.toWeb(nodeStream) as any;

            return new Response(webStream, {
              status: 206,
              statusText: "Partial Content",
              headers: {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(chunkSize),
                "Content-Type": contentType,
              },
            });
          }
        }

        const nodeStream = fs.createReadStream(filePath);
        const webStream = Readable.toWeb(nodeStream) as any;
        return new Response(webStream, {
          status: 200,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": String(fileSize),
            "Content-Type": contentType,
          },
        });
      } catch (err) {
        console.error("[const-media] Protocol fetch error:", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    });

    // Check if launched directly with a deep link on cold start
    const initialArg = process.argv.find((arg) =>
      arg.includes(`${PROTOCOL_NAME}://`)
    );
    if (initialArg) {
      const match = initialArg.match(/const-learn:\/\/[^\s"']+/);
      pendingDeepLink = match ? match[0] : initialArg;
    }

    // Automatically grant media/microphone permissions for seamless Voice Input without browser prompts
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === "media") {
        return callback(true);
      }
      callback(true);
    });

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
