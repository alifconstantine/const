import { contextBridge, ipcRenderer } from "electron";

// Bridge Electron APIs to the Renderer window
contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  openExternal: (url: string) => ipcRenderer.invoke("auth:open-external", url),
  openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath),
  showItemInFolder: (targetPath: string) => ipcRenderer.invoke("shell:show-item-in-folder", targetPath),
  getDownloadsPath: () => ipcRenderer.invoke("app:get-downloads-path"),
  readFile: (filePath: string) => ipcRenderer.invoke("workspace:read-file", filePath),
  readMedia: (filePath: string) => ipcRenderer.invoke("workspace:read-media", filePath),
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
  openFileDialog: (options?: { multiple?: boolean }) =>
    ipcRenderer.invoke("dialog:open-file", options),
  getDefaultWorkspacePath: (learnId?: string) =>
    ipcRenderer.invoke("workspace:get-default-path", learnId),
  deleteWorkspacePath: (learnId: string) =>
    ipcRenderer.invoke("workspace:delete-dir", learnId),
  listFiles: (folderPath?: string) =>
    ipcRenderer.invoke("workspace:list-files", folderPath),
  startAuth: (options?: { accountsUrl?: string; action?: string }) =>
    ipcRenderer.invoke("auth:start-login", options),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel-login"),
  onAuthCallback: (callback: (data: { url: string; token?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
  onOpenBrowserUrl: (callback: (url: string) => void) => {
    const handler = (_event: any, url: string) => callback(url);
    ipcRenderer.on("app:open-browser-url", handler);
    return () => ipcRenderer.removeListener("app:open-browser-url", handler);
  },
  composio: {
    getAuthLink: (payload: { toolkit: string; userId?: string; callbackUrl?: string; apiKey?: string }) =>
      ipcRenderer.invoke("composio:get-auth-link", payload),
    disconnectAccount: (payload: { accountId: string; apiKey?: string }) =>
      ipcRenderer.invoke("composio:disconnect-account", payload),
    getConnectedAccounts: (payload?: { userId?: string; apiKey?: string }) =>
      ipcRenderer.invoke("composio:get-connected-accounts", payload),
    executeTool: (payload: { toolSlug: string; arguments: any; userId?: string; apiKey?: string }) =>
      ipcRenderer.invoke("composio:execute-tool", payload),
    getUsage: (userId?: string) =>
      ipcRenderer.invoke("composio:get-usage", userId),
  },
  canva: {
    openAuthWindow: (payload: { authUrl: string; redirectUri?: string }) =>
      ipcRenderer.invoke("canva:open-auth-window", payload),
    request: (payload: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }) => ipcRenderer.invoke("canva:request", payload),
  },
  agent: {
    getModels: () => ipcRenderer.invoke("agent:get-models"),
    sendMessage: (payload: {
      messages: any[];
      model?: string;
      workspacePath?: string;
      learnId?: string;
      conversationId?: string;
      authToken?: string;
      mode?: "ask_before_changes" | "full_access";
      thinkingLevel?: string;
      maxOutputTokens?: number;
      systemPrompt?: string;
      temperature?: number;
      mcpServers?: any;
      voiceConfig?: any;
      imageConfig?: any;
      sourcesMarkdown?: string;
    }) => ipcRenderer.invoke("agent:send-message", payload),
    abort: (conversationId?: string) => ipcRenderer.invoke("agent:abort", conversationId),
    answerQuestion: (toolCallId: string, answer: any) =>
      ipcRenderer.invoke("agent:answer-question", { toolCallId, answer }),
    respondApproval: (payload: {
      approvalId: string;
      decision?: string;
      approved?: boolean;
      feedback?: string;
    }) => ipcRenderer.invoke("agent:respond-approval", payload),
    updateMode: (payload: { mode: "ask_before_changes" | "full_access"; learnId?: string }) =>
      ipcRenderer.invoke("agent:update-mode", payload),
    generateTitle: (prompt: string, authToken?: string) =>
      ipcRenderer.invoke("agent:generate-title", prompt, authToken),
    generateCompletion: (payload: {
      messages: { role: string; content: string }[];
      model?: string;
      authToken?: string;
      temperature?: number;
      timeoutMs?: number;
      requestId?: string;
    }) => ipcRenderer.invoke("agent:generate-completion", payload),
    onStudioToken: (callback: (data: { requestId: string; token: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("studio:stream-token", handler);
      return () => ipcRenderer.removeListener("studio:stream-token", handler);
    },
    rollbackFile: (record: any) =>
      ipcRenderer.invoke("agent:rollback-file", { record }),
    webSearch: (query: string, numResults?: number) =>
      ipcRenderer.invoke("agent:web-search", { query, numResults }),
    onStreamEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("agent:stream-event", handler);
      return () => ipcRenderer.removeListener("agent:stream-event", handler);
    },
  },
  rollbackFile: (record: any) =>
    ipcRenderer.invoke("agent:rollback-file", { record }),
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    save: (newConfig: any) => ipcRenderer.invoke("config:save", newConfig),
  },
  inworld: {
    listVoices: (options: { apiKey: string }) =>
      ipcRenderer.invoke("inworld:list-voices", options),
    testVoice: (payload: {
      apiKey: string;
      voiceId: string;
      model?: string;
      text?: string;
      deliveryMode?: string;
      speakingRate?: number;
    }) => ipcRenderer.invoke("inworld:test-voice", payload),
  },
  video: {
    getProjectPath: (payload: { learnId: string; artifactId: string }) =>
      ipcRenderer.invoke("video:get-project-path", payload),
    synthesizeScenes: (payload: {
      learnId: string;
      artifactId: string;
      apiKey: string;
      model?: string;
      voiceId?: string;
      language?: string;
      scenes: Array<{ sceneNumber: number; id: string; narrationText: string }>;
    }) => ipcRenderer.invoke("video:synthesize-scenes", payload),
    stitchAudio: (payload: {
      learnId: string;
      artifactId: string;
      sceneAudios: Array<{
        sceneNumber: number;
        filename: string;
        startMs: number;
      }>;
      totalDurationSeconds: number;
    }) => ipcRenderer.invoke("video:stitch-audio", payload),
    saveComposition: (payload: {
      learnId: string;
      artifactId: string;
      htmlContent: string;
      hyperframesJson?: string;
    }) => ipcRenderer.invoke("video:save-composition", payload),
    renderMp4: (payload: {
      learnId: string;
      artifactId: string;
    }) => ipcRenderer.invoke("video:render-mp4", payload),
    checkStatus: (payload: {
      learnId: string;
      artifactId: string;
      projectPath?: string;
    }) => ipcRenderer.invoke("video:check-status", payload),
    onRenderProgress: (callback: (data: { artifactId: string; chunk: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("video:render-progress", handler);
      return () => {
        ipcRenderer.removeListener("video:render-progress", handler);
      };
    },
  },
  presentation: {
    save: (payload: { learnId: string; artifactId: string; htmlContent: string }) =>
      ipcRenderer.invoke("presentation:save", payload),
    exportPdf: (payload: {
      learnId: string;
      artifactId: string;
      htmlPath?: string;
      htmlContent?: string;
    }) => ipcRenderer.invoke("presentation:export-pdf", payload),
    checkStatus: (payload: { learnId: string; artifactId: string }) =>
      ipcRenderer.invoke("presentation:check-status", payload),
  },
  cheatsheet: {
    exportPdf: (payload: { title: string; htmlContent: string }) =>
      ipcRenderer.invoke("cheatsheet:export-pdf", payload),
  },
  setThemeMode: (mode: "system" | "light" | "dark") =>
    ipcRenderer.invoke("window:set-theme-mode", mode),
  onSystemThemeChange: (callback: (mode: "dark" | "light") => void) => {
    const handler = (_event: any, mode: "dark" | "light") => callback(mode);
    ipcRenderer.on("theme:system-changed", handler);
    return () => ipcRenderer.removeListener("theme:system-changed", handler);
  },
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    toggleFullScreen: () => ipcRenderer.send("window:toggle-fullscreen"),
    toggleDevTools: () => ipcRenderer.send("window:toggle-devtools"),
    reload: () => ipcRenderer.send("window:reload"),
    setZoomLevel: (level: number) => ipcRenderer.invoke("window:set-zoom-level", level),
    getZoomLevel: () => ipcRenderer.invoke("window:get-zoom-level"),
    setThemeMode: (mode: "system" | "light" | "dark") =>
      ipcRenderer.invoke("window:set-theme-mode", mode),
    setTitleBarOverlay: (options: { color?: string; symbolColor?: string; height?: number; themeMode?: "system" | "light" | "dark" }) =>
      ipcRenderer.invoke("window:set-title-bar-overlay", options),
    onMaximizedChange: (callback: (max: boolean) => void) => {
      const handler = (_event: any, max: boolean) => callback(max);
      ipcRenderer.on("window:maximized-change", handler);
      return () => ipcRenderer.removeListener("window:maximized-change", handler);
    },
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke("updater:check"),
    quitAndInstall: () => ipcRenderer.send("updater:quit-and-install"),
  },
  browser: {
    registerTab: (tabId: string, guestContentsId: number) =>
      ipcRenderer.invoke("browser:register-tab", { tabId, guestContentsId }),
    unregisterTab: (tabId: string) =>
      ipcRenderer.invoke("browser:unregister-tab", tabId),
    setActiveTab: (tabId: string) =>
      ipcRenderer.invoke("browser:set-active-tab", tabId),
    listTabs: () => ipcRenderer.invoke("browser:list-tabs"),
    getControl: () => ipcRenderer.invoke("browser:get-control"),
    takeControl: () => ipcRenderer.invoke("browser:take-control"),
    releaseControl: () => ipcRenderer.invoke("browser:release-control"),
    supplySecret: (text: string) => ipcRenderer.invoke("browser:supply-secret", text),
    navigate: (url: string, options?: any) => ipcRenderer.invoke("browser:navigate", url, options),
    snapshot: (args?: any) => ipcRenderer.invoke("browser:snapshot", args),
    click: (args: any) => ipcRenderer.invoke("browser:click", args),
    type: (args: any) => ipcRenderer.invoke("browser:type", args),
    key: (args: any) => ipcRenderer.invoke("browser:key", args),
    scroll: (args: any) => ipcRenderer.invoke("browser:scroll", args),
    screenshot: (args?: any) => ipcRenderer.invoke("browser:screenshot", args),
    console: (args?: any) => ipcRenderer.invoke("browser:console", args),
    evaluate: (args: any) => ipcRenderer.invoke("browser:evaluate", args),
    onControlChanged: (callback: (state: any) => void) => {
      const handler = (_event: any, state: any) => callback(state);
      ipcRenderer.on("browser:control-changed", handler);
      return () => ipcRenderer.removeListener("browser:control-changed", handler);
    },
    onAiAction: (callback: (action: any) => void) => {
      const handler = (_event: any, action: any) => callback(action);
      ipcRenderer.on("browser:ai-action", handler);
      return () => ipcRenderer.removeListener("browser:ai-action", handler);
    },
    onOpenTabRequest: (
      callback: (payload: { url: string; tabId?: string; newTab?: boolean } | string) => void
    ) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on("browser:open-tab-request", handler);
      return () => ipcRenderer.removeListener("browser:open-tab-request", handler);
    },
  },
  mcp: {
    testConnection: (serverConfig: any) =>
      ipcRenderer.invoke("mcp:test-connection", serverConfig),
    disconnect: (serverConfig: any) =>
      ipcRenderer.invoke("mcp:disconnect", serverConfig),
    startOAuth: (payload: { provider: string; authUrl?: string }) =>
      ipcRenderer.invoke("mcp:start-oauth", payload),
    abortOAuth: () => ipcRenderer.invoke("mcp:abort-oauth"),
  },
});

