import { contextBridge, ipcRenderer, webFrame, webUtils } from "electron";

// Bridge Electron APIs to the Renderer window
contextBridge.exposeInMainWorld("electron", {
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return (file as any).path || "";
    }
  },
  extractPdfText: (payload: { filePath?: string; bufferBase64?: string }) =>
    ipcRenderer.invoke("file:extract-pdf-text", payload),
  extractDocumentText: (payload: { filePath?: string; bufferBase64?: string; filename?: string }) =>
    ipcRenderer.invoke("file:extract-document-text", payload),
  saveAttachment: (payload: {
    conversationId?: string;
    name: string;
    base64?: string;
    sourcePath?: string;
  }) => ipcRenderer.invoke("file:save-attachment", payload),
  readAsDataUrl: (filePath: string) =>
    ipcRenderer.invoke("file:read-as-data-url", filePath),
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  setZoomFactor: (factor: number) => {
    try {
      webFrame.setZoomFactor(factor);
    } catch {}
    ipcRenderer.invoke("window:set-zoom-factor", factor).catch(() => {});
  },
  getZoomFactor: () => {
    try {
      return webFrame.getZoomFactor();
    } catch {
      return 1.0;
    }
  },
  openExternal: (url: string) => ipcRenderer.invoke("auth:open-external", url),
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
  showNotification: (payload: { title: string; body: string; silent?: boolean }) =>
    ipcRenderer.invoke("system:show-notification", payload),
  openConstFolder: () => ipcRenderer.invoke("system:open-const-folder"),
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
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: any, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on("window:maximized-change", handler);
    return () => ipcRenderer.removeListener("window:maximized-change", handler);
  },
  onAuthCallback: (
    callback: (data: { url: string; token?: string; cancelled?: boolean; error?: string }) => void
  ) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
  startAuth: (options?: { accountsUrl?: string }) =>
    ipcRenderer.invoke("auth:start-login", options),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel-login"),
  sendMessage: (payload: {
    messages: any[];
    model?: string;
    thinkingLevel?: string;
    workspacePath?: string;
    mode?: string;
    conversationId?: string;
    authToken?: string;
    maxOutputTokens?: number;
    contextWindow?: number;
  }) => ipcRenderer.invoke("agent:send-message", payload),
  steerAgent: (payload: { conversationId: string; prompt: string; attachments?: any[] }) =>
    ipcRenderer.invoke("agent:steer", payload),
  abortAgent: (conversationId?: string) => ipcRenderer.invoke("agent:abort", conversationId),
  updateMode: (payload: { mode: "request_review" | "ask_before_changes" | "full_access"; conversationId?: string }) =>
    ipcRenderer.invoke("agent:update-mode", payload),
  respondApproval: (payload: {
    conversationId: string;
    approvalId: string;
    decision: "allow_once" | "full_access" | "allow_conversation" | "allow_project" | "allow_always" | "deny" | "skip";
    feedback?: string;
  }) => ipcRenderer.invoke("agent:respond-approval", payload),
  getRunningSessions: () => ipcRenderer.invoke("agent:get-running-sessions"),
  onSessionStarted: (callback: (data: { conversationId: string; runId?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:session-started", handler);
    return () => ipcRenderer.removeListener("agent:session-started", handler);
  },
  onSessionEnded: (callback: (data: { conversationId: string; runId?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:session-ended", handler);
    return () => ipcRenderer.removeListener("agent:session-ended", handler);
  },
  rollbackFile: (record: any) => ipcRenderer.invoke("agent:rollback-file", { record }),
  getModels: () => ipcRenderer.invoke("agent:get-models"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: any) => ipcRenderer.invoke("config:save", config),
  generateTitle: (prompt: string, authToken?: string, model?: string) =>
    ipcRenderer.invoke("agent:generate-title", prompt, authToken, model),
  onAgentEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:stream-event", handler);
    return () => ipcRenderer.removeListener("agent:stream-event", handler);
  },
  listConversations: (includeArchived?: boolean) => ipcRenderer.invoke("conversations:list", includeArchived),
  listArchivedConversations: () => ipcRenderer.invoke("conversations:list-archived"),
  getConversation: (id: string) => ipcRenderer.invoke("conversations:get", id),
  saveConversation: (convo: any) => ipcRenderer.invoke("conversations:save", convo),
  deleteConversation: (id: string) => ipcRenderer.invoke("conversations:delete", id),
  renameConversation: (id: string, title: string) => ipcRenderer.invoke("conversations:rename", id, title),
  archiveConversation: (id: string) => ipcRenderer.invoke("conversations:archive", id),
  unarchiveConversation: (id: string) => ipcRenderer.invoke("conversations:unarchive", id),
  pinConversation: (id: string, isPinned: boolean) => ipcRenderer.invoke("conversations:pin", id, isPinned),
  pinProject: (projectName: string, isPinned: boolean) => ipcRenderer.invoke("conversations:pin-project", projectName, isPinned),
  getProjectPins: () => ipcRenderer.invoke("conversations:get-project-pins"),
  getConversationPaths: (conversationId?: string, workspacePath?: string) =>
    ipcRenderer.invoke("conversations:get-paths", conversationId, workspacePath),
  getTranscript: (conversationId: string) => ipcRenderer.invoke("conversations:get-transcript", conversationId),
  importLegacyConversations: (convos: any[]) => ipcRenderer.invoke("conversations:import-legacy", convos),
  listFiles: (workspacePath?: string) => ipcRenderer.invoke("workspace:list-files", workspacePath),
  readDirectory: (dirPath?: string, workspacePath?: string) =>
    ipcRenderer.invoke("workspace:read-directory", dirPath, workspacePath),
  readFile: (filePath: string, workspacePath?: string) =>
    ipcRenderer.invoke("workspace:read-file", filePath, workspacePath),
  resolveWorkspacePath: (options?: { project?: string; conversationId?: string }) =>
    ipcRenderer.invoke("workspace:resolve-path", options),
  openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath),
  showInFolder: (targetPath: string) => ipcRenderer.invoke("shell:show-in-folder", targetPath),
  onConversationsChanged: (callback: (data: { conversationId?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("conversations:changed", handler);
    return () => ipcRenderer.removeListener("conversations:changed", handler);
  },
  scheduledTasks: {
    list: () => ipcRenderer.invoke("scheduled-tasks:list"),
    create: (data: any) => ipcRenderer.invoke("scheduled-tasks:create", data),
    update: (data: any) => ipcRenderer.invoke("scheduled-tasks:update", data),
    delete: (id: string) => ipcRenderer.invoke("scheduled-tasks:delete", id),
    run: (id: string) => ipcRenderer.invoke("scheduled-tasks:run", id),
    history: (taskId?: string) => ipcRenderer.invoke("scheduled-tasks:history", taskId),
    deleteRun: (id: string) => ipcRenderer.invoke("scheduled-tasks:delete-run", id),
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("scheduled-tasks:changed", handler);
      return () => ipcRenderer.removeListener("scheduled-tasks:changed", handler);
    },
  },
  memory: {
    list: (options?: { scope?: "project" | "global" | "all"; workspacePath?: string }) =>
      ipcRenderer.invoke("memory:list", options),
    read: (filePath: string) => ipcRenderer.invoke("memory:read", filePath),
    save: (filePath: string, content: string) => ipcRenderer.invoke("memory:save", filePath, content),
    delete: (filePath: string) => ipcRenderer.invoke("memory:delete", filePath),
    openInFolder: (filePath: string) => ipcRenderer.invoke("memory:open-in-folder", filePath),
    getConfig: () => ipcRenderer.invoke("memory:get-config"),
    saveConfig: (config: { workspaceMemoryEnabled?: boolean }) =>
      ipcRenderer.invoke("memory:save-config", config),
  },
  terminal: {
    create: (options: {
      id: string;
      cwd?: string;
      project?: string;
      conversationId?: string;
      shell?: string;
      cols?: number;
      rows?: number;
    }) => ipcRenderer.invoke("terminal:create", options),
    write: (options: { id: string; data: string }) =>
      ipcRenderer.invoke("terminal:write", options),
    destroy: (id: string) =>
      ipcRenderer.invoke("terminal:destroy", id),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
    onExit: (callback: (data: { id: string; code: number | null }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
  },
  answerQuestion: (toolCallId: string, answer: any) =>
    ipcRenderer.invoke("agent:answer-question", { toolCallId, answer }),
  listBackgroundTasks: (conversationId?: string) => ipcRenderer.invoke("tasks:list", conversationId),
  killBackgroundTask: (taskId: string, conversationId?: string) => ipcRenderer.invoke("tasks:kill", taskId, conversationId),
  getBackgroundTaskLogs: (taskId: string) => ipcRenderer.invoke("tasks:get-output", taskId),
  killSubAgent: (agentId: string) => ipcRenderer.invoke("subagents:kill", agentId),
  onBackgroundTaskEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("task:event", handler);
    return () => ipcRenderer.removeListener("task:event", handler);
  },
  browser: {
    registerTab: (tabId: string, guestContentsId: number) =>
      ipcRenderer.invoke("browser:register-tab", { tabId, guestContentsId }),
    unregisterTab: (tabId: string) =>
      ipcRenderer.invoke("browser:unregister-tab", tabId),
    setActiveTab: (tabId: string) =>
      ipcRenderer.invoke("browser:set-active-tab", tabId),
    listTabs: () =>
      ipcRenderer.invoke("browser:list-tabs"),
    getControl: () =>
      ipcRenderer.invoke("browser:get-control"),
    takeControl: () =>
      ipcRenderer.invoke("browser:take-control"),
    releaseControl: () =>
      ipcRenderer.invoke("browser:release-control"),
    supplySecret: (text: string) =>
      ipcRenderer.invoke("browser:supply-secret", text),
    navigate: (url: string, options?: any) =>
      ipcRenderer.invoke("browser:navigate", url, options),
    snapshot: (args?: any) =>
      ipcRenderer.invoke("browser:snapshot", args),
    click: (args: any) =>
      ipcRenderer.invoke("browser:click", args),
    type: (args: any) =>
      ipcRenderer.invoke("browser:type", args),
    key: (args: any) =>
      ipcRenderer.invoke("browser:key", args),
    scroll: (args: any) =>
      ipcRenderer.invoke("browser:scroll", args),
    screenshot: (args?: any) =>
      ipcRenderer.invoke("browser:screenshot", args),
    console: (args?: any) =>
      ipcRenderer.invoke("browser:console", args),
    evaluate: (args: any) =>
      ipcRenderer.invoke("browser:evaluate", args),
    waitFor: (args: any) =>
      ipcRenderer.invoke("browser:wait-for", args),
    verifyText: (args: any) =>
      ipcRenderer.invoke("browser:verify-text", args),
    find: (args: any) =>
      ipcRenderer.invoke("browser:find", args),
    hover: (args: any) =>
      ipcRenderer.invoke("browser:hover", args),
    paste: (args: any) =>
      ipcRenderer.invoke("browser:paste", args),
    getAllowedDomains: () =>
      ipcRenderer.invoke("browser:get-allowed-domains"),
    setAllowedDomains: (domains: string[]) =>
      ipcRenderer.invoke("browser:set-allowed-domains", domains),
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
    onOpenTabRequest: (callback: (data: { url: string; tabId?: string; newTab?: boolean }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("browser:open-tab-request", handler);
      return () => ipcRenderer.removeListener("browser:open-tab-request", handler);
    },
    openTab: (url: string, options?: { tabId?: string; newTab?: boolean }) =>
      ipcRenderer.invoke("browser:open-tab", { url, ...options }),
  },
  computer: {
    getCapabilities: () => ipcRenderer.invoke("computer:get-capabilities"),
    listApps: () => ipcRenderer.invoke("computer:list-apps"),
  },
  mcp: {
    list: (workspacePath?: string) => ipcRenderer.invoke("mcp:list", workspacePath),
    save: (input: import("../src/lib/mcp/types").McpSaveInput) => ipcRenderer.invoke("mcp:save", input),
    remove: (id: string, workspacePath?: string) => ipcRenderer.invoke("mcp:remove", id, workspacePath),
    override: (id: string, workspacePath: string) => ipcRenderer.invoke("mcp:override", id, workspacePath),
    connect: (id: string, workspacePath?: string) => ipcRenderer.invoke("mcp:connect", id, workspacePath),
    authenticate: (id: string, workspacePath?: string, language?: string) => ipcRenderer.invoke("mcp:authenticate", id, workspacePath, language),
    disconnect: (id: string, workspacePath?: string) => ipcRenderer.invoke("mcp:disconnect", id, workspacePath),
    onChanged: (callback: () => void) => {
      const handler = () => callback(); ipcRenderer.on("mcp:changed", handler);
      return () => ipcRenderer.removeListener("mcp:changed", handler);
    },
  },
  marketplace: {
    listPlugins: (workspacePath?: string) => ipcRenderer.invoke("marketplace:list-plugins", workspacePath),
    installPlugin: (payload: { name: string; scope: "user" | "workspace"; workspacePath?: string }) => ipcRenderer.invoke("marketplace:install-plugin", payload),
    uninstallPlugin: (payload: { id: string; workspacePath?: string }) => ipcRenderer.invoke("marketplace:uninstall-plugin", payload),
    setEnabled: (payload: { id: string; enabled: boolean; workspacePath?: string }) => ipcRenderer.invoke("marketplace:set-enabled", payload),
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("marketplace:changed", handler);
      return () => ipcRenderer.removeListener("marketplace:changed", handler);
    },
    listInstalled: (workspacePath?: string) =>
      ipcRenderer.invoke("marketplace:list-installed", workspacePath),
    installSkill: (payload: { slug: string; source?: string; skillId?: string; scope?: "user" | "workspace"; workspacePath?: string; requestId?: string }) =>
      ipcRenderer.invoke("marketplace:install-skill", payload),
    cancelSkillInstall: (requestId: string) => ipcRenderer.invoke("marketplace:cancel-skill-install", requestId),
    searchSkills: (query: string) => ipcRenderer.invoke("marketplace:search-skills", query),
    previewRemoteSkill: (source: string, skillId: string) => ipcRenderer.invoke("marketplace:preview-remote-skill", source, skillId),
    onInstallProgress: (callback: (progress: import("../src/lib/skills/types").SkillInstallProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: import("../src/lib/skills/types").SkillInstallProgress) => callback(progress);
      ipcRenderer.on("marketplace:install-progress", handler);
      return () => ipcRenderer.removeListener("marketplace:install-progress", handler);
    },
    uninstallSkill: (payload: { id: string; workspacePath?: string }) =>
      ipcRenderer.invoke("marketplace:uninstall-skill", payload),
    openSkillsFolder: (payload?: { workspacePath?: string; scope?: "user" | "workspace" }) =>
      ipcRenderer.invoke("marketplace:open-skills-folder", payload),
    getSkillContent: (slug: string, workspacePath?: string) =>
      ipcRenderer.invoke("marketplace:get-skill-content", slug, workspacePath),
  },
});

