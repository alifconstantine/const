const { createRequire } = require('node:module');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  const temp = mkdtempSync(path.join(tmpdir(), 'const-browser-tests-'));
  try {
    const fromVite = createRequire(require.resolve('vite/package.json'));
    const entry = path.join(temp, 'browser-tests.cjs');
    await fromVite('esbuild').build({
      entryPoints: [path.join(root, 'tests/browser.integration.ts')],
      bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: entry,
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(require('electron'), [entry, temp], { env, stdio: 'inherit', windowsHide: true });
    const timer = setTimeout(() => child.kill(), 120_000);
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    }).finally(() => clearTimeout(timer));
    process.exitCode = code;
  } finally {
    // Only remove the uniquely created test directory under the OS temp root.
    if (path.dirname(path.resolve(temp)) === path.resolve(tmpdir()) && path.basename(temp).startsWith('const-browser-tests-')) {
      rmSync(temp, { recursive: true, force: true });
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
