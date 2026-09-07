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
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
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
  pinProject: (projectName: string, isPinned: boolean) => ipcRenderer.invoke("conversations:pin-project", projectName, isPinned),
  getProjectPins: () => ipcRenderer.invoke("conversations:get-project-pins"),
  importLegacyConversations: (convos: any[]) => ipcRenderer.invoke("conversations:import-legacy", convos),
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
});
