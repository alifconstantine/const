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
      const owners = ['a','b','c','d'];
      const js = code => window.webContents.executeJavaScript(code).catch(error => {
        throw new Error(`Renderer probe failed: ${code.slice(0, 2200)}\n${String(error)}`);
      });
      const directories = await js(`Promise.all(${JSON.stringify(owners)}.map(id => window.electron.resolveWorkspacePath({project:${JSON.stringify(project)},conversationId:'project_'+id})))`);
      assert.deepEqual(directories, owners.map(() => project));
      assert.equal(fs.existsSync(path.join(home, '.const/harness/workspaces')), false);
      for (const owner of owners) {
        await js(`window.electron.saveConversation(${JSON.stringify({
          id: 'project_' + owner, title: owner, project, createdAt: Date.now(), updatedAt: Date.now(), messages: [],
        })})`);
        fs.mkdirSync(path.join(project, 'site-' + owner));
      }
      console.log('PASS: all project chats resolve the actual selected directory without allocating copies');
      // This IPC probe has no xterm to answer fish/zsh capability queries.
      const terminalShell = process.platform === 'win32' ? undefined : '/bin/sh';
      const terminals = await Promise.all(owners.map(owner => js(`window.electron.terminal.create(${JSON.stringify({ id: 'terminal_' + owner, project, conversationId: 'project_' + owner, shell: terminalShell })})`)));
      for (const terminal of terminals) {
        assert.equal(terminal.success, true, terminal.error);
        assert.equal(terminal.cwd, project);
      }
      assert.equal(await js(`window.electron.terminal.resize({id:'terminal_a',cols:111,rows:33,conversationId:'project_a'})`), true);
      assert.equal(await js(`window.electron.terminal.resize({id:'terminal_a',cols:111,rows:33,conversationId:'project_b'})`), false);
      await Promise.all(owners.map(owner => js(`new Promise((resolve, reject) => {
        const owner = ${JSON.stringify(owner)};
        let output = '';
        const timer = setTimeout(() => { cleanup(); reject(new Error('Terminal command timed out: ' + output)); }, 8000);
        const cleanup = window.electron.terminal.onData(payload => {
          if (payload.id !== 'terminal_' + owner || payload.conversationId !== 'project_' + owner) return;
          output += payload.data;
          if (output.split(String.fromCharCode(13)).join(String.fromCharCode(10)).split(String.fromCharCode(10)).some(line => line.trim() === 'TERMINAL_DONE_' + owner)) { clearTimeout(timer); cleanup(); resolve(true); }
        });
        window.electron.terminal.write({id:'terminal_' + owner,conversationId:'project_' + owner,data:'cd site-' + owner + ' && echo ' + owner + ' > owner.txt && echo TERMINAL_DONE_' + owner + String.fromCharCode(13)}).catch(error => { clearTimeout(timer); cleanup(); reject(error); });
      })`)));
      for (const owner of owners) assert.equal(fs.readFileSync(path.join(project, 'site-' + owner, 'owner.txt'), 'utf8').trim(), owner);
      const reattached = await js(`window.electron.terminal.create({id:'terminal_a',project:${JSON.stringify(project)},conversationId:'project_a'})`);
      assert.match(reattached.replay, /TERMINAL_DONE_a/);
      assert(reattached.sequence > 0);
      const foreign = await js(`window.electron.terminal.create(${JSON.stringify({ id: 'foreign-directory', project, conversationId: 'project_a', cwd: temporary, shell: terminalShell })})`);
      assert.equal(foreign.success, false);
      assert.match(foreign.error, /outside/);
      assert.equal(await js(`window.electron.terminal.write({id:'terminal_a',data:'echo wrong'+String.fromCharCode(13),conversationId:'project_b'})`), false);
      assert.equal(await js(`window.electron.terminal.destroy('terminal_a','project_b')`), false);
      for (const owner of owners) assert.equal(await js(`window.electron.terminal.destroy('terminal_${owner}','project_${owner}')`), true);
      console.log('PASS: four project PTYs keep independent cwd/process/output, resize and replay while enforcing control ownership');
      const outside = await js(`window.electron.terminal.create(${JSON.stringify({ id: 'outside-terminal', conversationId: 'outside_a', shell: terminalShell })})`);
      assert.equal(outside.success, true, outside.error);
      assert.equal(outside.cwd, path.join(home, '.const/harness/brain/outside_a'));
      const outsidePeer = await js(`window.electron.terminal.create(${JSON.stringify({ id: 'outside-bad', conversationId: 'outside_b', cwd: outside.cwd, shell: terminalShell })})`);
      assert.equal(outsidePeer.success, false);
      assert.equal(await js(`window.electron.terminal.destroy('outside-terminal','outside_a')`), true);
      console.log('PASS: Outside Project terminals remain in their own workspace');

      const { createServer } = require('node:http');
      const requests = [];
      const mock = createServer(async (req, res) => {
        try {
          const chunks = []; for await (const chunk of req) chunks.push(chunk);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const instruction = body.messages.filter(message => message.role === 'user').map(message => message.content).join('\n');
          const marker = instruction.match(/WORK_([a-z_]+)/)?.[1];
          assert(marker, 'Unrecognized mock task');
          requests.push({ marker, body });
          const toolResults = body.messages.filter(message => message.role === 'tool');
          const cwd = marker === 'outside' ? path.join(home, '.const/harness/brain/agent_outside') : project;
          assert(body.messages.some(message => message.role === 'system' && message.content.includes('Current working directory: ' + cwd)), 'Agent prompt must name the actual cwd');
          assert(!body.messages.some(message => message.role === 'system' && message.content.includes('This task has an isolated working directory')));
          let delta, finish;
          if (marker === 'companion') {
            delta = { content: 'Companion observes the same project.' }; finish = 'stop';
          } else if (!toolResults.length) {
            delta = { tool_calls: [{ index: 0, id: 'cwd_' + marker, type: 'function', function: { name: 'bash', arguments: JSON.stringify({ command: 'node -e "console.log(process.cwd())"' }) } }] };
            finish = 'tool_calls';
          } else if (toolResults.length === 1) {
            assert(String(toolResults[0].content).includes(cwd), 'The shell must execute in the selected directory');
            delta = { tool_calls: [{ index: 0, id: 'write_' + marker, type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: 'output-' + marker + '/index.html', content: marker }) } }] };
            finish = 'tool_calls';
          } else {
            assert(!String(toolResults.at(-1).content).includes('File conflict'));
            delta = { content: 'Output saved in the actual working directory.' }; finish = 'stop';
          }
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: finish }] }) + '\n\ndata: [DONE]\n\n');
        } catch (error) { res.writeHead(500); res.end(String(error)); fail(error); }
      });
      await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
      try {
        const baseUrl = `http://127.0.0.1:${mock.address().port}/v1`;
        await js(`window.electron.saveConfig({autoCheckUpdates:false,customModels:[{id:'directory-model',provider:'directory-provider',baseUrl:${JSON.stringify(baseUrl)}}],providers:{'directory-provider':{name:'fixture',baseUrl:${JSON.stringify(baseUrl)},apiKey:'test'}}})`);
        const startRequest = requests.length;
        const [cancelled] = await js(`Promise.all([window.electron.sendMessage({conversationId:'directory_cancel',workspacePath:${JSON.stringify(project)},model:'directory-model',messages:[{role:'user',content:'WORK_cancelled'}]}),window.electron.abortAgent('directory_cancel')])`);
        assert.equal(cancelled.success, false);
        assert.equal(requests.length, startRequest, 'Cancelled startup must not reach the model');
        console.log('PASS: cancelling during directory resolution prevents a late agent run');
        // Saved project membership also works when the renderer omits workspacePath.
        const outputs = await Promise.all(owners.map(owner => js(`window.electron.sendMessage(${JSON.stringify({conversationId:'project_' + owner,model:'directory-model',mode:'full_access',messages:[{role:'user',content:'WORK_' + owner}]})})`)));
        for (const [index, output] of outputs.entries()) {
          assert.equal(output.success, true, output.error);
          assert.equal(output.workspacePath, project);
          const owner = owners[index];
          assert.equal(fs.readFileSync(path.join(project, 'output-' + owner, 'index.html'), 'utf8'), owner);
          const log = path.join(home, '.const/harness/brain/project_' + owner, '.system_generated/logs/events.jsonl');
          assert(fs.existsSync(log), 'Every chat retains a separate internal event log');
          assert.equal(fs.existsSync(path.join(project, 'output-' + owner, '.system_generated')), false);
          const saved = await js(`window.electron.getConversation('project_${owner}')`);
          assert.equal(saved.project, project);
        }
        assert.equal(fs.readFileSync(path.join(project, 'reference.txt'), 'utf8'), 'original');
        const outsideRun = await js(`window.electron.sendMessage({conversationId:'agent_outside',model:'directory-model',mode:'full_access',messages:[{role:'user',content:'WORK_outside'}]})`);
        assert.equal(outsideRun.success, true, outsideRun.error);
        assert.equal(outsideRun.workspacePath, path.join(home, '.const/harness/brain/agent_outside'));
        assert.equal(fs.readFileSync(path.join(outsideRun.workspacePath, 'output-outside/index.html'), 'utf8'), 'outside');
        const companion = await js(`window.electron.sendMessage({conversationId:'side_chat_directory',parentConversationId:'project_a',sessionKind:'companion',model:'directory-model',messages:[{role:'user',content:'WORK_companion'}]})`);
        assert.equal(companion.success, true, companion.error);
        assert.equal(companion.workspacePath, project);
        console.log('PASS: real agents run shell commands and write outputs in the selected project, while logs and Outside Project stay session-local');
        const scheduled = await js(`window.electron.scheduledTasks.create(${JSON.stringify({title:'Directory regression',instructions:'WORK_scheduled',workspacePath:project,model:'directory-model',schedule:{kind:'hourly'},conversationId:'scheduled_directory'})})`);
        const scheduledRun = await js(`window.electron.scheduledTasks.run(${JSON.stringify(scheduled.id)})`);
        assert.equal(scheduledRun.success, true, scheduledRun.error);
        assert.equal(fs.readFileSync(path.join(project, 'output-scheduled/index.html'), 'utf8'), 'scheduled');
        const scheduledHistory = await js(`window.electron.scheduledTasks.history(${JSON.stringify(scheduled.id)})`);
        assert.equal(scheduledHistory[0].status, 'completed');
        assert.equal(fs.existsSync(path.join(home, '.const/harness/workspaces')), false);
        assert.deepEqual(await js('window.electron.getRunningSessions()'), []);
        console.log('PASS: scheduled tasks use the same actual project directory and never allocate hidden project copies');
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
