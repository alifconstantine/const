import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
app.setPath("userData", process.argv[2]!);
async function run() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, frame: false, width: 1080, height: 840, webPreferences: { contextIsolation: true, sandbox: true, offscreen: true } });
  const js = (code: string) => win.webContents.executeJavaScript(code);
  const wait = async (code: string) => { for (let i = 0; i < 100; i++) { if (await js(code)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`Timed out: ${code}`); };
  const screenshot = async (name: string) => { const directory = process.env.CONST_UPDATE_UI_SCREENSHOTS; if (!directory) return; await mkdir(directory, { recursive: true }); await new Promise(resolve => setTimeout(resolve, 300)); await writeFile(path.join(directory, name + ".png"), (await win.webContents.capturePage()).toPNG()); };
  await win.loadURL(process.argv[3]!);
  await wait(`Boolean(window.__updates && document.querySelector('[data-app-update-trigger]'))`);
  await js(`window.__availableRelease = window.__updates.emit({}).release`);
  for (const mobile of [false, true]) {
    await js(`window.__updates.setMobile(${mobile})`);
    for (const patch of [
      `{ status: 'idle', release: undefined }`,
      `{ status: 'checking', release: undefined }`,
      `{ status: 'error', release: undefined, error: 'network' }`,
      `{ status: 'current', release: { ...window.__availableRelease, version: '0.0.2' } }`,
      `{ status: 'current', release: { ...window.__availableRelease, version: '0.0.1' } }`,
    ]) {
      await js(`window.__updates.emit(${patch})`);
      await wait(`!document.querySelector('[data-app-update-trigger]')`);
    }
    await js(`window.__updates.emit({ status: 'available', release: window.__availableRelease, error: undefined })`);
    await wait(`Boolean(document.querySelector('[data-app-update-trigger]'))`);
  }
  await js(`window.__updates.setMobile(false)`);
  await js(`document.querySelector('[data-app-update-trigger]').click()`);
  await wait(`Boolean(document.querySelector('[data-app-update-panel]'))`);
  assert.equal(await js(`document.querySelector('[data-update-notes]').innerText.includes('##')`), false);
  assert.equal(await js(`document.querySelector('[data-update-notes]').innerText.includes('New Features')`), true);
  assert.equal(await js(`document.querySelectorAll('[data-app-update-panel] a').length`), 0);
  assert.equal(await js(`document.querySelector('[data-app-update-panel]').innerText.includes('View release on GitHub')`), false);
  assert.equal(await js(`document.querySelector('[data-app-update-panel]').innerText.includes('Later')`), true);
  await screenshot("updates-desktop-available");
  await js(`Array.from(document.querySelectorAll('[data-app-update-panel] button')).find(button => button.textContent === 'Download update').click()`);
  await wait(`Boolean(document.querySelector('[role=progressbar]'))`);
  assert.equal(await js(`document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')`), '37');
  await screenshot("updates-desktop-downloading");
  await js(`window.__updates.emit({status:'ready',progress:100})`);
  await wait(`document.querySelector('[data-app-update-panel]').innerText.includes('Install & restart')`);
  await screenshot("updates-desktop-ready");
  await js(`window.__updates.emit({status:'error',error:'busy'})`);
  await wait(`document.querySelector('[data-app-update-panel]').innerText.includes('Finish running tasks')`);
  await js(`document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true})); window.__updates.setMobile(true); window.__updates.emit({status:'available',error:undefined});`);
  win.setSize(390, 844);
  await wait(`!document.querySelector('[data-app-update-panel]')`);
  await js(`document.querySelector('[data-app-update-trigger]').click()`);
  await wait(`Boolean(document.querySelector('[role=dialog] [data-app-update-panel]'))`);
  await screenshot("updates-mobile-available");
  for (const language of ["en", "id", "es", "ja", "zh"]) {
    await js(`window.__updates.setLanguage('${language}')`);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await js(`(() => { const panel = document.querySelector('[role=dialog]'); return panel.scrollWidth <= panel.clientWidth && panel.getBoundingClientRect().right <= innerWidth + 1 && document.querySelector('[data-update-notes]').innerText.includes('New Features'); })()`), true, language);
  }
  win.setSize(320, 640);
  await js(`window.__updates.setLanguage('id')`);
  await screenshot("updates-mobile-indonesian-320");
  assert.equal(await js(`document.querySelector('[role=dialog]').scrollWidth <= innerWidth`), true);
  await js(`window.__updates.emit({status:'ready'})`);
  await wait(`document.querySelector('[data-app-update-panel]').innerText.includes('Pasang pembaruan')`);
  await js(`Array.from(document.querySelectorAll('[data-app-update-panel] button')).find(button => button.textContent === 'Pasang pembaruan').click()`);
  assert.equal(await js(`window.__updates.installs()`), 1);
  await js(`window.__updates.emit({ status: 'current', release: { ...window.__availableRelease, version: '0.0.2' } })`);
  await wait(`!document.querySelector('[data-app-update-trigger]') && !document.querySelector('[data-app-update-panel]')`);
  console.log("PASS: update UI — hidden without newer releases on desktop/mobile, notes, download progress, ready/busy states, Android install, mobile layout, and five languages");
  win.destroy();
}
run().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
