import {
  app,
  nativeImage,
  type BrowserWindow,
  type NativeImage,
} from "electron";
import fs from "node:fs";
import path from "node:path";

export const WINDOWS_APP_ID = app.isPackaged
  ? "id.web.const.harness.desktop"
  : "id.web.const.harness.desktop.development";

export interface WindowBranding {
  shellIconPath?: string;
  windowIcon?: NativeImage;
}

/** Keep shell resources outside app.asar, and decode native window pixels from PNG. */
export function loadWindowBranding(): WindowBranding {
  const directories = [
    path.join(process.resourcesPath, "branding"),
    path.join(app.getAppPath(), "build"),
    path.resolve(__dirname, "../build"),
    path.join(app.getAppPath(), "public"),
  ];
  const usable = (candidate: string) => {
    if (!fs.existsSync(candidate)) return false;
    try {
      return !nativeImage.createFromPath(candidate).isEmpty();
    } catch {
      return false;
    }
  };
  const formats =
    process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png"];
  const shellIconPath = directories
    .flatMap((directory) => formats.map((name) => path.join(directory, name)))
    .find(usable);
  const windowIconPath =
    directories
      .map((directory) => path.join(directory, "icon.png"))
      .find(usable) ?? shellIconPath;
  if (!shellIconPath)
    console.warn("[Branding] No usable application icon found.");
  return {
    shellIconPath,
    windowIcon: windowIconPath
      ? nativeImage.createFromPath(windowIconPath)
      : undefined,
  };
}

export function applyWindowBranding(
  window: BrowserWindow,
  branding: WindowBranding,
): void {
  const applyNativeIcon = () => {
    if (
      branding.windowIcon &&
      !branding.windowIcon.isEmpty() &&
      !window.isDestroyed() &&
      process.platform !== "darwin"
    ) {
      // This updates ICON_SMALL and ICON_BIG on the initialized HWND. Setting
      // relaunch properties alone only affects the shell's taskbar shortcut.
      window.setIcon(branding.windowIcon);
    }
  };
  applyNativeIcon();
  window.on("show", applyNativeIcon);
  window.once("ready-to-show", applyNativeIcon);
  if (process.platform === "win32" && branding.shellIconPath) {
    window.setAppDetails({
      appId: WINDOWS_APP_ID,
      appIconPath: branding.shellIconPath,
      appIconIndex: 0,
      relaunchCommand: [
        process.execPath,
        ...(app.isPackaged ? [] : [app.getAppPath()]),
      ]
        .map((argument) => `"${path.resolve(argument)}"`)
        .join(" "),
      relaunchDisplayName: app.getName(),
    });
  }
}
