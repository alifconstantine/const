import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  openExternal: (url: string) => ipcRenderer.invoke("auth:open-external", url),
  onAuthCallback: (callback: (data: { url: string; token?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("auth:deep-link", handler);
    return () => ipcRenderer.removeListener("auth:deep-link", handler);
  },
});
