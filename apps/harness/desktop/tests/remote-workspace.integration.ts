import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

app.setPath("userData", process.argv[2]!);
app.on("window-all-closed", () => {});
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  console.log(`PASS ${++passed}: ${name}`);
}

async function run() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, frame: false, width: 1280, height: 900, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: true } });
  const motionPreference = (value: string) => win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });
  const js = (code: string) => win.webContents.executeJavaScript(code);
  const capture = async (name: string, settleMs = 250) => {
    const directory = process.env.CONST_REMOTE_UI_SCREENSHOTS;
    if (!directory) return;
    await mkdir(directory, { recursive: true });
    if (settleMs) await delay(settleMs);
    await writeFile(path.join(directory, name + ".png"), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  };
  const waitFor = async (code: string) => {
    for (let index = 0; index < 150; index++) {
      if (await js(code)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${code}; page: ${await js('document.body.innerText.slice(0, 1800)')}`);
  };
  await win.loadURL(process.argv[3]!);
  win.webContents.debugger.attach("1.3");
  await motionPreference("no-preference");
  await waitFor('Boolean(document.querySelector(".workspace-shell"))');
  await waitFor('document.body.innerText.includes("Review remote integration")');
  await js(`Array.from(document.querySelectorAll('.workspace-sidebar span')).find(element => element.textContent === 'Review remote integration').click()`);
  await waitFor('document.body.innerText.includes("Audit the remote workspace.")');

  await check("opening and closing the sidepanel does not reparse unchanged chat history", async () => {
    await js(`(() => {
      const messages = Array.from({length:12}, (_, index) => ({
        id:'perf-'+index, role:'assistant', timestamp:Date.now(),
        content:Array.from({length:16}, (_, paragraph) => 'Performance paragraph '+index+'-'+paragraph+' with **bold text**, inline code and [a link](https://example.invalid).').join('\\n\\n')
      }));
      window.__remoteFixture.updateConversation('preview-chat', {messages});
    })()`);
    await waitFor('document.body.innerText.includes("Performance paragraph 11-15")');
    await delay(400);
    await js(`window.__remoteFixture.markdownWork.blocks = 0; window.__remoteFixture.markdownWork.inline = 0`);
    for (let index = 0; index < 2; index++) {
      const moving = js(`new Promise(resolve => {
        const chat = document.querySelector('.workspace-chat');
        const panel = document.querySelector('.workspace-right-pane');
        const samples = [];
        const start = performance.now();
        const sample = now => {
          const c = chat.getBoundingClientRect(), p = panel.getBoundingClientRect();
          samples.push({at:now-start, width:c.width, gap:p.left-c.right});
          if (now-start < 380) requestAnimationFrame(sample);
          else resolve(samples);
        };
        sample(start);
        document.querySelector('button[aria-label="Toggle right sidebar"]').click();
      })`);
      if (process.env.CONST_REMOTE_UI_SCREENSHOTS) {
        await delay(70);
        await capture(index === 0 ? "sidepanel-opening" : "sidepanel-closing", 0);
      }
      const samples = await moving;
      const distinctWidths = new Set(samples.map((sample: any) => Math.round(sample.width)));
      assert.ok(distinctWidths.size >= 4, `Panel motion jumped between ${distinctWidths.size} chat widths`);
      const maxGapError = Math.max(...samples.map((sample: any) => Math.abs(sample.gap - 10)));
      assert.ok(maxGapError < 3, `Panel and chat motion separated by ${maxGapError.toFixed(1)}px`);
      console.log(`Panel ${index === 0 ? "opening" : "closing"}: ${distinctWidths.size} intermediate widths, maximum gap error ${maxGapError.toFixed(2)}px`);
      if (index === 0) await capture("sidepanel-open");
    }
    const work = await js(`({...window.__remoteFixture.markdownWork})`);
    console.log('Sidepanel Markdown work for 12 replies × 16 paragraphs:', JSON.stringify(work));
    assert.deepEqual(work, {blocks:0, inline:0});
    assert.equal(await js(`getComputedStyle(document.querySelector('.workspace-chat')).transitionDuration`), "0.28s");
    assert.equal(await js(`document.querySelector('.workspace-right-pane').inert`), true);
    await js(`window.__remoteFixture.updateConversation('preview-chat', {messages:[{id:'one',role:'user',content:'Audit the remote workspace.'}]})`);
    await waitFor('document.body.innerText.includes("Audit the remote workspace.")');
  });
  await check("reopening an expanded panel cancels its pending collapse", async () => {
    const toggle = () => js(`document.querySelector('button[aria-label="Toggle right sidebar"]').click()`);
    await toggle();
    await delay(200);
    await js(`document.querySelector('button[aria-label="Expand full"]').click()`);
    await delay(100);
    const expandedWidth = await js(`document.querySelector('.workspace-right-pane').getBoundingClientRect().width`);
    await toggle();
    await delay(40);
    await toggle();
    await delay(400);
    assert.equal(await js(`document.querySelector('.workspace-right-pane').getBoundingClientRect().width`), expandedWidth);
    assert.equal(await js(`document.querySelector('.workspace-right-pane').inert`), false);
    assert.equal(await js(`Boolean(document.querySelector('button[aria-label="Restore size"]'))`), true);
    await toggle();
    await delay(400);
  });
  await check("reduced motion disables panel and chat animation", async () => {
    await motionPreference("reduce");
    await js(`document.querySelector('button[aria-label="Toggle right sidebar"]').click()`);
    await delay(80);
    assert.deepEqual(await js(`['.workspace-chat','.workspace-right-pane'].map(selector => getComputedStyle(document.querySelector(selector)).transitionDuration)`), ["0s", "0s"]);
    await js(`document.querySelector('button[aria-label="Toggle right sidebar"]').click()`);
    await delay(350);
    await motionPreference("no-preference");
  });

  await check("native context menu input is not cancelled on chat or toolbar", async () => {
    assert.deepEqual(await js(`(() => {
      const targets = [document.querySelector('.workspace-chat'), document.querySelector('.workspace-toolbar')];
      return targets.map(target => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
        target.dispatchEvent(event);
        return { prevented: event.defaultPrevented, region: getComputedStyle(target).getPropertyValue('-webkit-app-region') };
      });
    })()`), [{ prevented: false, region: "no-drag" }, { prevented: false, region: "no-drag" }]);
  });
  await check("quota-full UI caches do not crash the workspace", async () => {
    assert.equal(await js(`(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
      try {
        localStorage.setItem('generated-cache', 'large completed result');
        localStorage.setItem('const_harness_active_conversation_id', 'preview-chat');
        return localStorage.getItem('generated-cache') === 'large completed result';
      } finally { Storage.prototype.setItem = original; }
    })()`), true);
    assert.equal(await js('Boolean(document.querySelector(".workspace-shell"))'), true);
  });
  await check("sending a prompt renders the completed streamed reply", async () => {
    await js(`(() => {
      const editor = document.querySelector('[contenteditable=true]');
      editor.textContent = 'Generate a response for the remote audit';
      editor.dispatchEvent(new InputEvent('input', {bubbles:true,inputType:'insertText'}));
    })()`);
    await delay(100);
    await js(`document.querySelector('button[aria-label="Send message"]').click()`);
    await waitFor('document.body.innerText.includes("The shared desktop chat is working in the remote browser.")');
    assert.equal(await js('Boolean(document.querySelector(".workspace-shell"))'), true);
  });
  await check("completed OpenUI output and invalid generated components preserve the chat", async () => {
    const prefix = "Answer before UI";
    const valid = `${prefix}\n\n\`\`\`openui-lang\nroot = Stack([TextContent("Generated result")])\n\`\`\``;
    const update = (content: string) => js(`window.__remoteFixture.updateConversation('preview-chat', {messages: [{id:'user',role:'user',content:'Audit the remote workspace.'},{id:'answer',role:'assistant',content:${JSON.stringify(content)}}]})`);
    await update(valid);
    await waitFor('document.body.innerText.includes("Generated result")');
    await capture("remote-workspace-desktop");
    await update(`${prefix}\n\n\`\`\`openui-lang\nroot = UnknownComponent("invalid")\n\`\`\``);
    await waitFor('document.body.innerText.includes("Answer before UI")');
    assert.equal(await js('Boolean(document.querySelector(".workspace-shell"))'), true);
  });
  await check("mobile refresh affordance appears and cancels without reloading", async () => {
    win.setSize(390, 844);
    await waitFor('Boolean(document.querySelector(".remote-mobile"))');
    await js(`document.querySelector('.remote-sidebar-backdrop')?.click()`);
    await js(`(() => {
      const target = document.querySelector('.workspace-toolbar');
      const touch = y => new Touch({identifier:1,target,clientX:30,clientY:y});
      target.dispatchEvent(new TouchEvent('touchstart', {touches:[touch(10)],bubbles:true,cancelable:true}));
      target.dispatchEvent(new TouchEvent('touchmove', {touches:[touch(160)],bubbles:true,cancelable:true}));
    })()`);
    await waitFor('document.body.innerText.includes("Release to refresh")');
    await capture("remote-workspace-mobile-refresh");
    await js(`document.querySelector('.workspace-toolbar').dispatchEvent(new TouchEvent('touchcancel', {touches:[],bubbles:true}))`);
    await waitFor('!document.body.innerText.includes("Release to refresh")');
  });
  await check("pull-to-refresh respects scroll position, editing, cancellation and threshold", async () => {
    const result = await js(`(async () => {
      const { installRemotePullToRefresh } = window.__remoteFixture;
      const root = document.createElement('div');
      const pane = document.createElement('div');
      pane.style.cssText = 'height:20px;overflow:scroll';
      pane.innerHTML = '<div style="height:200px">scroll content</div>';
      const editor = document.createElement('textarea');
      root.append(pane, editor); document.body.append(root);
      let refreshed = 0, progress = 0;
      const cleanup = installRemotePullToRefresh(root, value => progress = value, () => refreshed++);
      const touch = (target, type, y, x = 0) => {
        const touches = type === 'touchend' || type === 'touchcancel' ? [] : [new Touch({identifier:1,target,clientX:x,clientY:y})];
        target.dispatchEvent(new TouchEvent(type, {touches,bubbles:true,cancelable:true}));
      };
      const pull = (target, y, finish = 'touchend', x = 0) => { touch(target,'touchstart',0); touch(target,'touchmove',y,x); touch(target,finish,y,x); };
      try {
        pane.scrollTop = 50; pull(pane,150);
        pull(editor,150); pull(root,30); pull(root,150,'touchcancel'); pull(root,150,'touchend',200);
        touch(root,'touchstart',0); touch(root,'touchmove',150); touch(root,'touchmove',5); touch(root,'touchend',5);
        const blocked = refreshed === 0;
        pane.scrollTop = 0;
        touch(pane,'touchstart',0); touch(pane,'touchmove',150);
        const armed = progress === 1;
        touch(pane,'touchend',150);
        cleanup(); pull(root,150);
        return {blocked,armed,refreshed,progress};
      } finally { cleanup(); root.remove(); }
    })()`);
    assert.deepEqual(result, { blocked: true, armed: true, refreshed: 1, progress: 0 });
  });
  await check("an uncaught renderer crash shows recovery without deleting pairing credentials", async () => {
    await js(`sessionStorage.setItem('const_remote_key:fixture', 'preserved'); window.dispatchEvent(new Event('fixture:crash'))`);
    await waitFor('document.body.innerText.includes("The remote workspace could not be displayed")');
    assert.equal(await js(`sessionStorage.getItem('const_remote_key:fixture')`), "preserved");
    assert.equal(await js(`Boolean(document.querySelector('[role=alert] button'))`), true);
    await capture("remote-workspace-recovery");
  });
  win.destroy();
}
run().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
