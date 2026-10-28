const { createRequire } = require('node:module');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  const temp = mkdtempSync(path.join(tmpdir(), 'const-remote-ui-tests-'));
  let server;
  let builder;
  let child;
  try {
    const fromVite = createRequire(require.resolve('vite/package.json'));
    const entry = path.join(temp, 'tests.cjs');
    await fromVite('esbuild').build({
      entryPoints: [path.join(root, 'tests/remote-workspace.integration.ts')],
      bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: entry,
    });
    console.log('Building isolated remote workspace fixture…');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    const output = path.join(temp, 'site');
    builder = spawn(process.execPath, [viteBin, 'build', '--config', 'tests/remote-workspace.vite.ts', '--outDir', output, '--logLevel', 'error'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    const buildCode = await new Promise((resolve, reject) => {
      builder.on('error', reject);
      builder.on('exit', resolve);
    });
    if (buildCode !== 0) throw new Error(`Fixture build failed (${buildCode})`);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
    server = createServer((request, response) => {
      const file = path.resolve(output, '.' + new URL(request.url, 'http://fixture').pathname);
      if (!file.startsWith(output + path.sep)) { response.writeHead(403).end(); return; }
      try { response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
      catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/tests/remote-workspace.html`;
    console.log('Fixture ready; running Chromium checks…');
    child = spawn(require('electron'), [entry, temp, url], { env, stdio: 'inherit', windowsHide: true });
    const timer = setTimeout(() => child.kill(), 120_000);
    process.exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', code => resolve(code ?? 1));
    }).finally(() => clearTimeout(timer));
  } finally {
    child?.kill();
    if (builder && builder.exitCode === null) builder.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    if (path.dirname(path.resolve(temp)) === path.resolve(tmpdir()) && path.basename(temp).startsWith('const-remote-ui-tests-'))
      rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
