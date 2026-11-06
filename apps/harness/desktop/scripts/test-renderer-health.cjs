const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'const-renderer-tests-'));
  let child;
  try {
    const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
    await build({ entryPoints: [path.join(root, 'tests/renderer-performance.fixture.tsx')], bundle: true,
      platform: 'browser', format: 'iife', jsx: 'automatic', outfile: path.join(temp, 'fixture.js'),
      define: { 'process.env.NODE_ENV': JSON.stringify('development'), 'import.meta.env': '{}' },
      alias: { '@const/ui': path.resolve(root, '../../../packages/ui/src'), react: path.dirname(require.resolve('react/package.json')), 'react-dom/client': require.resolve('react-dom/client') },
      loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.mp3': 'dataurl' },
    });
    fs.writeFileSync(path.join(temp, 'index.html'), '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="fixture.js"></script>');
    await build({ entryPoints: [path.join(root, 'tests/renderer-health.integration.ts')], bundle: true,
      platform: 'node', format: 'cjs', external: ['electron'], outfile: path.join(temp, 'test.cjs') });
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(require('electron'), [path.join(temp, 'test.cjs'), temp], { env, stdio: 'inherit', windowsHide: true });
    const timer = setTimeout(() => child.kill(), 90_000);
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); }).finally(() => clearTimeout(timer));
  } finally { child?.kill(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
