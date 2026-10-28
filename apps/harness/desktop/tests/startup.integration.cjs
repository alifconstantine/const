// Load the actual production bundle in Electron, with an isolated profile and no
// protocol registration, startup setting changes, external traffic, or visible UI.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app } = require("electron");
assert.equal(typeof globalThis.crypto?.subtle?.encrypt, "function", "Remote relay requires WebCrypto in Electron main");
assert.equal(typeof globalThis.CompressionStream, "function", "Remote transfers require bounded gzip streams");

const [temporary, root] = process.argv.slice(2);
assert(temporary && root, "Missing isolated profile or desktop root");
const home = path.join(temporary, "home");
const appData = path.join(temporary, "app-data");
fs.mkdirSync(appData, { recursive: true });
os.homedir = () => home;
app.setPath("home", home);
app.setPath("appData", appData);
app.setPath("userData", path.join(appData, "Const Harness"));
app.getAppPath = () => root;
app.setAsDefaultProtocolClient = () => true;
app.setLoginItemSettings = () => {};
process.loadEnvFile = () => {};

function fail(error) { console.error(error); app.exit(1); }
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
app.on("session-created", (session) => {
  session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (_request, callback) => callback({ cancel: true }));
});
app.on("browser-window-created", (_event, window) => {
  window.show = () => {};
  window.webContents.once("did-finish-load", async () => {
    try {
      const status = await window.webContents.executeJavaScript("window.electron.remote.getStatus()");
      assert.equal(status.status, "idle");
      assert.equal(status.pairingUrl, null);
      assert(!window.isVisible());
      console.log("PASS: production main, preload, renderer, and remote IPC start in Electron");
      app.exit(0);
    } catch (error) { fail(error); }
  });
  window.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) fail(new Error(`Renderer load failed (${code}): ${description}`));
  });
});

try { require(path.join(root, "dist-electron/main.js")); }
catch (error) { fail(error); }
