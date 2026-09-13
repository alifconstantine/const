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
  readFile: (filePath: string) => ipcRenderer.invoke("workspace:read-file", filePath),
  readMedia: (filePath: string) => ipcRenderer.invoke("workspace:read-media", filePath),
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
  openFileDialog: (options?: { multiple?: boolean }) =>
    ipcRenderer.invoke("dialog:open-file", options),
  getDefaultWorkspacePath: (learnId?: string) =>
    ipcRenderer.invoke("workspace:get-default-path", learnId),
  startAuth: (options?: { accountsUrl?: string; action?: string }) =>
    ipcRenderer.invoke("auth:start-login", options),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel-login"),
  onAuthCallback: (callback: (data: { url: string; token?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
  agent: {
    getModels: () => ipcRenderer.invoke("agent:get-models"),
    sendMessage: (payload: {
      messages: any[];
      model?: string;
      workspacePath?: string;
      learnId?: string;
      authToken?: string;
      mode?: "ask_before_changes" | "full_access";
      thinkingLevel?: string;
      maxOutputTokens?: number;
    }) => ipcRenderer.invoke("agent:send-message", payload),
    abort: () => ipcRenderer.invoke("agent:abort"),
    answerQuestion: (toolCallId: string, answer: any) =>
      ipcRenderer.invoke("agent:answer-question", { toolCallId, answer }),
    respondApproval: (payload: {
      approvalId: string;
      decision?: string;
      approved?: boolean;
      feedback?: string;
    }) => ipcRenderer.invoke("agent:respond-approval", payload),
    generateTitle: (prompt: string, authToken?: string) =>
      ipcRenderer.invoke("agent:generate-title", prompt, authToken),
    rollbackFile: (record: any) =>
      ipcRenderer.invoke("agent:rollback-file", { record }),
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
});
