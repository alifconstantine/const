import { contextBridge, ipcRenderer, webFrame } from "electron";

// Bridge Electron APIs to the Renderer window
contextBridge.exposeInMainWorld("electron", {
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
  }) => ipcRenderer.invoke("agent:send-message", payload),
  abortAgent: (conversationId?: string) => ipcRenderer.invoke("agent:abort", conversationId),
  updateMode: (payload: { mode: "ask_before_changes" | "full_access"; conversationId?: string }) =>
    ipcRenderer.invoke("agent:update-mode", payload),
  respondApproval: (payload: {
    conversationId: string;
    approvalId: string;
    decision: "allow_once" | "allow_conversation" | "allow_project" | "allow_always" | "deny" | "skip";
    feedback?: string;
  }) => ipcRenderer.invoke("agent:respond-approval", payload),
  getRunningSessions: () => ipcRenderer.invoke("agent:get-running-sessions"),
  onSessionStarted: (callback: (data: { conversationId: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:session-started", handler);
    return () => ipcRenderer.removeListener("agent:session-started", handler);
  },
  onSessionEnded: (callback: (data: { conversationId: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:session-ended", handler);
    return () => ipcRenderer.removeListener("agent:session-ended", handler);
  },
  rollbackFile: (record: any) => ipcRenderer.invoke("agent:rollback-file", { record }),
  getModels: () => ipcRenderer.invoke("agent:get-models"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: any) => ipcRenderer.invoke("config:save", config),
  generateTitle: (prompt: string, authToken?: string) => ipcRenderer.invoke("agent:generate-title", prompt, authToken),
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
  readFile: (filePath: string) => ipcRenderer.invoke("workspace:read-file", filePath),
  resolveWorkspacePath: (options?: { project?: string; conversationId?: string }) =>
    ipcRenderer.invoke("workspace:resolve-path", options),
  openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath),
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
  listBackgroundTasks: () => ipcRenderer.invoke("tasks:list"),
  killBackgroundTask: (taskId: string) => ipcRenderer.invoke("tasks:kill", taskId),
  getBackgroundTaskLogs: (taskId: string) => ipcRenderer.invoke("tasks:get-output", taskId),
  killSubAgent: (agentId: string) => ipcRenderer.invoke("subagents:kill", agentId),
  onBackgroundTaskEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("task:event", handler);
    return () => ipcRenderer.removeListener("task:event", handler);
  },
});
