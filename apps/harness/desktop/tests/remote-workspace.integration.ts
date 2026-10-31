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
    const durations = await js(`['.workspace-chat', '.workspace-right-pane'].map(selector => getComputedStyle(document.querySelector(selector)).transitionDuration.split(',')[0])`);
    assert.equal(durations[0], durations[1]);
    assert.ok(parseFloat(durations[0]) > 0);
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
  await check("mobile hamburger stays visible and opens and closes the sidebar with the sidepanel closed", async () => {
    win.setSize(390, 844);
    await waitFor('Boolean(document.querySelector(".remote-mobile"))');
    await js(`document.querySelector('.remote-sidebar-backdrop')?.click()`);
    await delay(350);
    const target = await js(`(() => {
      const button = document.querySelector('[data-sidebar-toggle]');
      const rect = button.getBoundingClientRect();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      return { x, y, width: rect.width, height: rect.height, reachable: button.contains(document.elementFromPoint(x, y)) };
    })()`);
    assert.ok(target.width >= 44 && target.height >= 44);
    assert.equal(target.reachable, true);
    await capture("remote-workspace-mobile-menu");
    await win.webContents.debugger.sendCommand("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: target.x, y: target.y }] });
    await win.webContents.debugger.sendCommand("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitFor(`Boolean(document.querySelector('.remote-sidebar-backdrop'))`);
    await capture("remote-workspace-mobile-sidebar");
    assert.equal(await js(`document.querySelector('[data-sidebar-toggle]').getAttribute('aria-expanded')`), "true");
    await delay(300);
    assert.equal(await js(`(() => {
      const button = document.querySelector('[data-sidebar-toggle]');
      const top = new DOMMatrix(getComputedStyle(button.querySelector('.remote-menu-line-top')).transform);
      const bottom = new DOMMatrix(getComputedStyle(button.querySelector('.remote-menu-line-bottom')).transform);
      return top.b > 0.6 && bottom.b < -0.6 && button.contains(document.elementFromPoint(${target.x}, ${target.y}));
    })()`), true);
    await win.webContents.debugger.sendCommand("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: target.x, y: target.y }] });
    await win.webContents.debugger.sendCommand("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitFor(`!document.querySelector('.remote-sidebar-backdrop')`);
    await delay(350);
    assert.equal(await js(`document.querySelector('[data-sidebar-toggle]').getAttribute('aria-expanded')`), "false");
    assert.equal(await js(`document.querySelectorAll('[data-sidebar-toggle] path').length`), 2);
  });
  await check("mobile heading hides browser icon and hides hamburger menu when sidepanel is open", async () => {
    assert.equal(await js(`Boolean(document.querySelector('button[aria-label="Browser"]'))`), false);
    await js(`document.querySelector('button[aria-label="Toggle right sidebar"]').click()`);
    await waitFor('Boolean(document.querySelector(".workspace-right-pane"))');
    await delay(350);
    assert.equal(await js(`Boolean(document.querySelector('[data-sidebar-toggle]'))`), false);
    assert.equal(await js(`Boolean(document.querySelector('.workspace-right-pane button[aria-label="Hide panel"]'))`), true);
    await js(`document.querySelector('.workspace-right-pane button[aria-label="Hide panel"]').click()`);
    await delay(350);
    assert.equal(await js(`Boolean(document.querySelector('[data-sidebar-toggle]'))`), true);
  });
  await check("mobile refresh affordance appears and cancels without reloading", async () => {
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
  await check("a fresh mobile landing page has a persistent two-line menu that animates to X", async () => {
    win.setSize(360, 740);
    await win.loadURL(process.argv[3]! + "?landing");
    await waitFor(`Boolean(document.querySelector('.remote-mobile .workspace-landing'))`);
    await delay(250);
    assert.equal(await js(`(() => {
      const button = document.querySelector('[data-sidebar-toggle]');
      const bounds = button.getBoundingClientRect();
      return bounds.width >= 44 && bounds.height >= 44 && button.contains(document.elementFromPoint(bounds.x + 22, bounds.y + 22));
    })()`), true);
    await capture("remote-landing-mobile-menu");
    const motion = await js(`new Promise(resolve => {
      const button = document.querySelector('[data-sidebar-toggle]');
      const line = button.querySelector('.remote-menu-line-top');
      const samples = [];
      const start = performance.now();
      const sample = now => {
        samples.push(new DOMMatrix(getComputedStyle(line).transform).b);
        if (now - start < 320) requestAnimationFrame(sample);
        else resolve({ samples, persistent:button === document.querySelector('[data-sidebar-toggle]'), expanded:button.getAttribute('aria-expanded') });
      };
      requestAnimationFrame(sample);
      button.click();
    })`);
    assert.equal(motion.persistent, true);
    assert.equal(motion.expanded, "true");
    assert.ok(motion.samples.some((value: number) => value > 0.01 && value < 0.70), "Expected an intermediate menu-to-X frame");
    await capture("remote-landing-mobile-sidebar");
    await js(`document.querySelector('[data-sidebar-toggle]').click()`);
    await waitFor(`!document.querySelector('.remote-sidebar-backdrop')`);
    await delay(250);
    await motionPreference("reduce");
    await js(`document.querySelector('[data-sidebar-toggle]').click()`);
    await delay(80);
    assert.equal(await js(`getComputedStyle(document.querySelector('.remote-menu-line-top')).transitionDuration`), "0s");
    assert.equal(await js(`document.querySelector('[data-sidebar-toggle]').getAttribute('aria-expanded')`), "true");
    await delay(300);
    await js(`document.querySelector('.remote-sidebar-backdrop').click()`);
    await motionPreference("no-preference");
  });
  await check("an uncaught renderer crash shows recovery without deleting pairing credentials", async () => {
    await js(`sessionStorage.setItem('const_remote_key:fixture', 'preserved'); window.dispatchEvent(new Event('fixture:crash'))`);
    await waitFor('document.body.innerText.includes("The remote workspace could not be displayed")');
    assert.equal(await js(`sessionStorage.getItem('const_remote_key:fixture')`), "preserved");
    assert.equal(await js(`Boolean(document.querySelector('[role=alert] button'))`), true);
    await capture("remote-workspace-recovery");
  });

  win.setSize(1280, 900);
  await win.loadURL(process.argv[3]! + "?host-control");
  await waitFor(`document.body.innerText.includes('Remote control stopped')`);
  await check("host pairing controls start, copy, rotate and stop without redundant actions", async () => {
    assert.equal(await js(`Boolean(document.querySelector('img'))`), false);
    assert.equal(await js(`Boolean(document.querySelector('[data-pairing-placeholder]'))`), true);
    assert.equal(await js(`Boolean(document.querySelector('[data-pairing-placeholder] .lucide-qr-code'))`), true);
    assert.equal(await js(`document.activeElement === document.querySelector('[role=dialog]')`), true);
    assert.equal(await js(`Array.from(document.querySelectorAll('h2')).some(heading => heading.textContent === 'Connected devices')`), false);
    assert.equal(await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Copy link')).disabled`), true);
    assert.equal(await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New pairing')).disabled`), true);
    await capture("remote-control-stopped");
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await delay(80);
    assert.equal(await js(`document.activeElement === document.querySelector('[data-remote-control-close]')`), true);
    assert.equal(await js(`(() => {
      const style = getComputedStyle(document.querySelector('[data-remote-control-close]'));
      const noVisibleOutline = style.outlineStyle === 'none' || style.outlineWidth === '0px' || style.outlineColor === 'rgba(0, 0, 0, 0)';
      return noVisibleOutline && ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].every(key => style[key] === '0px');
    })()`), true);
    await capture("remote-control-close-keyboard-focus");
    await js(`document.querySelector('[role=dialog]').focus()`);
    await js(`window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText:async value => window.__copied.push(value) } });
      Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Start').click()`);
    await waitFor(`Boolean(document.querySelector('img[alt="Remote pairing QR code"]'))`);
    assert.equal(await js(`document.querySelectorAll('button').length`), 6);
    await js(`document.querySelector('button[aria-label="Copy pairing code"]').click()`);
    await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Copy link')).click()`);
    assert.deepEqual(await js(`window.__copied`), ["ABC-234", `https://harness.const.web.id/r/fixture-1#key=${"x".repeat(43)}`]);
    await capture("remote-control-pairing-dark");
    await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New pairing')).click()`);
    await waitFor(`document.body.innerText.includes('XYZ-789')`);
    await js(`window.__remoteFixture.updateRemoteStatus({status:'connected', connectedDevices:Array.from({length:4}, (_,i) => ({id:'device-'+i,name:['Android Phone','iPad','Windows PC','MacBook'][i],connectedAt:Date.now()-120000}))})`);
    await waitFor(`document.body.innerText.includes('4 of 4 paired')`);
    assert.equal(await js(`document.body.innerText.includes('MacBook')`), true);
    await capture("remote-control-connected-dark");
    await js(`document.documentElement.classList.remove('dark')`);
    await capture("remote-control-connected-light");
    win.setSize(390, 844);
    await delay(200);
    assert.equal(await js(`(() => { const d = document.querySelector('[role=dialog]'); return d.scrollWidth <= d.clientWidth; })()`), true);
    await capture("remote-control-connected-mobile");
    await js(`(() => { const viewport = document.querySelector('[role=dialog] [data-radix-scroll-area-viewport]'); viewport.scrollTop = viewport.scrollHeight; })()`);
    assert.equal(await js(`(() => {
      const device = Array.from(document.querySelectorAll('[role=dialog] p')).find(p => p.textContent === 'MacBook');
      const viewport = device.closest('[data-radix-scroll-area-viewport]').getBoundingClientRect();
      const bounds = device.getBoundingClientRect();
      return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    })()`), true);
    await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Stop').click()`);
    await waitFor(`document.body.innerText.includes('Remote control stopped')`);
    assert.equal(await js(`Boolean(document.querySelector('img'))`), false);
    assert.equal(await js(`Boolean(document.querySelector('[data-pairing-placeholder]'))`), true);
  });
  await check("expired and legacy invitations cannot advertise a usable pairing code", async () => {
    win.setSize(1280, 900);
    await js(`document.documentElement.classList.add('dark'); window.__remoteFixture.updateRemoteStatus({status:'waiting', pairingUrl:'https://harness.const.web.id/r/expired#key=${"x".repeat(43)}',pairingCode:'ABC-234',expiresAt:Date.now()-1000})`);
    await waitFor(`document.body.innerText.includes('Pairing expired')`);
    assert.equal(await js(`Boolean(document.querySelector('button[aria-label="Copy pairing code"]'))`), false);
    assert.equal(await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Copy link')).disabled`), true);
    await capture("remote-control-expired");
    await js(`window.__remoteFixture.updateRemoteStatus({pairingCode:null,expiresAt:Date.now()+60000})`);
    await waitFor(`document.body.innerText.includes('Pairing codes require an updated remote service')`);
    assert.equal(await js(`Boolean(document.querySelector('button[aria-label="Copy pairing code"]'))`), false);
    await capture("remote-control-legacy");
  });
  await check("host action errors remain recoverable", async () => {
    await js(`window.__remoteFixture.setRemoteActionError('Network error'); Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New pairing')).click()`);
    await waitFor(`Boolean(document.querySelector('[role=alert]'))`);
    assert.equal(await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New pairing')).disabled`), false);
    await capture("remote-control-error");
    await js(`window.__remoteFixture.setRemoteActionError(null); Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New pairing')).click()`);
    await waitFor(`!document.querySelector('[role=alert]') && Boolean(document.querySelector('button[aria-label="Copy pairing code"]'))`);
  });
  await check("pairing stays within a narrow viewport in every supported language", async () => {
    win.setSize(320, 740);
    for (const language of ['en', 'id', 'ja', 'zh', 'es']) {
      await js(`window.dispatchEvent(new CustomEvent('const-language-changed', {detail:${JSON.stringify(language)}}))`);
      await delay(150);
      assert.equal(await js(`(() => {
        const dialog = document.querySelector('[role=dialog]');
        const viewport = dialog.querySelector('[data-radix-scroll-area-viewport]');
        return dialog.scrollWidth <= dialog.clientWidth && viewport.scrollWidth <= viewport.clientWidth && !dialog.innerText.includes('remoteControl.');
      })()`), true, language);
      if (language === 'id') await capture("remote-control-pairing-indonesian-mobile");
    }
  });
  win.destroy();
}
run().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
