import assert from "node:assert/strict";
import path from "node:path";
import { app, BrowserWindow, nativeImage } from "electron";
import {
  applyWindowBranding,
  loadWindowBranding,
  WINDOWS_APP_ID,
} from "../electron/window-branding";

const [temporaryProfile, appRoot] = process.argv.slice(2);
if (!temporaryProfile || !appRoot)
  throw new Error("Missing isolated test profile or app root.");
app.setPath("userData", temporaryProfile);
app.setName("Const Harness");
app.getAppPath = () => appRoot;

app
  .whenReady()
  .then(async () => {
    const branding = loadWindowBranding();
    assert(branding.windowIcon && !branding.windowIcon.isEmpty());
    assert.equal(
      branding.shellIconPath,
      path.join(
        appRoot,
        "build",
        process.platform === "win32" ? "icon.ico" : "icon.png",
      ),
    );
    assert(
      branding.windowIcon
        .toPNG()
        .equals(
          nativeImage
            .createFromPath(path.join(appRoot, "build", "icon.png"))
            .toPNG(),
        ),
    );
    if (process.platform === "win32") app.setAppUserModelId(WINDOWS_APP_ID);
    const window = new BrowserWindow({
      show: false,
      frame: false,
      icon: branding.windowIcon,
    });
    const messages: Array<{ kind: number; handle: bigint }> = [];
    if (process.platform === "win32") {
      window.hookWindowMessage(0x80, (kind, handle) => {
        messages.push({
          kind: kind.readUInt32LE(),
          handle:
            handle.length === 8
              ? handle.readBigUInt64LE()
              : BigInt(handle.readUInt32LE()),
        });
      });
    }
    applyWindowBranding(window, branding);
    if (process.platform === "win32") {
      assert(
        messages.some((message) => message.kind === 0 && message.handle !== 0n),
        "ICON_SMALL must be set on the HWND after construction.",
      );
      assert(
        messages.some((message) => message.kind === 1 && message.handle !== 0n),
        "ICON_BIG must be set on the HWND after construction.",
      );
      assert.equal(WINDOWS_APP_ID, "id.web.const.harness.desktop");
      const beforeShow = messages.length;
      // Exercise the lifecycle handler without displaying a test window.
      window.emit("show");
      assert(
        messages.length > beforeShow,
        "The native icon must be reapplied after show.",
      );
      const beforeReady = messages.length;
      window.emit("ready-to-show");
      assert(
        messages.length > beforeReady,
        "The native icon must be reapplied after renderer initialization.",
      );
    }
    assert(!window.isVisible());
    window.destroy();
    console.log("PASS: native small/large icons and window lifecycle branding");
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
