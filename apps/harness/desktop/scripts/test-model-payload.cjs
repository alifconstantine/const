const { createRequire } = require("node:module");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function main() {
  const root = path.resolve(__dirname, "..");
  const temporary = mkdtempSync(path.join(tmpdir(), "const-model-payload-"));
  let child;
  try {
    const fromVite = createRequire(require.resolve("vite/package.json"));
    const entry = path.join(temporary, "test.cjs");
    await fromVite("esbuild").build({ entryPoints: [path.join(root, "tests/model-payload.integration.ts")], bundle: true,
      platform: "node", format: "cjs", external: ["electron"], outfile: entry,
      alias: { "@const/agent": path.resolve(root, "../../../packages/agent/src/const/index.ts") } });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(require("electron"), [entry, temporary], { cwd: temporary, env, stdio: "inherit", windowsHide: true });
    const timer = setTimeout(() => child.kill(), 45_000);
    process.exitCode = await new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", code => resolve(code ?? 1)); })
      .finally(() => clearTimeout(timer));
  } finally {
    child?.kill();
    if (path.dirname(temporary) === path.resolve(tmpdir()) && path.basename(temporary).startsWith("const-model-payload-")) rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
