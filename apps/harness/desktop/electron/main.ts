import { getModelContextLimit } from "../src/lib/model-context";
import { isTelemetryEvent } from "../src/lib/chat-telemetry";
import { BROWSER_PARTITION, applyBrowserContentsPolicy, applyBrowserSessionPolicy } from "./browser/guest-policy";
import { app, BrowserWindow, shell, ipcMain, dialog, nativeTheme, powerSaveBlocker, Notification, protocol, net, session, safeStorage } from "electron";
import { pathToFileURL } from "node:url";

// Register custom protocol scheme for safe local file serving (images/attachments in brain)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "const-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  createConstAgent,
  rollbackFileMutation,
  globalTaskManager,
  globalSubAgentManager,
  registerGlobalBrowserToolHandler,
  registerGlobalComputerToolHandler,
  listMemoryFiles,
  readMemoryFile,
  saveMemoryFile,
  deleteMemoryFile,
  type MemoryFileInfo,
  type ConstAgentMessage as AgentMessage,
  type FileMutationRecord,
  extractPdfText,
  extractDocumentText,
} from "@const/agent";
import { ConversationDatabase, type ConversationRecord } from "./database";
import {
  startLoopbackAuthServer,
  stopLoopbackAuthServer,
  registerLinuxProtocolHandler,
  isValidAuthToken,
} from "./auth-server";
import {
  ScheduledTasksManager,
  type ScheduledTaskItem,
  type ScheduledTaskSchedule,
} from "./scheduled-tasks";
import { browserController, type ControlState } from "./browser-controller";
import { computerController } from "./computer/computer-controller";
import { marketplaceService } from "./marketplace-service";
import { McpStore } from "./mcp/store";
import { McpService } from "./mcp/service";
import type { McpSaveInput } from "../src/lib/mcp/types";
import { fetchSkillsCatalog } from "../src/lib/skills/skills-sh-service";
import { WINDOWS_APP_ID, loadWindowBranding, applyWindowBranding } from "./window-branding";
import { INTELLIGENCE_UI_PROMPT } from "../src/components/intelligence-ui/prompt";
import { ROUTER_DEFAULT_MODELS as DEFAULT_MODELS, DEFAULT_ROUTER_MODEL_ID } from "../src/lib/router-models";
import { modelDisplayName, uniqueModelsById, resolveModelId } from "../src/lib/model-identity";
import { createAgentEventForwarder } from "../src/lib/agent-errors";
import { AgentSessionRegistry } from "./agent-sessions";
import { selectAgentAutosaveMessages } from "./agent-history";
import { SideSteeringReceipts } from "./side-steering-receipts";
import { remoteDaemon } from "./remote-daemon";

registerGlobalBrowserToolHandler(async (toolName, args) => {
  const config = loadUserConfig();
  if (config.enableBrowserUse === false) {
    return {
      result: "Browser Use is currently disabled in Settings. Please turn on 'Enable Browser Use' in Settings > Computer Use to allow browser automation tools.",
      isError: true,
    };
  }
  return browserController.executeTool(toolName, args);
});

registerGlobalComputerToolHandler(async (toolName, args, context) => {
  const config = loadUserConfig();
  if (config.enableComputerUse === false) {
    return {
      result: "Computer Use is currently disabled in Settings. Please turn on 'Enable Computer Use' in Settings > Computer Use to allow desktop automation tools.",
      isError: true,
    };
  }
  return computerController.executeTool(toolName, args, context);
});

app.on("before-quit", () => computerController.shutdown());
app.on("before-quit", () => { void remoteDaemon.stop(); });

// Initialize ~/.const/harness directory hierarchy (.gemini/antigravity aligned)
const constHomeDir = path.join(os.homedir(), ".const");
const harnessHomeDir = path.join(constHomeDir, "harness");
const constProjectsDir = path.join(harnessHomeDir, "projects");
const constBrainDir = path.join(harnessHomeDir, "brain");
const constConversationsDir = path.join(harnessHomeDir, "conversations");
const constConfigFile = path.join(harnessHomeDir, "config.json");
const mcpService = new McpService(new McpStore(harnessHomeDir, {
  encrypt: (value) => {
    if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("storage");
    return safeStorage.encryptString(value);
  },
  decrypt: (value) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("storage");
    return safeStorage.decryptString(value);
  },
}), () => {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("mcp:changed");
}, (url) => shell.openExternal(url));
let mcpShuttingDown = false;
app.on("before-quit", (event) => {
  if (mcpShuttingDown) return;
  event.preventDefault(); mcpShuttingDown = true;
  void mcpService.invalidate().finally(() => app.quit());
});

// Legacy root config fallback / migration
const rootConfigFile = path.join(constHomeDir, "config.json");
if (!fs.existsSync(constConfigFile) && fs.existsSync(rootConfigFile)) {
  try {
    if (!fs.existsSync(harnessHomeDir)) fs.mkdirSync(harnessHomeDir, { recursive: true });
    fs.copyFileSync(rootConfigFile, constConfigFile);
  } catch {}
}

const conversationDb = new ConversationDatabase(harnessHomeDir);
const scheduledTasksDir = path.join(harnessHomeDir, "automations");
let scheduledTasksManager: ScheduledTasksManager | null = null;

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface UserConfig {
  activeModel: string;
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  customModels?: Array<{
    id: string;
    displayName: string;
    provider: string;
    baseUrl?: string;
    supportsThinking?: boolean;
    supportsTools?: boolean;
    inputTypes?: string[];
    contextWindow?: number;
  }>;
  workspaceMemoryEnabled?: boolean;
  enableComputerUse?: boolean;
  enableBrowserUse?: boolean;
  defaultProjectLocation?: string;
  language?: string;
  defaultPermission?: "ask_before_changes" | "full_access" | "request_review";
  queueMode?: "queue" | "steer";
  taskNotifications?: boolean;
  autoCheckUpdates?: boolean;
  launchOnStartup?: boolean;
  soundAlerts?: boolean;
  personalizationWorkRole?: string;
  personalizationCustomInstructions?: string;
}

const defaultUserConfig: UserConfig = {
  activeModel: DEFAULT_ROUTER_MODEL_ID,
  activeProvider: "const",
  workspaceMemoryEnabled: true,
  enableComputerUse: true,
  enableBrowserUse: true,
  defaultProjectLocation: "",
  language: "en",
  defaultPermission: "ask_before_changes",
  queueMode: "queue",
  taskNotifications: true,
  autoCheckUpdates: true,
  launchOnStartup: false,
  soundAlerts: true,
  personalizationWorkRole: "",
  personalizationCustomInstructions: "",
  providers: {
    const: {
      name: "Const",
      baseUrl: process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1",
      apiKey: process.env.CONST_ROUTER_API_KEY || "",
    },
    "const-engine": {
      name: "Const",
      baseUrl: process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1",
      apiKey: process.env.CONST_ENGINE_API_KEY || "",
    },
    openai: {
      name: "OpenAI",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
    },
    deepseek: {
      name: "DeepSeek",
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY || "",
    },
    ollama: {
      name: "Ollama (Local)",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      apiKey: "ollama",
    },
    custom: {
      name: "Custom (OpenAI-compatible)",
      baseUrl: "",
      apiKey: "",
    },
  },
  customModels: [],
};

function loadUserConfig(): UserConfig {
  try {
    if (fs.existsSync(constConfigFile)) {
      const raw = fs.readFileSync(constConfigFile, "utf-8");
      const parsed = JSON.parse(raw);
      const merged: UserConfig = {
        ...defaultUserConfig,
        ...parsed,
        providers: {
          ...defaultUserConfig.providers,
          ...(parsed.providers || {}),
        },
      };

      // Seamlessly normalize legacy "Const" / "const-engine" to native Const Router
      if (merged.activeProvider === "const-engine" || !merged.activeProvider) {
        merged.activeProvider = "const";
      }
      if (
        merged.activeModel === "Const" ||
        merged.activeModel.includes("(Const Router)") ||
        merged.activeModel.includes("(Native)") ||
        merged.activeModel === "gemini-3.6-flash" ||
        !merged.activeModel
      ) {
        merged.activeModel = "gemini-3.8-flash";
      }

      // Ensure native Const provider points to router.const.web.id
      if (!merged.providers.const) {
        merged.providers.const = {
          name: "Const Router",
          baseUrl: process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1",
          apiKey: "",
        };
      } else {
        merged.providers.const.baseUrl = process.env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1";
      }

      computerController.setEnabled(merged.enableComputerUse !== false);
    return merged;
    }
  } catch (err) {
    console.error("[Electron Main] Failed to read config.json, using default:", err);
  }
  try {
    fs.writeFileSync(constConfigFile, JSON.stringify(defaultUserConfig, null, 2), "utf-8");
  } catch {}
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
  };
  if (config.enableComputerUse !== undefined) {
    computerController.setEnabled(config.enableComputerUse);
  }
  for (const [name, enabled] of [["browser-use", config.enableBrowserUse], ["computer-use", config.enableComputerUse]] as const) {
    if (enabled === undefined) continue;
    const installed = marketplaceService.listPlugins().installed.find((plugin) => plugin.name === name && plugin.scope === "user");
    if (installed) marketplaceService.setEnabled(installed.id, enabled);
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("marketplace:changed");
  }
  if (config.launchOnStartup !== undefined) {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(config.launchOnStartup),
      });
    } catch (err) {
      console.warn("[Electron Main] Could not set login item settings:", err);
    }
  }
  try {
    fs.writeFileSync(constConfigFile, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error("[Electron Main] Failed to write config.json:", err);
  }
  return merged;
}

try {
  for (const dir of [constProjectsDir, constBrainDir, constConversationsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Ensure config.json exists
  loadUserConfig();

  const outsideProjectPath = path.join(constProjectsDir, "outside-of-project.json");
  if (!fs.existsSync(outsideProjectPath)) {
    fs.writeFileSync(
      outsideProjectPath,
      JSON.stringify(
        {
          id: "outside-of-project",
          name: "Outside of Project",
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
  }
} catch {
  // Ignore filesystem initialization errors
}

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

// Explicitly set app name, AUMID and userData
app.setName("Const Harness");
// Windows identifies taskbar/pinned/jump-list entries by AppUserModelID, not by the
// window icon. Unpackaged Electron inherits its identity from electron.exe, so the
// taskbar resolves whatever icon Windows cached for electron.exe (the generic
// Electron logo). Use a stable identity here and explicit taskbar/relaunch
// properties on each window below.
if (process.platform === "win32") {
  app.setAppUserModelId(WINDOWS_APP_ID);
}
const userDataPath = path.join(app.getPath("appData"), "Const Harness");
app.setPath("userData", userDataPath);

// Request Single Instance Lock FIRST
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Register custom protocol scheme: const-harness://
const PROTOCOL_NAME = "const-harness";

if (!app.isPackaged) {
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
let lastAuthToken: string | null = null;
const activeTerminals = new Map<string, { process: ChildProcess; cwd: string }>();

function extractTokenFromUrl(rawUrl: string): string | undefined {
  try {
    const cleaned = rawUrl.replace(/["']/g, "").trim();
    const parsed = new URL(cleaned);
    let token = parsed.searchParams.get("token");
    if (token) {
      token = decodeURIComponent(token).trim().replace(/\/+$/, "");
      if (isValidAuthToken(token)) return token;
    }
  } catch {
    // ignore
  }
  const match = rawUrl.match(/[?&]token=([^&"'\s]+)/);
  const matchedToken = match?.[1];
  if (matchedToken) {
    const decoded = decodeURIComponent(matchedToken).trim().replace(/\/+$/, "");
    if (isValidAuthToken(decoded)) return decoded;
  }
  return undefined;
}

function extractStateFromUrl(rawUrl: string): string | undefined {
  try {
    const cleaned = rawUrl.replace(/["']/g, "").trim();
    const parsed = new URL(cleaned);
    const state = parsed.searchParams.get("state");
    if (state) return decodeURIComponent(state).trim().replace(/\/+$/, "");
  } catch {
    // ignore
  }
  const match = rawUrl.match(/[?&]state=([^&"'\s]+)/);
  return match?.[1] ? decodeURIComponent(match[1]).trim().replace(/\/+$/, "") : undefined;
}

function sendDeepLinkToRenderer(url: string) {
  if (!win || !win.webContents) {
    pendingDeepLink = url;
    return;
  }
  const token = extractTokenFromUrl(url);
  const returnedState = extractStateFromUrl(url);

  console.log("[Electron Main] Processing auth callback. Active session:", activeLoginSessionState ? "ACTIVE" : "NONE", "Token present:", Boolean(token));

  // If a valid token is found, deliver it immediately without false cancellations
  if (token) {
    if (activeLoginSessionState && returnedState) {
      const cleanReturned = returnedState.replace(/\/+$/, "").trim();
      const cleanActive = activeLoginSessionState.replace(/\/+$/, "").trim();
      if (cleanReturned !== cleanActive) {
        console.warn("[Electron Main] Notice: state mismatch on token delivery (accepted):", { cleanReturned, cleanActive });
      }
    }
    // Consume session state upon valid token delivery
    activeLoginSessionState = null;
    lastAuthToken = token;
    win.webContents.send("auth:deep-link", { url, token, cancelled: false });
    return;
  }

  // If no token was found and no session is active, reject
  if (!activeLoginSessionState) {
    console.warn("[Electron Main] Rejected callback: no token and no active login session.");
    win.webContents.send("auth:deep-link", {
      url,
      token: undefined,
      cancelled: true,
      error: "Authentication request was cancelled.",
    });
    return;
  }

  // If returnedState mismatch on empty token callback
  if (returnedState && activeLoginSessionState) {
    const cleanReturned = returnedState.replace(/\/+$/, "").trim();
    const cleanActive = activeLoginSessionState.replace(/\/+$/, "").trim();
    if (cleanReturned !== cleanActive) {
      console.warn("[Electron Main] Rejected callback: state mismatch on empty callback.");
      win.webContents.send("auth:deep-link", {
        url,
        token: undefined,
        cancelled: true,
        error: "Invalid authentication state.",
      });
      return;
    }
  }
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
    const match = rawArg.match(/const-harness:\/\/[^\s"']+/);
    const deepLinkUrl = match ? match[0] : rawArg;
    sendDeepLinkToRenderer(deepLinkUrl);
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  sendDeepLinkToRenderer(url);
});

function createWindow() {
  const isDark = nativeTheme.shouldUseDarkColors;
  const branding = loadWindowBranding();

  win = new BrowserWindow({
    title: "Const Harness",
    icon: branding.shellIconPath || branding.windowIcon,
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 400,
    frame: false,
    backgroundColor: isDark ? "#0c0c0c" : "#ffffff",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  applyWindowBranding(win, branding);
  // Publish the taskbar button only after its branding has been configured.
  win.show();

  browserController.setParentWindow(win);
  win.on("closed", () => {
    void remoteDaemon.stop();
    browserController.setParentWindow(null);
    win = null;
  });

  // Intercept and prevent in-app navigation that would replace the Harness UI with full-screen websites.
  // Instead, route external web links to the sidepanel browser tab.
  win.webContents.on("will-navigate", (event, navigationUrl) => {
    if (
      process.env.VITE_DEV_SERVER_URL &&
      navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL)
    ) {
      return;
    }
    if (navigationUrl.startsWith("file://")) {
      return;
    }

    event.preventDefault();
    if (navigationUrl.startsWith("http://") || navigationUrl.startsWith("https://")) {
      win?.webContents.send("browser:open-tab-request", { url: navigationUrl, newTab: true });
    }
  });

  // Intercept target="_blank" and window.open to open in the sidepanel browser tab instead of a full new window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      win?.webContents.send("browser:open-tab-request", { url, newTab: true });
    }
    return { action: "deny" };
  });

  win.on("maximize", () => {
    win?.webContents.send("window:maximized-change", true);
  });
  win.on("unmaximize", () => {
    win?.webContents.send("window:maximized-change", false);
  });

  nativeTheme.on("updated", () => {
    if (win && !win.isDestroyed()) {
      win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0c0c0c" : "#ffffff");
      win.webContents.send("theme:system-changed", nativeTheme.shouldUseDarkColors ? "dark" : "light");
    }
  });

  // Enable F12/Ctrl+Shift+I for DevTools, F5/Ctrl+R for reload
  win.webContents.on("before-input-event", (event, input) => {
    if (
      (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) &&
      input.type === "keyDown"
    ) {
      win?.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (
      (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) &&
      input.type === "keyDown"
    ) {
      win?.webContents.reload();
      event.preventDefault();
    }
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron Main] Failed to load URL: ${validatedURL} (${errorCode}: ${errorDescription})`);
    if (process.env.VITE_DEV_SERVER_URL && validatedURL.includes(process.env.VITE_DEV_SERVER_URL)) {
      console.log("[Electron Main] Retrying dev server load in 1000ms...");
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.loadURL(process.env.VITE_DEV_SERVER_URL!);
        }
      }, 1000);
    }
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    void remoteDaemon.stop();
    console.error("[Electron Main] Render process gone:", details);
    if (details.reason !== "clean-exit") {
      win?.reload();
    }
  });

  win.webContents.on("did-finish-load", () => {
    if (pendingDeepLink) {
      sendDeepLinkToRenderer(pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.on("web-contents-created", (_event, contents) => {
  applyBrowserContentsPolicy(contents, (url) => browserController.assertNavigationAllowed(url));
});

app.whenReady().then(() => {
  // Default-deny permission policy for the embedded browser partition.
  // Registered here (ready-scoped) because session.fromPartition() throws before app ready.
  applyBrowserSessionPolicy(session.fromPartition(BROWSER_PARTITION), (url) => browserController.assertNavigationAllowed(url));

  // Register const-file:// protocol handler for rendering local media & brain attachments safely
  protocol.handle("const-file", (request) => {
    try {
      let rawPath = decodeURIComponent(request.url.replace(/^const-file:\/\//, ""));
      if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(rawPath)) {
        rawPath = rawPath.slice(1);
      }
      if (fs.existsSync(rawPath)) {
        return net.fetch(pathToFileURL(rawPath).toString());
      }
      return new Response("File not found", { status: 404 });
    } catch (err: any) {
      return new Response(err?.message || "Failed to load file", { status: 500 });
    }
  });

  // Window control handlers
  ipcMain.on("window:minimize", () => {
    win?.minimize();
  });
  ipcMain.on("window:maximize", () => {
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on("window:close", () => {
    win?.close();
  });
  ipcMain.handle("window:is-maximized", () => {
    return win?.isMaximized() ?? false;
  });
  ipcMain.handle("window:set-zoom-factor", (_event, factor: number) => {
    if (win && !win.isDestroyed() && typeof factor === "number" && factor > 0) {
      win.webContents.setZoomFactor(factor);
    }
  });
  ipcMain.handle("window:get-zoom-factor", () => {
    if (win && !win.isDestroyed()) {
      return win.webContents.getZoomFactor();
    }
    return 1.0;
  });
  ipcMain.handle("window:set-theme-mode", (_event, mode: "system" | "light" | "dark") => {
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
        win.setBackgroundColor(dark ? "#0c0c0c" : "#ffffff");
      }
      return { isDark: nativeTheme.shouldUseDarkColors, themeSource: nativeTheme.themeSource };
    } catch (err) {
      console.error("[Electron Main] Failed to setThemeMode:", err);
      return { error: String(err) };
    }
  });

  // Dialog handler
  ipcMain.handle("dialog:open-directory", async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Select Project Folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Open external URL handler
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
        sendDeepLinkToRenderer(`const-harness://callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(serverRes.state)}`);
      });

      // Bind active session state for strict cancellation and anti-replay
      activeLoginSessionState = serverRes.state;

      const accountsBase = (options?.accountsUrl || process.env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id").replace(/\/+$/, "");
      const actionParam = options?.action ? `&action=${encodeURIComponent(options.action)}` : "&prompt=select_account";
      const continueTarget = "const-harness://callback";
      const targetUrl = `${accountsBase}/?continue=${encodeURIComponent(continueTarget)}${actionParam}&app=harness&port=${serverRes.port}&state=${encodeURIComponent(serverRes.state)}`;

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
  // Config & Model Management IPC Handlers
  // ---------------------------------------------------------------------------
  ipcMain.handle("computer:get-capabilities", async () => {
    try {
      return await computerController.getCapabilities();
    } catch (err: any) {
      return { error: err.message || String(err) };
    }
  });

  ipcMain.handle("computer:list-apps", async () => {
    try {
      const apps = await computerController.listApps();
      return Array.isArray(apps) ? apps : [];
    } catch (err: any) {
      console.warn("[Computer] Failed to list apps:", err);
      return [];
    }
  });

  ipcMain.handle("config:get", async () => {
    return loadUserConfig();
  });

  ipcMain.handle("config:save", async (_event, newConfig: Partial<UserConfig>) => {
    return saveUserConfig(newConfig);
  });

  // ---------------------------------------------------------------------------
  // Memory Management IPC Handlers
  // ---------------------------------------------------------------------------
  ipcMain.handle(
    "memory:list",
    async (
      _event,
      options?: { scope?: "project" | "global" | "all"; workspacePath?: string }
    ) => {
      const scope = options?.scope || "all";
      return await listMemoryFiles(options?.workspacePath, scope);
    }
  );

  ipcMain.handle("memory:read", async (_event, filePath: string) => {
    return await readMemoryFile(filePath);
  });

  ipcMain.handle("memory:save", async (_event, filePath: string, content: string) => {
    let target = filePath;
    if (filePath.startsWith(".const") || !path.isAbsolute(filePath)) {
      target = path.join(os.homedir(), filePath);
    } else if (filePath.startsWith("C:\\Users\\.const") || filePath.startsWith("/home/.const")) {
      const parts = filePath.split(".const");
      target = path.join(os.homedir(), ".const", parts[1] || "");
    }
    await saveMemoryFile(target, content);
    return true;
  });

  ipcMain.handle("memory:delete", async (_event, filePath: string) => {
    return await deleteMemoryFile(filePath);
  });

  ipcMain.handle("memory:open-in-folder", async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle("memory:get-config", async () => {
    const config = loadUserConfig();
    return {
      workspaceMemoryEnabled: config.workspaceMemoryEnabled ?? true,
    };
  });

  ipcMain.handle(
    "memory:save-config",
    async (_event, memoryConfig: { workspaceMemoryEnabled?: boolean }) => {
      const current = loadUserConfig();
      const updated = saveUserConfig({
        ...current,
        workspaceMemoryEnabled:
          memoryConfig.workspaceMemoryEnabled !== undefined
            ? memoryConfig.workspaceMemoryEnabled
            : current.workspaceMemoryEnabled ?? true,
      });
      return {
        workspaceMemoryEnabled: updated.workspaceMemoryEnabled ?? true,
      };
    }
  );

  // ---------------------------------------------------------------------------
  // Marketplace & Skills Management IPC Handlers
  const capabilitiesChanged = () => {
    void mcpService.invalidate();
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("marketplace:changed");
  };
  const handleMcp = (channel: string, handler: (...args: any[]) => unknown) => {
    ipcMain.handle(channel, async (event, ...args) => {
      const ownWindow = BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender);
      if (!ownWindow || event.senderFrame !== event.sender.mainFrame) throw new Error("invalid");
      try { return await handler(...args); }
      catch (error) {
        const code = error instanceof Error && ["auth", "storage", "busy", "connection", "setup"].includes(error.message) ? error.message : "invalid";
        throw new Error(code);
      }
    });
  };
  handleMcp("mcp:list", (workspace?: string) => mcpService.list(workspace));
  handleMcp("mcp:app-view", (id: string) => mcpService.appView(id));
  handleMcp("mcp:app-call", (id: string, name: string, args: Record<string, unknown>, approved?: boolean) => mcpService.appCall(id, name, args, approved));
  handleMcp("mcp:app-context", (id: string, text: string) => mcpService.appContext(id, text));
  handleMcp("mcp:diagram-save", (id: string, scene: any) => mcpService.saveDiagram(id, scene));
  handleMcp("mcp:diagram-read", (filePath: string) => mcpService.readDiagram(filePath));
  handleMcp("mcp:save", (input: McpSaveInput) => mcpService.save(input));
  handleMcp("mcp:remove", (id: string, workspace?: string) => mcpService.remove(id, workspace));
  handleMcp("mcp:override", (id: string, workspace: string) => mcpService.override(id, workspace));
  handleMcp("mcp:connect", async (id: string, workspace?: string) => { await mcpService.connect(id, workspace); });
  handleMcp("mcp:authenticate", async (id: string, workspace?: string, language?: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    await mcpService.authenticate(id, workspace, language);
    if (window && !window.isDestroyed()) { window.show(); window.focus(); }
  });
  handleMcp("mcp:disconnect", (id: string, workspace?: string) => mcpService.disconnectAccount(id, workspace));
  ipcMain.handle("marketplace:list-plugins", (_event, workspacePath?: string) => marketplaceService.listPlugins(workspacePath));
  ipcMain.handle("marketplace:install-plugin", (_event, payload: { name: string; scope?: "user" | "workspace"; workspacePath?: string }) => {
    marketplaceService.installPlugin(payload.name, "user", payload.workspacePath);
    capabilitiesChanged();
  });
  ipcMain.handle("marketplace:uninstall-plugin", (_event, payload: { id: string; workspacePath?: string }) => {
    marketplaceService.uninstallPlugin(payload.id, payload.workspacePath);
    capabilitiesChanged();
  });
  ipcMain.handle("marketplace:set-enabled", (_event, payload: { id: string; enabled: boolean; workspacePath?: string }) => {
    const plugin = marketplaceService.listPlugins(payload.workspacePath).installed.find((item) => item.id === payload.id);
    marketplaceService.setEnabled(payload.id, payload.enabled, payload.workspacePath);
    if (plugin?.scope === "user" && plugin.name === "browser-use") saveUserConfig({ enableBrowserUse: payload.enabled });
    if (plugin?.scope === "user" && plugin.name === "computer-use") saveUserConfig({ enableComputerUse: payload.enabled });
    capabilitiesChanged();
  });
  // ---------------------------------------------------------------------------
  ipcMain.handle("marketplace:list-installed", async (_event, workspacePath?: string) => {
    return marketplaceService.listInstalledSkills(workspacePath);
  });

  ipcMain.handle(
    "marketplace:install-skill",
    async (
      event,
      payload: { slug: string; source?: string; skillId?: string; scope?: "user" | "workspace"; workspacePath?: string; requestId?: string }
    ) => {
      const installed = await marketplaceService.installSkill(payload.slug, payload.scope, payload.workspacePath, payload.source, payload.skillId, payload.requestId, (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("marketplace:install-progress", progress);
      });
      if (installed) capabilitiesChanged();
      return installed;
    }
  );

  ipcMain.handle("marketplace:cancel-skill-install", (_event, requestId: string) => marketplaceService.cancelSkillInstall(requestId));
  ipcMain.handle("marketplace:search-skills", (_event, query: string) => fetchSkillsCatalog(typeof query === "string" ? query.slice(0, 200) : ""));
  ipcMain.handle("marketplace:preview-remote-skill", (_event, source: string, skillId: string) => marketplaceService.previewRemoteSkill(source, skillId));

  ipcMain.handle(
    "marketplace:uninstall-skill",
    async (
      _event,
      payload: { id: string; workspacePath?: string }
    ) => {
      const removed = marketplaceService.uninstallSkill(payload.id, payload.workspacePath);
      if (removed) capabilitiesChanged();
      return removed;
    }
  );

  ipcMain.handle(
    "marketplace:open-skills-folder",
    async (
      _event,
      payload?: { workspacePath?: string; scope?: "user" | "workspace" }
    ) => {
      return marketplaceService.openSkillsFolder(payload?.workspacePath, payload?.scope);
    }
  );

  ipcMain.handle(
    "marketplace:get-skill-content",
    async (_event, slug: string, workspacePath?: string) => {
      return marketplaceService.getSkillContent(slug, workspacePath);
    }
  );

  ipcMain.handle("agent:get-models", async () => {
    const config = loadUserConfig();
    const provCfg = config.providers["const"] || config.providers["const-engine"];
    const routerBaseUrl = (provCfg?.baseUrl || "https://router.const.web.id/v1").replace(/\/+$/, "");
    const apiKey = provCfg?.apiKey || "";

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
              displayName: modelDisplayName(m.id, m.display_name || m.name),
              provider: m.provider || "const",
              providerName: m.provider_name || (m.provider === "const" ? "Const" : "Custom"),
              baseUrl: routerBaseUrl,
              supportsThinking,
              supportsTools: Boolean(m.supports_tools ?? true),
              thinkingLevels: m.thinking_levels || m.thinkingLevels || (supportsThinking ? ["low", "medium", "high", "xhigh", "max"] : undefined),
              defaultThinkingLevel: m.default_thinking_level || m.defaultThinkingLevel || "medium",
              maxOutputTokens: m.max_output_tokens || m.maxOutputTokens || 128000,
              contextWindow: getModelContextLimit(m.id, m.context_length ?? m.contextLength ?? m.context_window ?? m.contextWindow),
            };
          });
        }
      }
    } catch (err) {
      console.warn("[Electron Main] Could not fetch remote models from router, using fallback:", err);
    }

    const baseModels = remoteModels.length > 0 ? remoteModels : DEFAULT_MODELS;

    const custom = (config.customModels || []).map((m) => {
      const supportsThinking = Boolean(m.supportsThinking);
      return {
        id: m.id,
        displayName: m.displayName || m.id,
        provider: m.provider || "custom",
        providerName: config.providers[m.provider]?.name || "Custom",
        baseUrl: m.baseUrl || config.providers[m.provider]?.baseUrl,
        supportsThinking,
        supportsTools: m.supportsTools ?? true,
        thinkingLevels: (m as any).thinkingLevels || (supportsThinking ? ["low", "medium", "high", "xhigh", "max"] : undefined),
        defaultThinkingLevel: (m as any).defaultThinkingLevel || "medium",
        maxOutputTokens: (m as any).maxOutputTokens || 65536,
        contextWindow: getModelContextLimit(m.id, (m as any).contextWindow ?? (m as any).context_window ?? 128000),
      };
    });

    const combined: any[] = [];
    for (const m of [...baseModels, ...custom]) {
      const rawId = m.id || "";
      let displayName = modelDisplayName(rawId, m.displayName || m.name);

      // Align combo display names and thinking properties with official router definitions
      let supportsThinking = m.supportsThinking;
      let thinkingLevels = m.thinkingLevels;
      let defaultThinkingLevel = m.defaultThinkingLevel;

      if (rawId === "combo/auto" || displayName === "Auto Router" || displayName === "Auto (Best Available)" || displayName === "combo/auto") {
        displayName = "combo/auto";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high", "xhigh", "max"];
        defaultThinkingLevel = "medium";
      } else if (rawId === "combo/fast" || displayName === "Low-Latency Fast Chain" || displayName === "Fast (Low Latency)" || displayName === "combo/fast") {
        displayName = "combo/fast";
        supportsThinking = false;
        thinkingLevels = undefined;
      } else if (rawId === "combo/coding" || displayName === "Coding Agent Chain" || displayName === "Coding & Reasoning" || displayName === "combo/coding") {
        displayName = "combo/coding";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high", "xhigh", "max"];
        defaultThinkingLevel = "high";
      }

      const item = {
        ...m,
        displayName,
        supportsThinking,
        thinkingLevels,
        defaultThinkingLevel,
      };

      combined.push(item);
    }
    return uniqueModelsById(combined);
  });

  // Dedicated lightweight title generation that never conflicts with activeAgent
  ipcMain.handle(
    "agent:generate-title",
    async (_event, prompt: string, authToken?: string, model?: string) => {
      try {
        const config = loadUserConfig();
        const targetModel = model || config.activeModel || "gemini-3.8-flash";

        // Match model to provider (matching agent:send-message architecture)
        const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
        const modelDef = allModels.find((m) => m.id === targetModel || m.displayName === targetModel);
        const providerKey = modelDef?.provider || config.activeProvider || "const";
        const providerCfg =
          config.providers[providerKey] || config.providers["const"] || config.providers["const-engine"];

        const baseUrl = modelDef?.baseUrl || providerCfg?.baseUrl || "https://router.const.web.id/v1";
        let apiKey = providerCfg?.apiKey || "";

        if (authToken && isValidAuthToken(authToken)) {
          lastAuthToken = authToken;
        }
        if (!apiKey && (providerKey === "const" || providerKey === "const-engine")) {
          apiKey =
            authToken ||
            lastAuthToken ||
            process.env.CONST_ROUTER_API_KEY ||
            process.env.CONST_ENGINE_API_KEY ||
            "const-local-dev-key";
        }

        const endpoint = baseUrl.endsWith("/chat/completions")
          ? baseUrl
          : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              {
                role: "user",
                content: `Summarize this user request into a concise 3 to 5 word title. Return ONLY the title text with no punctuation, no quotes, no extra words:\n\n${prompt.slice(0, 300)}`,
              },
            ],
            stream: false,
          }),
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[Electron Main] Title generation HTTP error ${res.status}:`, errText);
          return null;
        }

        const responseText = await res.text();
        let rawTitle = "";

        if (responseText.includes("data:") || responseText.includes(": keep-alive")) {
          // Handle SSE streams (e.g. combo models like combo/coding)
          const lines = responseText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) rawTitle += delta;
            } catch {}
          }
        } else {
          try {
            const json = JSON.parse(responseText);
            rawTitle = json.choices?.[0]?.message?.content || "";
          } catch (parseErr) {
            console.warn("[Electron Main] Failed to parse title JSON:", parseErr);
          }
        }

        if (rawTitle) {
          const cleaned = rawTitle
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/^["'`]|["'`]$/g, "")
            .replace(/[.\n\r]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (cleaned.length > 0) {
            return cleaned;
          }
        }
        return null;
      } catch (err: any) {
        console.warn("[Electron Main] Title generation error:", err?.message || err);
        return null;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Agent & Execution IPC Handlers (Multi-Session Concurrent Architecture)
  // ---------------------------------------------------------------------------
  interface ActiveAgentSession {
    runId: string;
    agent: any;
    conversationId: string;
    workspacePath: string;
    model: string;
    mode?: "request_review" | "ask_before_changes" | "full_access";
    startedAt: number;
    snapshot: { revision: number; updatedAt: number; status: string; objective: string; activeTool?: string; lastResult?: string; recentOutput: string; todos?: unknown };
    sideInstructions: Map<string, { sideChatId: string; status: "queued" | "consumed" | "plan_updated" }>;
  }
  const activeSessions = new AgentSessionRegistry<ActiveAgentSession>();
  const sideParents = new Map<string, string>();
  const sideReceipts = new SideSteeringReceipts(path.join(constBrainDir, "side-steering-receipts.json"));
  const recordSideReceipt = (sideChatId: string, instructionId: string, status: "queued" | "consumed" | "plan_updated" | "expired", runId: string) => {
    sideReceipts.set(sideChatId, instructionId, status);
    if (win && !win.isDestroyed()) win.webContents.send("agent:stream-event", { type: "side_steer_receipt", conversationId: sideChatId, instructionId, status, runId });
  };
  const pendingQuestions = new Map<string, { runId: string; resolve: (answer: any) => void }>();
  ipcMain.handle("agent:register-side-chat", async (_event, payload: { sideChatId: string; parentConversationId: string }) => {
    if (!/^(side_conversation_|side_chat_)/.test(payload?.sideChatId || "") || !payload.parentConversationId || /^(side_conversation_|side_chat_)/.test(payload.parentConversationId)) return { success: false };
    const previous = sideParents.get(payload.sideChatId);
    if (previous && previous !== payload.parentConversationId) return { success: false };
    sideParents.set(payload.sideChatId, payload.parentConversationId);
    return { success: true };
  });

  // ---------------------------------------------------------------------------
  // Mobile Remote Control Daemon & Bridges
  // ---------------------------------------------------------------------------
  remoteDaemon.onStatusChange((status) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("remote:status-changed", status);
    }
  });

  remoteDaemon.onCommand(async (command, reply) => {
    if (command.type === "state:get") {
      const convos = conversationDb.listConversations(false);
      const running = Array.from(activeSessions.keys());
      reply({
        deviceId: remoteDaemon.deviceId,
        conversations: convos.map((c) => ({
          id: c.id,
          title: c.title,
          project: c.project,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          model: c.model,
          isRunning: running.includes(c.id),
        })),
        runningSessions: Array.from(activeSessions.values(), (session) => ({ conversationId: session.conversationId, runId: session.runId })),
      });
    } else if (command.type === "conversation:get") {
      const convoId = command.payload?.conversationId;
      const convo = convoId ? conversationDb.getConversation(convoId) : null;
      reply({ conversation: convo });
    } else if (command.type === "agent:abort") {
      const convoId = command.payload?.conversationId;
      if (convoId) {
        const targetSession = activeSessions.get(convoId);
        if (targetSession && targetSession.runId === command.payload.runId) {
          for (const task of globalTaskManager.listTasks(convoId)) {
            if (task.status === "running") globalTaskManager.killTask(task.id, convoId);
          }
          globalSubAgentManager.killAllRunningSubAgents((id) => {
            const agent = globalSubAgentManager.getSubAgent(id, convoId);
            const event = { type: "subagent_killed", agentId: id, agent };
            if (win && !win.isDestroyed()) win.webContents.send("agent:stream-event", { ...event, conversationId: convoId, runId: targetSession.runId });
            remoteDaemon.broadcast({ type: "agent:stream-event", conversationId: convoId, runId: targetSession.runId, event });
          }, convoId);
          targetSession.agent.abort();
          // Keep ownership until agent:send-message unwinds, preserving final tool results.
          for (const [id, question] of pendingQuestions) {
            if (question.runId !== targetSession.runId) continue;
            pendingQuestions.delete(id);
            question.resolve({ status: "cancelled", error: "User cancelled agent execution." });
          }
          reply({ success: true });
          return;
        }
      }
      reply({ success: false });
    } else if (command.type === "agent:answer-question") {
      const { toolCallId, answer, runId } = command.payload;
      const pending = pendingQuestions.get(toolCallId);
      if (pending && pending.runId === runId) {
        pendingQuestions.delete(toolCallId);
        pending.resolve(answer);
        reply({ success: true });
      } else {
        reply({ success: false, error: "Question not found" });
      }
    }
  });

  const requireRemoteHost = (event: Electron.IpcMainInvokeEvent) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
      throw new Error("REMOTE_HOST_ONLY");
    }
  };
  ipcMain.handle("remote:start-session", async (event) => {
    requireRemoteHost(event);
    return await remoteDaemon.start();
  });
  ipcMain.handle("remote:stop-session", async (event) => {
    requireRemoteHost(event);
    await remoteDaemon.stop();
    return remoteDaemon.getStatus();
  });
  ipcMain.handle("remote:refresh-session", async (event) => {
    requireRemoteHost(event);
    return await remoteDaemon.refresh();
  });
  ipcMain.handle("remote:get-status", (event) => {
    requireRemoteHost(event);
    return remoteDaemon.getStatus();
  });

  const finishSession = (session: ActiveAgentSession) => {
    if (!activeSessions.release(session.conversationId, session.runId)) return;
    for (const [instructionId, instruction] of session.sideInstructions) {
      if (instruction.status === "queued") recordSideReceipt(instruction.sideChatId, instructionId, "expired", session.runId);
    }
    computerController.releaseSession(session.conversationId);
    for (const [id, question] of pendingQuestions) {
      if (question.runId !== session.runId) continue;
      pendingQuestions.delete(id);
      question.resolve({ status: "cancelled", error: "Session ended" });
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send("agent:session-ended", { conversationId: session.conversationId, runId: session.runId });
    }
    remoteDaemon.broadcast({
      type: "agent:session-ended",
      conversationId: session.conversationId,
      runId: session.runId,
    });
  };

  // Subscribe to background tasks to push real-time events to renderer
  globalTaskManager.subscribe((event) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("task:event", event);
    }
  });

  ipcMain.handle(
    "agent:answer-question",
    async (_event, { toolCallId, answer }: { toolCallId: string; answer: any }) => {
      const question = pendingQuestions.get(toolCallId);
      if (question) {
        pendingQuestions.delete(toolCallId);
        question.resolve(answer);
        return true;
      }
      return false;
    }
  );

  ipcMain.handle("tasks:list", async (_event, conversationId?: string) => {
    return globalTaskManager.listTasks(conversationId);
  });

  ipcMain.handle("tasks:kill", async (_event, taskId: string, conversationId?: string) => {
    return globalTaskManager.killTask(taskId, conversationId);
  });

  ipcMain.handle("tasks:get-output", async (_event, taskId: string) => {
    const task = globalTaskManager.getTask(taskId);
    return task ? task.logs : [];
  });

  ipcMain.handle("subagents:kill", async (_event, agentId: string) => {
    const killed = globalSubAgentManager.killSubAgent(agentId);
    if (killed && win && !win.isDestroyed()) {
      const agent = globalSubAgentManager.getSubAgent(agentId);
      win.webContents.send("agent:stream-event", {
        type: "subagent_killed",
        conversationId: agent?.conversationId,
        agentId: agent?.id || agentId,
        agent,
      });
    }
    return killed;
  });

  ipcMain.handle(
    "agent:send-message",
    async (
      _event,
      payload: {
        messages: AgentMessage[];
        model?: string;
        thinkingLevel?: string;
        workspacePath?: string;
        mode?: "request_review" | "ask_before_changes" | "full_access";
        conversationId?: string;
        authToken?: string;
        maxOutputTokens?: number;
        maxTurns?: number;
        contextWindow?: number;
        sessionKind?: "main" | "companion";
        parentConversationId?: string;
      }
    ) => {
      const config = loadUserConfig();
      // Match model to provider
      const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
      const model = resolveModelId(payload.model || config.activeModel || DEFAULT_ROUTER_MODEL_ID, allModels);
      const modelDef = allModels.find((m) => m.id === model || m.displayName === model);
      const providerKey = modelDef?.provider || config.activeProvider || "const";
      const providerCfg = config.providers[providerKey] || config.providers["const"] || config.providers["const-engine"];

      let baseUrl = modelDef?.baseUrl || providerCfg?.baseUrl || "https://router.const.web.id/v1";
      let apiKey = providerCfg?.apiKey || "";

      // Fallback for Const Router: use user's SSO authToken if available
      if (payload.authToken && isValidAuthToken(payload.authToken)) {
        lastAuthToken = payload.authToken;
      }
      if (!apiKey && (providerKey === "const" || providerKey === "const-engine")) {
        apiKey = payload.authToken || lastAuthToken || process.env.CONST_ROUTER_API_KEY || process.env.CONST_ENGINE_API_KEY || "const-local-dev-key";
      }

      const convoId = payload.conversationId || `session_${Date.now()}`;
      if (payload.sessionKind === "companion") {
        if (!payload.parentConversationId || !/^(side_conversation_|side_chat_)/.test(convoId) || /^(side_conversation_|side_chat_)/.test(payload.parentConversationId)) return { success: false, error: "Invalid side chat parent." };
        const existingParent = sideParents.get(convoId);
        if (existingParent && existingParent !== payload.parentConversationId) return { success: false, error: "Side chat belongs to another conversation." };
        sideParents.set(convoId, payload.parentConversationId);
      }
      if (activeSessions.has(convoId)) return { success: false, alreadyRunning: true };
      const runId = randomUUID();

      // Project vs Outside of Project Scoping
      let targetWorkspace: string;
      if (
        payload.workspacePath &&
        payload.workspacePath !== "Outside Project" &&
        fs.existsSync(payload.workspacePath)
      ) {
        // Run natively inside selected project directory
        targetWorkspace = path.resolve(payload.workspacePath);
      } else {
        // Outside Project: run inside dedicated session directory under defaultProjectLocation or ~/.const/brain/<convoId>
        const defaultLoc = config.defaultProjectLocation;
        if (defaultLoc && fs.existsSync(defaultLoc)) {
          targetWorkspace = path.join(defaultLoc, convoId);
        } else {
          targetWorkspace = path.join(constBrainDir, convoId);
        }
        if (!fs.existsSync(targetWorkspace)) {
          fs.mkdirSync(targetWorkspace, { recursive: true });
        }
      }

      // Assemble personalization systemPrompt from user configuration
      const personalizationParts: string[] = [INTELLIGENCE_UI_PROMPT];
      if (config.personalizationWorkRole?.trim()) {
        personalizationParts.push(`Primary Domain / Role of User: ${config.personalizationWorkRole.trim()}`);
      }
      if (config.personalizationCustomInstructions?.trim()) {
        personalizationParts.push(`User Custom Instructions:\n${config.personalizationCustomInstructions.trim()}`);
      }
      const systemPrompt = personalizationParts.length > 0 ? personalizationParts.join("\n\n") : undefined;

      const agent = createConstAgent({
        preset: "harness",
        sessionKind: payload.sessionKind === "companion" ? "companion" : "main",
        baseUrl,
        apiKey,
        model,
        workspacePath: targetWorkspace,
        externalTools: (signal) => mcpService.tools(targetWorkspace, signal),
        externalToolHandler: (name, args, signal) => mcpService.execute(name, args, targetWorkspace, signal),
        nativeCapabilityEnabled: (name) => marketplaceService.nativeEnabled(name, targetWorkspace) && loadUserConfig()[name === "browser-use" ? "enableBrowserUse" : "enableComputerUse"] !== false,
        conversationId: convoId,
        mode: payload.mode || "ask_before_changes",
        inputTypes: modelDef?.inputTypes,
        systemPrompt,
        thinkingLevel: payload.thinkingLevel as any,
        maxOutputTokens: payload.maxOutputTokens ?? (modelDef as any)?.maxOutputTokens,
        maxTurns: payload.sessionKind === "companion" ? 4 : payload.maxTurns ?? 200,
        contextWindow: getModelContextLimit(model, payload.contextWindow ?? modelDef?.contextWindow),
        onAskQuestion: (toolCallId, questions) => {
          return new Promise((resolve) => {
            pendingQuestions.set(toolCallId, { runId, resolve });
            if (win && !win.isDestroyed()) {
              win.webContents.send("agent:stream-event", {
                type: "ask_question",
                conversationId: convoId,
                runId,
                toolCallId,
                questions,
              });
            }
            remoteDaemon.broadcast({
              type: "agent:stream-event",
              conversationId: convoId,
              runId,
              event: { type: "ask_question", toolCallId, questions },
            });
          });
        },
        browserHandler: async (toolName, args) => {
          const cfg = loadUserConfig();
          if (cfg.enableBrowserUse === false) {
            return {
              result: "Browser Use is currently disabled in Settings. Please turn on 'Enable Browser Use' in Settings > Computer Use to allow browser automation tools.",
              isError: true,
            };
          }
          return await browserController.executeTool(toolName, args);
        },
        computerHandler: async (toolName, args, context) => {
          const cfg = loadUserConfig();
          if (cfg.enableComputerUse === false) {
            return {
              result: "Computer Use is currently disabled in Settings. Please turn on 'Enable Computer Use' in Settings > Computer Use to allow desktop automation tools.",
              isError: true,
            };
          }
          return computerController.executeTool(toolName, args, { ...context, sessionId: convoId });
        },
      });

      const agentSession: ActiveAgentSession = {
        runId,
        agent,
        conversationId: convoId,
        workspacePath: targetWorkspace,
        model,
        mode: payload.mode || "ask_before_changes",
        startedAt: Date.now(),
        snapshot: { revision: 0, updatedAt: Date.now(), status: "starting", objective: String([...payload.messages].reverse().find((message) => message.role === "user")?.content || "").slice(0, 4000), recentOutput: "" },
        sideInstructions: new Map(),
      };
      if (!activeSessions.claim(convoId, agentSession)) return { success: false, alreadyRunning: true };

      if (win && !win.isDestroyed()) {
        win.webContents.send("agent:session-started", { conversationId: convoId, runId });
      }
      remoteDaemon.broadcast({
        type: "agent:session-started",
        conversationId: convoId,
        runId,
      });

      const eventForwarder = createAgentEventForwarder((agentEvent) => {
        if (!activeSessions.owns(convoId, runId)) return false;
        if (win && !win.isDestroyed()) win.webContents.send("agent:stream-event", { ...agentEvent, conversationId: convoId, runId });
        remoteDaemon.broadcast({
          type: "agent:stream-event",
          event: agentEvent,
          conversationId: convoId,
          runId,
        });
        return true;
      });
      try {
        const updatedMessages = await agent.run(
          payload.messages,
          (agentEvent: any) => {
            if (isTelemetryEvent(agentEvent)) {
              conversationDb.recordTelemetry(convoId, agentEvent);
            }
            if (!activeSessions.owns(convoId, runId)) return;
            const snapshot = agentSession.snapshot;
            snapshot.revision++;
            snapshot.updatedAt = Date.now();
            if (agentEvent.type === "status") snapshot.status = agentEvent.status || snapshot.status;
            if (agentEvent.type === "tool_call") { snapshot.activeTool = agentEvent.toolName || agentEvent.name; snapshot.status = "calling_tool"; }
            if (agentEvent.type === "tool_result") {
              snapshot.activeTool = undefined;
              try { snapshot.lastResult = String(typeof agentEvent.result === "string" ? agentEvent.result : JSON.stringify(agentEvent.result ?? "")).slice(0, 2000); } catch { snapshot.lastResult = ""; }
            }
            if (agentEvent.type === "token") snapshot.recentOutput = (snapshot.recentOutput + (agentEvent.token || "")).slice(-4000);
            if (agentEvent.type === "token_reset") snapshot.recentOutput = "";
            if (agentEvent.type === "todo_update") {
              snapshot.todos = agentEvent.todos;
              for (const [instructionId, instruction] of agentSession.sideInstructions) {
                if (instruction.status === "consumed") {
                  instruction.status = "plan_updated";
                  recordSideReceipt(instruction.sideChatId, instructionId, "plan_updated", runId);
                }
              }
            }
            if (agentEvent.type === "approval_request") snapshot.status = "waiting_approval";
            if (agentEvent.type === "ask_question") snapshot.status = "waiting_question";
            if (agentEvent.type === "error") snapshot.status = "error";
            if (agentEvent.type === "done") snapshot.status = "done";
            if (agentEvent.type === "steer_message" && agentEvent.message?.instructionId) {
              const instruction = agentSession.sideInstructions.get(agentEvent.message.instructionId);
              if (instruction) {
                instruction.status = "consumed";
                recordSideReceipt(instruction.sideChatId, agentEvent.message.instructionId, "consumed", runId);
              }
            }
            eventForwarder.forward(agentEvent);
            conversationDb.appendTranscriptEvent(convoId, agentEvent);
          }
        );

        // A replaced run must never overwrite its successor's history.
        if (!activeSessions.owns(convoId, runId)) {
          return { success: false, aborted: true, messages: updatedMessages };
        }
        const isCancelled = agent.isCancelled;

        // Auto-save to SQLite conversation database even if cancelled, to ensure partial work is never lost
        const isSideChat = convoId.startsWith("side_conversation_") || convoId.startsWith("side_chat_");
        if (!isSideChat) {
          try {
            const existingConvo = conversationDb.getConversation(convoId);
            const msgsToSave = selectAgentAutosaveMessages(existingConvo?.messages || [], updatedMessages);
            if (msgsToSave.length > 0) {
              conversationDb.saveConversation({
                ...existingConvo,
                id: convoId,
                title: existingConvo?.title || "New Task",
                project: payload.workspacePath || "Outside Project",
                model,
                mode: payload.mode || (activeSessions.get(convoId) as any)?.mode || existingConvo?.mode || "ask_before_changes",
                updatedAt: Date.now(),
                createdAt: existingConvo?.createdAt || Date.now(),
                messages: msgsToSave,
              });

              // Notify renderer that conversations have changed
              if (win && !win.isDestroyed()) {
                win.webContents.send("conversations:changed", { conversationId: convoId });
              }
            }
          } catch (dbErr) {
            console.warn("[Electron Main] Failed to auto-save conversation to database:", dbErr);
          }
        }

        if (isCancelled) {
          return {
            success: false,
            aborted: true,
            error: "User cancelled agent execution.",
            messages: updatedMessages,
          };
        }

        return {
          success: true,
          messages: updatedMessages,
          workspacePath: targetWorkspace,
          isOutsideProject: !payload.workspacePath || payload.workspacePath === "Outside Project",
        };
      } catch (err: any) {
        return { success: false, error: err.message, errorReported: eventForwarder.errorReported };
      } finally {
        finishSession(agentSession);
      }
    }
  );

  ipcMain.handle(
    "agent:steer",
    async (
      _event,
      payload: {
        conversationId?: string;
        prompt: string;
        attachments?: any[];
        expectedRunId?: string;
        instructionId?: string;
        sourceSideChatId?: string;
      }
    ) => {
      const safeConvoId =
        typeof payload.conversationId === "string" && payload.conversationId.trim().length > 0
          ? payload.conversationId.trim()
          : undefined;

      let targetSession = safeConvoId ? activeSessions.get(safeConvoId) : undefined;
      if (!safeConvoId && activeSessions.size === 1) {
        targetSession = activeSessions.values().next().value;
      }

      if (targetSession) {
        if (payload.sourceSideChatId) {
          if (!payload.instructionId || !safeConvoId || sideParents.get(payload.sourceSideChatId) !== safeConvoId || payload.expectedRunId !== targetSession.runId) return { success: false, stale: true };
          const prior = targetSession.sideInstructions.get(payload.instructionId);
          if (prior) return { success: prior.sideChatId === payload.sourceSideChatId, status: prior.status };
          targetSession.sideInstructions.set(payload.instructionId, { sideChatId: payload.sourceSideChatId, status: "queued" });
        }
        const steered = targetSession.agent.steer(payload.prompt, payload.attachments, payload.sourceSideChatId && payload.instructionId ? { instructionId: payload.instructionId, sourceSideChatId: payload.sourceSideChatId } : undefined);
        if (!steered && payload.instructionId) targetSession.sideInstructions.delete(payload.instructionId);
        if (steered && payload.sourceSideChatId) {
          if (payload.instructionId) recordSideReceipt(payload.sourceSideChatId, payload.instructionId, "queued", targetSession.runId);
          for (const [id, question] of pendingQuestions) {
            if (question.runId === targetSession.runId) { pendingQuestions.delete(id); question.resolve({ status: "cancelled", error: "A new instruction arrived." }); }
          }
        }
        return { success: steered };
      }

      return { success: false, notRunning: true };
    }
  );

  ipcMain.handle(
    "file:extract-pdf-text",
    async (
      _event,
      payload: { filePath?: string; bufferBase64?: string }
    ) => {
      try {
        let input: string | Buffer;
        if (payload.filePath && fs.existsSync(payload.filePath)) {
          input = payload.filePath;
        } else if (payload.bufferBase64) {
          const cleanBase64 = payload.bufferBase64.replace(/^data:[^;]+;base64,/, "");
          input = Buffer.from(cleanBase64, "base64");
        } else {
          return { success: false, error: "No file path or buffer provided" };
        }
        const res = await extractPdfText(input);
        return { success: true, text: res.text, pages: res.pages };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to extract PDF text" };
      }
    }
  );

  ipcMain.handle(
    "file:extract-document-text",
    async (
      _event,
      payload: { filePath?: string; bufferBase64?: string; filename?: string }
    ) => {
      try {
        let input: string | Buffer;
        if (payload.filePath && fs.existsSync(payload.filePath)) {
          input = payload.filePath;
        } else if (payload.bufferBase64) {
          const cleanBase64 = payload.bufferBase64.replace(/^data:[^;]+;base64,/, "");
          input = Buffer.from(cleanBase64, "base64");
        } else {
          return { success: false, error: "No file path or buffer provided" };
        }
        const res = await extractDocumentText(input, payload.filename);
        return { success: true, text: res.text, pages: res.pages, type: res.type };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to extract document text" };
      }
    }
  );

  ipcMain.handle(
    "file:save-attachment",
    async (
      _event,
      payload: {
        conversationId?: string;
        name: string;
        base64?: string;
        sourcePath?: string;
      }
    ) => {
      try {
        const convoId = payload.conversationId || "shared_uploads";
        const uploadDir = path.join(constBrainDir, convoId, ".user_uploaded");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const rawName = payload.name || "upload.bin";
        const ext = path.extname(rawName);
        let baseName = path.basename(rawName, ext).replace(/[^a-zA-Z0-9._-]/g, "_");

        // Normalize generic pasted/temporary filenames
        const isGenericName =
          !baseName ||
          baseName.toLowerCase() === "image" ||
          baseName.toLowerCase() === "blob" ||
          baseName.toLowerCase() === "pasted-image" ||
          baseName.toLowerCase() === "screenshot";
        if (isGenericName) {
          baseName = `media_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        }

        let safeName = `${baseName}${ext || ".png"}`;
        let targetPath = path.join(uploadDir, safeName);
        if (fs.existsSync(targetPath)) {
          safeName = `${baseName}_${Date.now()}${ext || ".png"}`;
          targetPath = path.join(uploadDir, safeName);
        }

        if (payload.sourcePath && fs.existsSync(payload.sourcePath)) {
          fs.copyFileSync(payload.sourcePath, targetPath);
          return { success: true, path: targetPath, filename: safeName };
        } else if (payload.base64) {
          const cleanBase64 = payload.base64.replace(/^data:[^;]+;base64,/, "");
          fs.writeFileSync(targetPath, Buffer.from(cleanBase64, "base64"));
          return { success: true, path: targetPath, filename: safeName };
        }
        return { success: false, error: "No source path or base64 provided" };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle("file:read-as-data-url", async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: "File not found" };
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".pdf": "application/pdf",
      };
      const mime = mimeMap[ext] || "application/octet-stream";
      const buffer = fs.readFileSync(filePath);
      return { success: true, dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("agent:abort", async (_event, targetConvoId?: string) => {
    const safeConvoId =
      typeof targetConvoId === "string" && targetConvoId.trim().length > 0
        ? targetConvoId.trim()
        : undefined;

    // Terminate any active background tasks scoped to this conversation (or all if un-scoped)
    try {
      const tasks = globalTaskManager.listTasks(safeConvoId);
      for (const t of tasks) {
        if (t.status === "running") {
          globalTaskManager.killTask(t.id, safeConvoId);
        }
      }
    } catch {}

    // Terminate any active sub-agents scoped to this conversation (or all if un-scoped)
    try {
      globalSubAgentManager.killAllRunningSubAgents((id) => {
        if (win && !win.isDestroyed()) {
          const agent = globalSubAgentManager.getSubAgent(id, safeConvoId);
          win.webContents.send("agent:stream-event", {
            type: "subagent_killed",
            conversationId: agent?.conversationId || safeConvoId,
            agentId: id,
            agent,
          });
        }
      }, safeConvoId);
    } catch {}

    let targetSession = safeConvoId ? activeSessions.get(safeConvoId) : undefined;
    if (!safeConvoId && activeSessions.size === 1) {
      targetSession = activeSessions.values().next().value;
    }

    // Abort the agent session but DO NOT prematurely call finishSession(targetSession).
    // The finally block in agent:send-message will cleanly call finishSession when the agent run unwinds,
    // allowing trailing tool results/telemetry to pass activeSessions.owns() checks.
    const sessionsToAbort = targetSession ? [targetSession] : !safeConvoId ? [...activeSessions.values()] : [];
    for (const session of sessionsToAbort) {
      session.agent.abort();
      // ask_question waits on these promises; resolve them without releasing run ownership.
      for (const [id, question] of pendingQuestions) {
        if (question.runId !== session.runId) continue;
        pendingQuestions.delete(id);
        question.resolve({ status: "cancelled", error: "User cancelled agent execution." });
      }
    }
    return { success: true };
  });

  ipcMain.handle(
    "agent:respond-approval",
    async (
      _event,
      payload: {
        conversationId: string;
        approvalId: string;
        decision:
          | "allow_once"
          | "full_access"
          | "allow_conversation"
          | "allow_project"
          | "allow_always"
          | "deny"
          | "skip";
        feedback?: string;
      }
    ) => {
      const session = activeSessions.get(payload.conversationId);
      if (session && session.agent && typeof session.agent.resolveApproval === "function") {
        const resolved = session.agent.resolveApproval(payload.approvalId, {
          approvalId: payload.approvalId,
          decision: payload.decision,
          feedback: payload.feedback,
        });
        if (resolved) {
          return { success: true };
        }
      }
      return { success: false, error: "Active session or approval not found" };
    }
  );

  ipcMain.handle(
    "agent:update-mode",
    async (
      _event,
      payload: { mode: "request_review" | "ask_before_changes" | "full_access"; conversationId?: string }
    ) => {
      const { mode, conversationId } = payload;
      let targetSession = conversationId ? activeSessions.get(conversationId) : undefined;
      if (!targetSession && activeSessions.size === 1) {
        targetSession = activeSessions.values().next().value;
      }

      let updated = false;
      if (targetSession && targetSession.agent && typeof targetSession.agent.updateMode === "function") {
        targetSession.agent.updateMode(mode);
        (targetSession as any).mode = mode;
        updated = true;
      }

      for (const [id, s] of activeSessions.entries()) {
        if ((!conversationId || id === conversationId) && s.agent && typeof s.agent.updateMode === "function") {
          s.agent.updateMode(mode);
          (s as any).mode = mode;
          updated = true;
        }
      }

      if (conversationId) {
        try {
          const convo = conversationDb.getConversation(conversationId);
          if (convo) {
            convo.mode = mode;
            convo.updatedAt = Date.now();
            conversationDb.saveConversation(convo);
          }
        } catch {}
      }

      return { success: true, updated };
    }
  );

  ipcMain.handle("agent:get-running-sessions", async () => {
    return Array.from(activeSessions.keys());
  });

  ipcMain.handle("agent:get-session-snapshot", async (_event, conversationId: string) => {
    const session = activeSessions.get(conversationId);
    return session ? { conversationId, runId: session.runId, startedAt: session.startedAt, ...session.snapshot } : null;
  });
  ipcMain.handle("agent:get-side-receipts", async (_event, sideChatId: string) => sideReceipts.get(sideChatId));

  // Conversations Database IPC Handlers
  ipcMain.handle("conversations:list", async (_event, includeArchived?: boolean) => {
    return conversationDb.listConversations(includeArchived);
  });

  ipcMain.handle("conversations:list-archived", async () => {
    return conversationDb.listArchivedConversations();
  });

  ipcMain.handle("conversations:get", async (_event, id: string) => {
    return conversationDb.getConversation(id);
  });

  ipcMain.handle("conversations:save", async (_event, convo: ConversationRecord) => {
    conversationDb.saveConversation(convo);
    return true;
  });

  ipcMain.handle("conversations:delete", async (_event, id: string) => {
    conversationDb.deleteConversation(id);
    return true;
  });

  ipcMain.handle("conversations:rename", async (_event, id: string, title: string) => {
    conversationDb.renameConversation(id, title);
    return true;
  });

  ipcMain.handle("conversations:archive", async (_event, id: string) => {
    conversationDb.archiveConversation(id);
    return true;
  });

  ipcMain.handle("conversations:unarchive", async (_event, id: string) => {
    conversationDb.unarchiveConversation(id);
    return true;
  });

  ipcMain.handle("conversations:pin", async (_event, id: string, isPinned: boolean) => {
    conversationDb.pinConversation(id, isPinned);
    return true;
  });

  ipcMain.handle("conversations:pin-project", async (_event, projectName: string, isPinned: boolean) => {
    conversationDb.pinProject(projectName, isPinned);
    return true;
  });

  ipcMain.handle("conversations:get-project-pins", async () => {
    return conversationDb.getProjectPins();
  });

  ipcMain.handle("conversations:get-paths", async (_event, conversationId?: string, workspacePath?: string) => {
    const home = harnessHomeDir;
    const brain = path.join(home, "brain");
    const id = conversationId || "";
    const taskDbPath = path.join(home, "conversations", "conversations.db");
    const logPath = id ? path.join(brain, id, ".system_generated", "logs", "transcript_full.jsonl") : "";
    return {
      workspacePath: workspacePath || "",
      taskPath: taskDbPath,
      logPath,
      configPath: constConfigFile,
    };
  });

  ipcMain.handle("conversations:get-transcript", async (_event, conversationId: string) => {
    if (!conversationId) return "";
    try {
      const logsDir = path.join(harnessHomeDir, "brain", conversationId, ".system_generated", "logs");
      const fullPath = path.join(logsDir, "transcript_full.jsonl");
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, "utf-8");
      }
      const simplePath = path.join(logsDir, "transcript.jsonl");
      if (fs.existsSync(simplePath)) {
        return fs.readFileSync(simplePath, "utf-8");
      }
    } catch (err) {
      console.warn("Failed to read transcript for", conversationId, err);
    }
    return "";
  });

  ipcMain.handle("conversations:import-legacy", async (_event, convos: ConversationRecord[]) => {
    conversationDb.importLegacyConversations(convos);
    return true;
  });


  // Rollback file mutation handler
  ipcMain.handle(
    "agent:rollback-file",
    async (_event, payload: { record: FileMutationRecord }) => {
      if (!payload?.record) {
        return { success: false, message: "No mutation record provided" };
      }
      return await rollbackFileMutation(payload.record);
    }
  );

  // Workspace directory resolution
  ipcMain.handle(
    "workspace:resolve-path",
    async (_event, options?: { project?: string; conversationId?: string }) => {
      const project = options?.project;
      const convoId = options?.conversationId || `session_${Date.now()}`;
      if (project && project !== "Outside Project" && fs.existsSync(project)) {
        return path.resolve(project);
      }
      const config = loadUserConfig();
      const defaultLoc = config.defaultProjectLocation;
      const outsideDir = defaultLoc && fs.existsSync(defaultLoc)
        ? path.join(defaultLoc, convoId)
        : path.join(constBrainDir, convoId);
      if (!fs.existsSync(outsideDir)) {
        try {
          fs.mkdirSync(outsideDir, { recursive: true });
        } catch (err) {
          console.error("Failed to create outside brain directory:", outsideDir, err);
        }
      }
      return outsideDir;
    }
  );

  // Workspace files scanning and shell open-path handlers for Mentions & Palette
  const workspaceFilesCache = new Map<string, { timestamp: number; data: any[] }>();

  ipcMain.handle("workspace:list-files", async (_event, workspacePath?: string) => {
    if (!workspacePath || !fs.existsSync(workspacePath)) return [];
    
    // Check 15-second cache
    const cached = workspaceFilesCache.get(workspacePath);
    if (cached && Date.now() - cached.timestamp < 15000) {
      return cached.data;
    }

    try {
      const results: Array<{
        id: string;
        name: string;
        path: string;
        parentDir?: string;
        fullPath: string;
        type: "code" | "image" | "doc" | "generic";
        kind: "file" | "directory";
      }> = [];
      const ignored = new Set([
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        ".turbo",
        ".cache",
        "out",
        "coverage",
        "target",
        ".idea",
        ".vscode",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".gradle",
        ".DS_Store",
      ]);

      const getFileType = (ext: string): "code" | "image" | "doc" | "generic" => {
        const lower = ext.toLowerCase();
        if (
          [
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".json",
            ".html",
            ".css",
            ".scss",
            ".py",
            ".rs",
            ".go",
            ".c",
            ".cpp",
            ".h",
            ".sh",
            ".yaml",
            ".yml",
            ".toml",
            ".sql",
          ].includes(lower)
        ) {
          return "code";
        }
        if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"].includes(lower)) {
          return "image";
        }
        if ([".md", ".txt", ".pdf", ".doc", ".docx", ".csv"].includes(lower)) {
          return "doc";
        }
        return "generic";
      };

      const MAX_DEPTH = 10;
      const MAX_ENTRIES = 5000;

      const walk = (currentDir: string, depth: number) => {
        if (depth > MAX_DEPTH || results.length >= MAX_ENTRIES) return;
        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= MAX_ENTRIES) break;
            if (entry.name.startsWith(".") && entry.name !== ".env") continue;
            const fullPath = path.join(currentDir, entry.name);
            const rawRel = path.relative(workspacePath, fullPath);
            const relPath = rawRel.replace(/\\/g, "/");
            const parentRaw = path.relative(workspacePath, currentDir);
            const parentDir = parentRaw === "" || parentRaw === "." ? "" : parentRaw.replace(/\\/g, "/");

            if (entry.isDirectory()) {
              if (!ignored.has(entry.name)) {
                results.push({
                  id: fullPath,
                  name: entry.name,
                  path: relPath,
                  parentDir,
                  fullPath,
                  type: "generic",
                  kind: "directory",
                });
                walk(fullPath, depth + 1);
              }
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name);
              results.push({
                id: fullPath,
                name: entry.name,
                path: relPath,
                parentDir,
                fullPath,
                type: getFileType(ext),
                kind: "file",
              });
            }
          }
        } catch {}
      };

      walk(workspacePath, 0);
      workspaceFilesCache.set(workspacePath, { timestamp: Date.now(), data: results });
      return results;
    } catch (err) {
      console.error("Failed to list workspace files:", err);
      return [];
    }
  });

  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => {
    if (!targetPath) return false;
    try {
      const res = await shell.openPath(targetPath);
      return res === "";
    } catch (err) {
      console.error("Failed to open path:", err);
      return false;
    }
  });

  ipcMain.handle(
    "system:show-notification",
    async (_event, payload: { title: string; body: string; silent?: boolean }) => {
      try {
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: payload.title || "Const Harness",
            body: payload.body || "",
            silent: payload.silent ?? false,
          });
          notif.show();
          return true;
        }
      } catch (err) {
        console.warn("[Electron Main] Could not show desktop notification:", err);
      }
      return false;
    }
  );

  ipcMain.handle("system:open-const-folder", async () => {
    try {
      if (!fs.existsSync(constHomeDir)) {
        fs.mkdirSync(constHomeDir, { recursive: true });
      }
      await shell.openPath(constHomeDir);
      return true;
    } catch (err) {
      console.warn("[Electron Main] Could not open const folder:", err);
      return false;
    }
  });

  ipcMain.handle("workspace:read-file", async (_event, filePath: string, workspacePath?: string) => {
    if (!filePath) return { error: "Path is required" };
    try {
      let resolvedPath = filePath;
      if (resolvedPath.startsWith("~/") || resolvedPath.startsWith("~\\")) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(2));
      } else if (resolvedPath.startsWith("brain/") || resolvedPath.startsWith("brain\\")) {
        resolvedPath = path.join(harnessHomeDir, resolvedPath);
      } else if (!path.isAbsolute(resolvedPath) && workspacePath && fs.existsSync(workspacePath)) {
        resolvedPath = path.resolve(workspacePath, resolvedPath);
      }

      if (!fs.existsSync(resolvedPath)) {
        return { error: "File not found" };
      }
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        return { isDirectory: true, error: "Path is a directory" };
      }
      if (stat.size > 3 * 1024 * 1024) {
        const content = fs.readFileSync(resolvedPath, "utf-8");
        return { content: content.slice(0, 500000), truncated: true };
      }
      const content = fs.readFileSync(resolvedPath, "utf-8");
      return { content, truncated: false };
    } catch (err: any) {
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.handle(
    "workspace:read-directory",
    async (_event, dirPath?: string, workspacePath?: string) => {
      try {
        let targetDir: string;
        if (dirPath && path.isAbsolute(dirPath)) {
          targetDir = dirPath;
        } else if (dirPath && workspacePath) {
          targetDir = path.resolve(workspacePath, dirPath);
        } else if (workspacePath) {
          targetDir = path.resolve(workspacePath);
        } else {
          return [];
        }

        if (!fs.existsSync(targetDir)) return [];
        const stat = fs.statSync(targetDir);
        if (!stat.isDirectory()) return [];

        const dirents = fs.readdirSync(targetDir, { withFileTypes: true });
        const entries: Array<{
          name: string;
          path: string;
          fullPath: string;
          isDirectory: boolean;
        }> = [];

        for (const ent of dirents) {
          const fullPath = path.join(targetDir, ent.name);
          const relPath = workspacePath
            ? path.relative(workspacePath, fullPath).replace(/\\/g, "/")
            : ent.name;

          entries.push({
            name: ent.name,
            path: relPath,
            fullPath,
            isDirectory: ent.isDirectory(),
          });
        }

        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });

        return entries;
      } catch (err) {
        console.error("[Electron Main] Failed to read directory:", err);
        return [];
      }
    }
  );

  ipcMain.handle("shell:show-in-folder", async (_event, targetPath: string) => {
    if (!targetPath) return false;
    try {
      if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[Electron Main] Failed to show item in folder:", err);
      return false;
    }
  });

  // ---------------------------------------------------------------------------
  // Scheduled Tasks Manager & IPC Handlers
  // ---------------------------------------------------------------------------
  scheduledTasksManager = new ScheduledTasksManager(scheduledTasksDir, {
    executeTaskRunner: async (task) => {
      // Maintain a single dedicated, persistent conversation per scheduled task
      const convoId = task.conversationId || `scheduled_${task.id}`;
      task.conversationId = convoId;

      const existingConvo = conversationDb.getConversation(convoId);
      const previousAgentMessages: AgentMessage[] = [];

      if (existingConvo && Array.isArray(existingConvo.messages)) {
        for (const m of existingConvo.messages) {
          if (!m || !m.role || !m.content) continue;
          previousAgentMessages.push({
            id: m.id,
            role: m.role as any,
            content: m.content,
            toolObservationId: m.toolObservationId,
            tool_call_id: m.tool_call_id,
            tool_calls: m.tool_calls,
            name: m.name,
            thinking: m.thinking,
            timestamp: m.createdAt || m.timestamp,
          });
        }
      }

      const config = loadUserConfig();
      const model = task.model || config.activeModel || "gemini-3.8-flash";

      const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
      const modelDef = allModels.find((m) => m.id === model || m.displayName === model);
      const providerKey = modelDef?.provider || config.activeProvider || "const";
      const providerCfg =
        config.providers[providerKey] ||
        config.providers["const"] ||
        config.providers["const-engine"];

      let baseUrl =
        modelDef?.baseUrl || providerCfg?.baseUrl || "https://router.const.web.id/v1";
      let apiKey = providerCfg?.apiKey || "";

      if (!apiKey && (providerKey === "const" || providerKey === "const-engine")) {
        apiKey =
          lastAuthToken ||
          process.env.CONST_ROUTER_API_KEY ||
          process.env.CONST_ENGINE_API_KEY ||
          "const-local-dev-key";
      }

      let targetWorkspace: string;
      if (task.workspacePath && fs.existsSync(task.workspacePath)) {
        targetWorkspace = path.resolve(task.workspacePath);
      } else {
        targetWorkspace = path.join(constBrainDir, convoId);
        if (!fs.existsSync(targetWorkspace)) {
          fs.mkdirSync(targetWorkspace, { recursive: true });
        }
      }

      // Scheduled tasks run autonomously in the background with full access
      const agent = createConstAgent({
        preset: "harness",
        baseUrl,
        apiKey,
        model,
        externalTools: (signal) => mcpService.tools(targetWorkspace, signal),
        externalToolHandler: (name, args, signal) => mcpService.execute(name, args, targetWorkspace, signal),
        nativeCapabilityEnabled: (name) => marketplaceService.nativeEnabled(name, targetWorkspace) && loadUserConfig()[name === "browser-use" ? "enableBrowserUse" : "enableComputerUse"] !== false,
        conversationId: convoId,
        inputTypes: modelDef?.inputTypes,
        workspacePath: targetWorkspace,
        mode: "full_access",
        thinkingLevel: "medium",
        maxTurns: 200,
        browserHandler: async (toolName, args) => {
          const cfg = loadUserConfig();
          if (cfg.enableBrowserUse === false) {
            return {
              result: "Browser Use is currently disabled in Settings. Please turn on 'Enable Browser Use' in Settings > Computer Use to allow browser automation tools.",
              isError: true,
            };
          }
          return await browserController.executeTool(toolName, args);
        },
        computerHandler: async (toolName, args, context) => {
          const cfg = loadUserConfig();
          if (cfg.enableComputerUse === false) {
            return {
              result: "Computer Use is currently disabled in Settings. Please turn on 'Enable Computer Use' in Settings > Computer Use to allow desktop automation tools.",
              isError: true,
            };
          }
          return computerController.executeTool(toolName, args, { ...context, sessionId: convoId });
        },
      });

      const taskName = task.name || task.title || "Scheduled Task";
      const taskPrompt = task.prompt || task.instructions || "";
      const runCount = (task.runCount || 0) + 1;

      const initialMessage: AgentMessage = {
        role: "user",
        content: `[Scheduled Task: ${taskName} — Run #${runCount}]\n\n${taskPrompt}`,
        timestamp: Date.now(),
      };

      const messagesToRun: AgentMessage[] = [...previousAgentMessages, initialMessage];

      // Keep OS awake during background scheduled task execution
      let blockerId: number | null = null;
      try {
        blockerId = powerSaveBlocker.start("prevent-app-suspension");
      } catch {}

      try {
        const updatedMessages = await agent.run(messagesToRun, (agentEvent: any) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send("agent:stream-event", {
              ...agentEvent,
              conversationId: convoId,
              isScheduled: true,
            });
          }
          conversationDb.appendTranscriptEvent(convoId, agentEvent);
        });

        try {
          conversationDb.saveConversation({
            id: convoId,
            title: taskName,
            project: task.workspacePath || "Outside Project",
            model,
            isScheduled: true,
            updatedAt: Date.now(),
            createdAt: existingConvo?.createdAt || Date.now(),
            messages: updatedMessages,
          });

          // Realtime notification: Notify renderer that conversations have changed
          if (win && !win.isDestroyed()) {
            win.webContents.send("conversations:changed", { conversationId: convoId });
          }
        } catch (dbErr) {
          console.warn("[ScheduledTasks] Failed to save conversation to DB:", dbErr);
        }

        return { sessionId: convoId };
      } finally {
        computerController.releaseSession(convoId);
        if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
          try {
            powerSaveBlocker.stop(blockerId);
          } catch {}
        }
      }
    },
    onChanged: () => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("scheduled-tasks:changed");
      }
    },
  });

  scheduledTasksManager.start();

  ipcMain.handle("scheduled-tasks:list", async () => {
    return scheduledTasksManager?.listTasks() || [];
  });

  ipcMain.handle("scheduled-tasks:create", async (_event, data: any) => {
    return scheduledTasksManager?.createTask(data) || null;
  });

  ipcMain.handle("scheduled-tasks:update", async (_event, data: any) => {
    return scheduledTasksManager?.updateTask(data) || null;
  });

  ipcMain.handle("scheduled-tasks:delete", async (_event, id: string) => {
    return scheduledTasksManager?.deleteTask(id) || false;
  });

  ipcMain.handle("scheduled-tasks:run", async (_event, id: string) => {
    if (!scheduledTasksManager) return { success: false, error: "Manager not initialized" };
    return await scheduledTasksManager.executeTask(id, "manual");
  });

  ipcMain.handle("scheduled-tasks:history", async (_event, taskId?: string) => {
    return scheduledTasksManager?.getHistory(taskId) || [];
  });

  ipcMain.handle("scheduled-tasks:delete-run", async (_event, id: string) => {
    return scheduledTasksManager?.deleteRun(id) || false;
  });

  // ---------------------------------------------------------------------------
  // Terminal Management IPC Handlers
  // ---------------------------------------------------------------------------
  ipcMain.handle(
    "terminal:create",
    async (
      _event,
      options: {
        id: string;
        cwd?: string;
        project?: string;
        conversationId?: string;
        shell?: string;
        cols?: number;
        rows?: number;
      }
    ) => {
      const { id } = options;
      if (activeTerminals.has(id)) {
        return { success: true, id };
      }

      let targetCwd = options.cwd;
      if (!targetCwd || targetCwd === "Outside Project") {
        if (options.project && options.project !== "Outside Project" && fs.existsSync(options.project)) {
          targetCwd = path.resolve(options.project);
        } else {
          const convoId = options.conversationId || `session_${Date.now()}`;
          targetCwd = path.join(constBrainDir, convoId);
        }
      }

      if (targetCwd && !fs.existsSync(targetCwd)) {
        try {
          fs.mkdirSync(targetCwd, { recursive: true });
        } catch (err) {
          console.error("Failed to create target directory for terminal:", targetCwd, err);
        }
      }

      if (!targetCwd || !fs.existsSync(targetCwd)) {
        targetCwd = os.homedir();
      }

      const defaultShell =
        process.platform === "win32"
          ? process.env.COMSPEC || "powershell.exe"
          : process.env.SHELL || "/bin/bash";
      const shellPath = options.shell || defaultShell;

      let cmd = shellPath;
      let args: string[] = [];

      if (process.platform === "linux") {
        cmd = "script";
        args = ["-q", "-f", "-c", `env TERM=xterm-256color COLORTERM=truecolor ${shellPath}`, "/dev/null"];
      } else if (process.platform === "win32") {
        cmd = shellPath;
        args = [];
      } else {
        cmd = shellPath;
        args = ["-i"];
      }

      try {
        const proc = spawn(cmd, args, {
          cwd: targetCwd,
          env: {
            ...process.env,
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
            COLUMNS: String(options.cols || 80),
            LINES: String(options.rows || 24),
          },
          stdio: ["pipe", "pipe", "pipe"],
        });

        activeTerminals.set(id, { process: proc, cwd: targetCwd });

        proc.stdout?.on("data", (chunk: Buffer) => {
          const str = chunk.toString("utf-8");
          // Instant auto-response to shell terminal capability probes (e.g. fish) so prompt appears without delay
          if (str.includes("\x1b[0c") || str.includes("\x1b[c")) {
            try { proc.stdin?.write("\x1b[?1;2c"); } catch {}
          }
          if (str.includes("11;?")) {
            try { proc.stdin?.write("\x1b]11;rgb:1010/1010/1010\x1b\\"); } catch {}
          }
          if (win && !win.isDestroyed()) {
            win.webContents.send("terminal:data", { id, data: str });
          }
        });

        proc.stderr?.on("data", (chunk: Buffer) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send("terminal:data", { id, data: chunk.toString("utf-8") });
          }
        });

        proc.on("exit", (code) => {
          activeTerminals.delete(id);
          if (win && !win.isDestroyed()) {
            win.webContents.send("terminal:exit", { id, code });
          }
        });

        proc.on("error", (err) => {
          console.error(`[Terminal ${id}] Process error:`, err);
          activeTerminals.delete(id);
          if (win && !win.isDestroyed()) {
            win.webContents.send("terminal:data", { id, data: `\r\n[Terminal Error]: ${err.message}\r\n` });
            win.webContents.send("terminal:exit", { id, code: 1 });
          }
        });

        return { success: true, id };
      } catch (err: any) {
        console.error(`[Terminal ${id}] Spawn failed:`, err);
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    "terminal:write",
    async (_event, options: { id: string; data: string }) => {
      const term = activeTerminals.get(options.id);
      if (term && term.process.stdin && !term.process.stdin.destroyed) {
        term.process.stdin.write(options.data);
        return true;
      }
      return false;
    }
  );

  ipcMain.handle("terminal:destroy", async (_event, id: string) => {
    const term = activeTerminals.get(id);
    if (term) {
      try {
        term.process.kill();
      } catch {}
      activeTerminals.delete(id);
      return true;
    }
    return false;
  });

  // ---------------------------------------------------------------------------
  // Browser Control IPC Handlers (OpenBot / oh-my-pi architecture)
  // ---------------------------------------------------------------------------
  browserController.setCallbacks({
    onStateChange: (state: ControlState) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("browser:control-changed", state);
      }
    },
    onAiAction: (action: { type: string; details?: any }) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("browser:ai-action", action);
      }
    },
    onTabOpenRequest: async (payload: { url: string; tabId?: string; newTab?: boolean }) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("browser:open-tab-request", payload);
        return payload.tabId || "browser-tab-default";
      }
      return null;
    },
  });

  ipcMain.handle(
    "browser:register-tab",
    async (_event, payload: { tabId: string; guestContentsId: number }) => {
      browserController.registerWebview(payload.tabId, payload.guestContentsId);
      return true;
    }
  );

  ipcMain.handle("browser:open-tab", async (_event, payload: { url: string; tabId?: string; newTab?: boolean }) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("browser:open-tab-request", payload);
      return true;
    }
    return false;
  });

  ipcMain.handle("browser:unregister-tab", async (_event, tabId: string) => {
    browserController.unregisterWebview(tabId);
    return true;
  });

  ipcMain.handle("browser:set-active-tab", async (_event, tabId: string) => {
    browserController.setActiveTab(tabId);
    return true;
  });

  ipcMain.handle("browser:list-tabs", async () => {
    return browserController.listTabs();
  });

  ipcMain.handle("browser:get-control", async () => {
    return browserController.getControl();
  });

  ipcMain.handle("browser:take-control", async () => {
    return browserController.takeControl();
  });

  ipcMain.handle("browser:release-control", async () => {
    return browserController.releaseControl();
  });

  ipcMain.handle("browser:supply-secret", async (_event, text: string) => {
    return await browserController.supplySecret(text);
  });

  ipcMain.handle("browser:navigate", async (_event, url: string, options?: any) => {
    return await browserController.navigate(url, options);
  });

  ipcMain.handle("browser:snapshot", async (_event, args?: any) => {
    return await browserController.snapshot(args);
  });

  ipcMain.handle("browser:click", async (_event, args: any) => {
    return await browserController.click(args);
  });

  ipcMain.handle("browser:type", async (_event, args: any) => {
    return await browserController.type(args);
  });

  ipcMain.handle("browser:key", async (_event, args: any) => {
    return await browserController.key(args);
  });

  ipcMain.handle("browser:scroll", async (_event, args: any) => {
    return await browserController.scroll(args);
  });

  ipcMain.handle("browser:screenshot", async (_event, args?: any) => {
    return await browserController.screenshot(args);
  });

  ipcMain.handle("browser:console", async (_event, args?: any) => {
    return await browserController.readConsoleAndNetwork(args);
  });

  ipcMain.handle("browser:evaluate", async (_event, args: any) => {
    return await browserController.evaluate(args);
  });

  ipcMain.handle("browser:wait-for", async (_event, args: any) => {
    return await browserController.waitFor(args);
  });

  ipcMain.handle("browser:verify-text", async (_event, args: any) => {
    return await browserController.verifyText(args);
  });

  ipcMain.handle("browser:find", async (_event, args: any) => {
    return await browserController.find(args);
  });

  ipcMain.handle("browser:hover", async (_event, args: any) => {
    return await browserController.hover(args);
  });

  ipcMain.handle("browser:paste", async (_event, args: any) => {
    return await browserController.paste(args);
  });

  ipcMain.handle("browser:get-allowed-domains", async () => {
    return browserController.getAllowedDomains();
  });

  ipcMain.handle("browser:set-allowed-domains", async (_event, domains: string[]) => {
    browserController.setAllowedDomains(Array.isArray(domains) ? domains : []);
    return browserController.getAllowedDomains();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopLoopbackAuthServer();
  scheduledTasksManager?.stop();
  for (const [, term] of activeTerminals) {
    try {
      term.process.kill();
    } catch {}
  }
  activeTerminals.clear();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

