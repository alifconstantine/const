// Isolated local fixtures only. No live credentials or billable APIs.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
app.setPath("userData", process.argv[2]);
async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 390, height: 900, webPreferences: { sandbox: true, contextIsolation: true, offscreen: true } });
  const js = async code => {
    try { return await win.webContents.executeJavaScript(code); }
    catch (error) { throw Error(code + "\n" + error.message); }
  };
  const wait = async code => {
    for (let i = 0; i < 100; i++) {
      if (await js(code)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error("Timed out: " + code);
  };
  for (const width of [320, 390, 768, 1440]) {
    win.setSize(width, 900);
    for (const route of ["dashboard", "credits", "models", "benchmark", "endpoints", "settings", "generation", "keys", "logs", "combos"]) {
      await win.loadURL("http://127.0.0.1:5192/" + route);
      await wait(`Boolean(document.querySelector('main h1'))`);
      assert.equal(await js(`document.querySelector('main').innerText.includes('could not be loaded')`), false, route + " query fixture");
      assert.equal(await js(`document.documentElement.scrollWidth <= innerWidth && (()=>{const page = document.querySelector('.router-page-content') || document.querySelector('main');return page.scrollWidth <= page.clientWidth + 1})()`), true, route + " overflow at " + width);
      if (route === "benchmark") {
        assert.equal(await js(`document.querySelector('main h1').textContent`), "Benchmark");
        assert.equal(await js(`document.querySelector('.router-navbar') === null && document.querySelector('.router-shell header').textContent.includes('Benchmark')`), true);
        assert.equal(await js(`document.querySelectorAll('main thead th').length`), 4);
        assert.deepEqual(await js(`Array.from(document.querySelector('main tbody tr').cells, cell => cell.textContent.trim())`), ["Claude Opus 5.5", "Anthropic", "50.5", "View"]);
        assert.equal(await js(`document.querySelector('main tbody a').href`), "https://artificialanalysis.ai/models/claude-opus-5-5");
        if (width >= 768) {
          assert.equal(await js(`document.querySelector('aside a[aria-current=page]').getAttribute('href')`), "/benchmark");
        }
      }
      if (width < 768) {
        assert.equal(await js(`Array.from(document.querySelectorAll('main input:not([type=checkbox]):not([type=radio]):not([type=range]), main textarea, main select')).filter(el => el.clientWidth).every(el => parseFloat(getComputedStyle(el).fontSize) >= 16)`), true, route + " input readability");
        assert.equal(await js(`['[aria-label="Open navigation"]','[aria-label="Create API key"]'].every(selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return rect.width>=44&&rect.height>=44})`), true, route + " header touch targets");
      }
    }
  }
  win.setSize(320, 900);
  await win.loadURL("http://127.0.0.1:5192/dashboard");
  await wait(`Boolean(document.querySelector('[aria-label="Open navigation"]'))`);
  await js(`document.querySelector('[aria-label="Open navigation"]').click()`);
  await wait(`Boolean(document.querySelector('[role=dialog] nav'))`);
  assert.equal(await js(`Array.from(document.querySelectorAll('[role=dialog] nav a')).every(el=>{const rect=el.getBoundingClientRect();return rect.height>=44&&rect.right<=innerWidth})`), true);
  await js(`document.querySelector('[role=dialog] a[href="/credits"]').click()`);
  await wait(`location.pathname === '/credits' && !document.querySelector('[role=dialog]')`);
  assert.equal(await js(`Array.from(document.querySelectorAll('header span')).some(el => el.offsetWidth && el.textContent === 'Credits')`), true);
  if (process.env.ROUTER_PAYMENT_SCREENSHOTS) {
    await fs.mkdir(process.env.ROUTER_PAYMENT_SCREENSHOTS, { recursive: true });
    await fs.writeFile(path.join(process.env.ROUTER_PAYMENT_SCREENSHOTS, "router-mobile-navigation.png"), (await win.webContents.capturePage()).toPNG());
  }
  console.log("PASS: ten dashboard routes at 320/390/768/1440px, readable inputs, touch targets, and mobile navigation");
  win.destroy();
}
main().then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1)});
