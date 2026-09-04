import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "node:path";

// Explicitly set app name and userData so ALL instances share the EXACT SAME lock directory
app.setName("Const Learn");
const userDataPath = path.join(app.getPath("appData"), "Const Learn");
app.setPath("userData", userDataPath);

// Request Single Instance Lock FIRST
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // SECOND INSTANCE: Exit IMMEDIATELY so no second window or task is spawned!
  app.quit();
  process.exit(0);
}

// Register custom protocol scheme: const-learn://
const PROTOCOL_NAME = "const-learn";

if (!app.isPackaged) {
  // In development, register with exact main script path so Windows launches with same config
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
  // Fallback regex matching
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
    const match = rawArg.match(/const-learn:\/\/[^\s"']+/);
    const deepLinkUrl = match ? match[0] : rawArg;
    sendDeepLinkToRenderer(deepLinkUrl);
  }
});

  // Handle protocol on macOS
  app.on("open-url", (event, url) => {
    event.preventDefault();
    sendDeepLinkToRenderer(url);
  });

  function createWindow() {
    win = new BrowserWindow({
      title: "Const Learn",
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.webContents.on("did-finish-load", () => {
      if (pendingDeepLink) {
        sendDeepLinkToRenderer(pendingDeepLink);
        pendingDeepLink = null;
      }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(process.env.VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
    } else {
      win.loadFile(path.join(__dirname, "../dist/index.html"));
    }
  }

  // IPC Handlers
  ipcMain.handle("auth:open-external", async (_event, url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  app.whenReady().then(() => {
    // Check if launched directly with a deep link on cold start
    const initialArg = process.argv.find((arg) =>
      arg.includes(`${PROTOCOL_NAME}://`)
    );
    if (initialArg) {
      const match = initialArg.match(/const-learn:\/\/[^\s"']+/);
      pendingDeepLink = match ? match[0] : initialArg;
    }

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
