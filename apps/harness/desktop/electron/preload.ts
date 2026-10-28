import { contextBridge, ipcRenderer, webFrame, webUtils } from "electron";
import { createDesktopBridge } from "../src/lib/desktop-bridge";

contextBridge.exposeInMainWorld("electron", createDesktopBridge(ipcRenderer, webFrame, webUtils, process.platform, { node: process.versions.node, chrome: process.versions.chrome, electron: process.versions.electron }));
