const assert = require("node:assert/strict");
const { spawn, execFile } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { createServer } = require("node:net");
const { promisify } = require("node:util");

async function main() {
  const root = path.resolve(__dirname, "..");
  const temp = mkdtempSync(path.join(tmpdir(), "const-side-chat-test-"));
  const portServer = createServer();
  await new Promise((resolve, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const vite = path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js");
  const server = spawn(process.execPath, [vite, "--config", "tests/vite.config.ts", "--port", String(port)], { cwd: root, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/tests/side-chat.html`;
  try {
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      try { ready = (await fetch(url)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error("Side chat fixture server did not start");
    const browser = process.env.CHROME_BIN || "chromium";
    const { stdout } = await promisify(execFile)(browser, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--user-data-dir=${temp}`, "--virtual-time-budget=7000", "--dump-dom", url], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    const match = stdout.match(/<output id="fixture-result">([^<]+)<\/output>/);
    assert.ok(match, "fixture did not complete");
    const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    assert.equal(result.idleCommits, 0, "side chat continues rendering while idle");
    assert.ok(result.updates <= 1, "model synchronization updates repeatedly");
    assert.equal(result.editor, true);
    assert.equal(result.sentKind, "companion");
    assert.equal(result.snapshot, true);
    assert.equal(result.responseRestored, true);
    assert.equal(result.steeredParent, "parent");
    assert.equal(result.steeredRun, "parent-run");
    assert.equal(result.receipt, true);
    assert.equal(result.storedReceipt, "plan_updated");
    console.log("Side chat fixture passed:", JSON.stringify(result));
  } finally {
    server.kill();
    rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
