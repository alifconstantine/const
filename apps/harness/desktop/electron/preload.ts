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
  onAuthCallback: (callback: (data: { url: string; token?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
  sendMessage: (payload: {
    messages: any[];
    model?: string;
    workspacePath?: string;
    mode?: string;
    conversationId?: string;
  }) => ipcRenderer.invoke("agent:send-message", payload),
  abortAgent: () => ipcRenderer.invoke("agent:abort"),
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
});
