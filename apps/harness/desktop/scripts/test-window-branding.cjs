const { createRequire } = require("node:module");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function main() {
  const root = path.resolve(__dirname, "..");
  const temporary = mkdtempSync(path.join(tmpdir(), "const-window-branding-"));
  try {
    const fromVite = createRequire(require.resolve("vite/package.json"));
    const entry = path.join(temporary, "branding-test.cjs");
    await fromVite("esbuild").build({
      entryPoints: [path.join(root, "tests/window-branding.integration.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: entry,
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(
      require("electron"),
      [entry, path.join(temporary, "profile"), root],
      { env, stdio: "inherit", windowsHide: true },
    );
    const timeout = setTimeout(() => child.kill(), 30_000);
    try {
      process.exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve(code ?? 1));
      });
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    // Only remove this runner's uniquely generated directory under the OS temp root.
    if (
      path.dirname(path.resolve(temporary)) === path.resolve(tmpdir()) &&
      path.basename(temporary).startsWith("const-window-branding-")
    )
      rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
