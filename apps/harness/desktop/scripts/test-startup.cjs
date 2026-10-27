const { mkdtempSync, mkdirSync, rmSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function main() {
  const root = path.resolve(__dirname, "..");
  if (!existsSync(path.join(root, "dist-electron/main.js"))) {
    throw new Error("Run the desktop build before test:startup.");
  }
  const temporary = mkdtempSync(path.join(tmpdir(), "const-startup-test-"));
  try {
    const home = path.join(temporary, "home");
    mkdirSync(home);
    const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_DATA_HOME: path.join(temporary, "data") };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.VITE_DEV_SERVER_URL;
    const child = spawn(require("electron"), [path.join(root, "tests/startup.integration.cjs"), temporary, root], {
      cwd: temporary, env, stdio: "inherit", windowsHide: true,
    });
    const timer = setTimeout(() => { console.error("Electron startup test timed out"); child.kill(); }, 45_000);
    try {
      process.exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve(code ?? 1));
      });
    } finally { clearTimeout(timer); }
  } finally {
    // Only remove this test's uniquely created directory within the OS temp root.
    if (path.dirname(path.resolve(temporary)) === path.resolve(tmpdir()) && path.basename(temporary).startsWith("const-startup-test-")) {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
