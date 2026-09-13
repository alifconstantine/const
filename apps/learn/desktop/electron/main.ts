import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createConstAgent, DEFAULT_MODELS, type AgentMessage } from "@const/agent";
import {
  startLoopbackAuthServer,
  stopLoopbackAuthServer,
  registerLinuxProtocolHandler,
} from "./auth-server.js";

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
  }>;
}

const defaultUserConfig: UserConfig = {
  activeModel: "gemini-3.6-flash",
  activeProvider: "const",
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
        merged.activeModel = "gemini-3.6-flash";
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
  };
  try {
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
  const pendingQuestions = new Map<string, (answer: any) => void>();

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
        approved: boolean;
        feedback?: string;
      }
    ) => {
      if (activeAgent && typeof activeAgent.resolveApproval === "function") {
        const resolved = activeAgent.resolveApproval(payload.approvalId, {
          approvalId: payload.approvalId,
          approved: payload.approved,
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

      activeAgent = createConstAgent({
        baseUrl,
        apiKey,
        model,
        workspacePath: targetWorkspace,
        preset: "learn",
        mode: payload.mode || "full_access",
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

  ipcMain.handle("config:get", async () => {
    return loadUserConfig();
  });

  ipcMain.handle("config:save", async (_event, newConfig: Partial<UserConfig>) => {
    return saveUserConfig(newConfig);
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
