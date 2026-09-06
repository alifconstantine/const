import { app, BrowserWindow, shell, ipcMain, dialog, nativeTheme } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  createConstAgent,
  DEFAULT_MODELS,
  rollbackFileMutation,
  type AgentMessage,
  type FileMutationRecord,
} from "@const/agent";

// Initialize ~/.const directory hierarchy (Antigravity-aligned)
const constHomeDir = path.join(os.homedir(), ".const");
const constProjectsDir = path.join(constHomeDir, "projects");
const constBrainDir = path.join(constHomeDir, "brain");
const constConversationsDir = path.join(constHomeDir, "conversations");
const constConfigFile = path.join(constHomeDir, "config.json");

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
        !merged.activeModel
      ) {
        merged.activeModel = "gemini-3.6-flash";
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

// Explicitly set app name and userData
app.setName("Const Harness");
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
  win = new BrowserWindow({
    title: "Const Harness",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: isDark ? "#0c0c0c" : "#ffffff",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
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
      win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0c0c0c" : "#ffffff");
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

app.whenReady().then(() => {
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

  // ---------------------------------------------------------------------------
  // Config & Model Management IPC Handlers
  // ---------------------------------------------------------------------------
  ipcMain.handle("config:get", async () => {
    return loadUserConfig();
  });

  ipcMain.handle("config:save", async (_event, newConfig: Partial<UserConfig>) => {
    return saveUserConfig(newConfig);
  });

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
              displayName: m.display_name || m.name || m.id,
              provider: m.provider || "const",
              providerName: m.provider_name || (m.provider === "const" ? "Const" : "Custom"),
              baseUrl: routerBaseUrl,
              supportsThinking,
              supportsTools: Boolean(m.supports_tools ?? true),
              thinkingLevels: m.thinking_levels || m.thinkingLevels || (supportsThinking ? ["low", "medium", "high"] : undefined),
              defaultThinkingLevel: m.default_thinking_level || m.defaultThinkingLevel || "medium",
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
        thinkingLevels: (m as any).thinkingLevels || (supportsThinking ? ["low", "medium", "high"] : undefined),
        defaultThinkingLevel: (m as any).defaultThinkingLevel || "medium",
      };
    });

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const combined: any[] = [];
    for (const m of [...baseModels, ...custom]) {
      const rawId = m.id || "";
      let displayName = m.displayName || m.name || rawId;

      // Align combo display names and thinking properties with official router definitions
      let supportsThinking = m.supportsThinking;
      let thinkingLevels = m.thinkingLevels;
      let defaultThinkingLevel = m.defaultThinkingLevel;

      if (rawId === "combo/auto" || displayName === "Auto Router" || displayName === "Auto (Best Available)" || displayName === "combo/auto") {
        displayName = "combo/auto";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high"];
        defaultThinkingLevel = "medium";
      } else if (rawId === "combo/fast" || displayName === "Low-Latency Fast Chain" || displayName === "Fast (Low Latency)" || displayName === "combo/fast") {
        displayName = "combo/fast";
        supportsThinking = false;
        thinkingLevels = undefined;
      } else if (rawId === "combo/coding" || displayName === "Coding Agent Chain" || displayName === "Coding & Reasoning" || displayName === "combo/coding") {
        displayName = "combo/coding";
        supportsThinking = true;
        thinkingLevels = ["low", "medium", "high"];
        defaultThinkingLevel = "high";
      }

      const item = {
        ...m,
        displayName,
        supportsThinking,
        thinkingLevels,
        defaultThinkingLevel,
      };

      const normId = rawId.toLowerCase().replace(/\s+/g, "-").trim();
      const normName = displayName.toLowerCase().trim();

      if (!normId) continue;
      if (!seenIds.has(normId) && !seenNames.has(normName)) {
        seenIds.add(normId);
        seenNames.add(normName);
        combined.push(item);
      }
    }
    return combined;
  });

  // Dedicated lightweight title generation that never conflicts with activeAgent
  ipcMain.handle("agent:generate-title", async (_event, prompt: string, authToken?: string) => {
    try {
      const config = loadUserConfig();
      const activeProv = config.activeProvider || "const";
      const provCfg = config.providers[activeProv] || config.providers["const"];
      const baseUrl = provCfg?.baseUrl || "https://router.const.web.id/v1";
      let apiKey = provCfg?.apiKey || "";
      if (!apiKey && (activeProv === "const" || activeProv === "const-engine")) {
        apiKey = authToken || process.env.CONST_ROUTER_API_KEY || process.env.CONST_ENGINE_API_KEY || "";
      }
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
              content: `Summarize this user request into a concise 3 to 5 word title. Return ONLY the title text with no punctuation, no quotes, no extra words:\n\n${prompt.slice(0, 300)}`,
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

  // ---------------------------------------------------------------------------
  // Agent & Execution IPC Handlers
  // ---------------------------------------------------------------------------
  let activeAgent: any = null;

  ipcMain.handle(
    "agent:send-message",
    async (
      _event,
      payload: {
        messages: AgentMessage[];
        model?: string;
        thinkingLevel?: string;
        workspacePath?: string;
        mode?: "ask_before_changes" | "full_access";
        conversationId?: string;
        authToken?: string;
      }
    ) => {
      const config = loadUserConfig();
      const model = payload.model || config.activeModel || "gemini-3.6-flash";

      // Match model to provider
      const allModels = [...DEFAULT_MODELS, ...(config.customModels || [])];
      const modelDef = allModels.find((m) => m.id === model || m.displayName === model);
      const providerKey = modelDef?.provider || config.activeProvider || "const";
      const providerCfg = config.providers[providerKey] || config.providers["const"] || config.providers["const-engine"];

      let baseUrl = modelDef?.baseUrl || providerCfg?.baseUrl || "https://router.const.web.id/v1";
      let apiKey = providerCfg?.apiKey || "";

      // Fallback for Const Router: use user's SSO authToken if available
      if (!apiKey && (providerKey === "const" || providerKey === "const-engine")) {
        apiKey = payload.authToken || process.env.CONST_ROUTER_API_KEY || process.env.CONST_ENGINE_API_KEY || "const-local-dev-key";
      }

      const convoId = payload.conversationId || `session_${Date.now()}`;

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
        // Outside Project: run inside dedicated session directory under ~/.const/brain/<convoId>
        targetWorkspace = path.join(constBrainDir, convoId);
        if (!fs.existsSync(targetWorkspace)) {
          fs.mkdirSync(targetWorkspace, { recursive: true });
        }
      }

      activeAgent = createConstAgent({
        baseUrl,
        apiKey,
        model,
        workspacePath: targetWorkspace,
        mode: payload.mode || "ask_before_changes",
        thinkingLevel: payload.thinkingLevel as any,
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
        return {
          success: true,
          messages: updatedMessages,
          workspacePath: targetWorkspace,
          isOutsideProject: !payload.workspacePath || payload.workspacePath === "Outside Project",
        };
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
