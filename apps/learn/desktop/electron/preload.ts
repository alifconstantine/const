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
  onAuthCallback: (callback: (data: { url: string; token?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
  agent: {
    getModels: () => ipcRenderer.invoke("agent:get-models"),
    sendMessage: (payload: { messages: any[]; model?: string; workspacePath?: string }) =>
      ipcRenderer.invoke("agent:send-message", payload),
    abort: () => ipcRenderer.invoke("agent:abort"),
    onStreamEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("agent:stream-event", handler);
      return () => ipcRenderer.removeListener("agent:stream-event", handler);
    },
  },
});
