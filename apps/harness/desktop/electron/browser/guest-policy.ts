import type { Session, WebContents } from "electron";

export const BROWSER_PARTITION = "persist:const_browser";
type NavigationCheck = (url: string) => void;
const ALLOWED_PERMISSIONS = new Set(["clipboard-write", "clipboard-sanitized-write", "fullscreen"]);

/** Install before creating the first browser guest. Also checks redirect targets. */
export function applyBrowserSessionPolicy(browserSession: Session, assertNavigation: NavigationCheck): void {
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== "mainFrame" && details.resourceType !== "subFrame") {
      callback({});
      return;
    }
    try {
      assertNavigation(details.url);
      callback({});
    } catch {
      callback({ cancel: true });
    }
  });
  browserSession.setPermissionRequestHandler((_contents, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  browserSession.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission));
}

/** Enforce guest isolation and navigation before the renderer can attach it. */
export function applyBrowserContentsPolicy(contents: WebContents, assertNavigation: NavigationCheck): void {
  if (contents.getType() === "webview") {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-frame-navigate", (event) => {
      try { assertNavigation(event.url); } catch { event.preventDefault(); }
    });
    contents.on("will-redirect", (event) => {
      try { assertNavigation(event.url); } catch { event.preventDefault(); }
    });
  }
  contents.on("will-attach-webview", (event, preferences, params) => {
    try {
      assertNavigation(params.src || "");
      if (params.partition !== BROWSER_PARTITION) throw new Error("Unexpected browser partition");
    } catch {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    preferences.nodeIntegration = false;
    preferences.nodeIntegrationInSubFrames = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    preferences.webSecurity = true;
    preferences.allowRunningInsecureContent = false;
  });
}
