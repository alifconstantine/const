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
      const project = path.join(temporary, "project");
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, "reference.txt"), "original");
      const directories = await window.webContents.executeJavaScript(`Promise.all(['a','b','c','d'].map(id => window.electron.resolveWorkspacePath({project:${JSON.stringify(project)},conversationId:'isolation_'+id})))`);
      assert.equal(new Set(directories).size, 4);
      for (const [index, directory] of directories.entries()) {
        assert.notEqual(directory, project);
        assert.equal(fs.readFileSync(path.join(directory, "reference.txt"), "utf8"), "original");
        fs.mkdirSync(path.join(directory, "fernhollow"));
        fs.writeFileSync(path.join(directory, "fernhollow/index.html"), String(index));
      }
      assert.equal(fs.existsSync(path.join(project, "fernhollow")), false);
      console.log("PASS: production workspace IPC isolates four tasks in the same project");
      const terminal = await window.webContents.executeJavaScript(`window.electron.terminal.create({id:'isolation-terminal',project:${JSON.stringify(project)},conversationId:'isolation_a'})`);
      assert.equal(terminal.success, true);
      assert.equal(terminal.cwd, directories[0]);
      assert.equal(await window.webContents.executeJavaScript(`window.electron.terminal.write({id:'isolation-terminal',data:'echo wrong\\n',conversationId:'isolation_b'})`), false);
      assert.equal(await window.webContents.executeJavaScript(`window.electron.terminal.destroy('isolation-terminal','isolation_b')`), false);
      assert.equal(await window.webContents.executeJavaScript(`window.electron.terminal.destroy('isolation-terminal','isolation_a')`), true);
      console.log("PASS: production terminals start in the task directory and reject another owner's controls");
      const { createServer } = require("node:http");
      let requests = 0;
      const mock = createServer((_req, res) => { requests++; res.writeHead(500); res.end('fixture'); });
      await new Promise(resolve => mock.listen(0, "127.0.0.1", resolve));
      try {
        const baseUrl = `http://127.0.0.1:${mock.address().port}/v1`;
        await window.webContents.executeJavaScript(`window.electron.saveConfig({autoCheckUpdates:false,customModels:[{id:'isolation-model',provider:'isolation-provider',baseUrl:${JSON.stringify(baseUrl)}}],providers:{'isolation-provider':{name:'fixture',baseUrl:${JSON.stringify(baseUrl)},apiKey:'test'}}})`);
        const [run] = await window.webContents.executeJavaScript(`Promise.all([window.electron.sendMessage({conversationId:'isolation_cancel',workspacePath:${JSON.stringify(project)},model:'isolation-model',messages:[{role:'user',content:'Never execute this cancelled task'}]}),window.electron.abortAgent('isolation_cancel')])`);
        assert.equal(run.success, false);
        assert.equal(requests, 0, "A task cancelled during allocation must never reach the model");
        assert.deepEqual(await window.webContents.executeJavaScript(`window.electron.getRunningSessions()`), []);
        console.log("PASS: cancelling during workspace allocation prevents a late agent run");
      } finally { await new Promise(resolve => mock.close(resolve)); }
      app.exit(0);
    } catch (error) { fail(error); }
  });
  window.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) fail(new Error(`Renderer load failed (${code}): ${description}`));
  });
});

try { require(path.join(root, "dist-electron/main.js")); }
catch (error) { fail(error); }
