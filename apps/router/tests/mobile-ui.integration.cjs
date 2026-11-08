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
        assert.deepEqual(await js(`Array.from(document.querySelectorAll('main thead th'), cell => (cell.querySelector(':scope > span:not([aria-hidden])') ?? cell).textContent.trim())`), ["Model", "Creator", "Intelligence Index", "View"]);
        assert.equal(await js(`document.querySelectorAll('main tbody tr').length`), 21);
        assert.deepEqual(await js(`(() => {
          const view = document.querySelector('main tbody a[href="https://artificialanalysis.ai/models/claude-opus-5-5"]');
          return Array.from(view.closest('tr').cells, cell => cell.innerText.trim());
        })()`), ["Claude Opus 5.5\nMax, Default Fallback", "Anthropic", "59", "View"]);
        assert.equal(await js(`Array.from(document.querySelectorAll('main tbody tr')).filter(row => row.cells[2].textContent === 'N/A').length`), 2);
        const scores = `Array.from(document.querySelectorAll('main tbody tr'), row => row.cells[2].textContent)`;
        const defaultScores = await js(scores);
        assert.equal(defaultScores[0], "59");
        assert.deepEqual(defaultScores.slice(-2), ["N/A", "N/A"]);
        assert.deepEqual(defaultScores, [...defaultScores.slice(0, -2)].sort((a, b) => Number(b) - Number(a)).concat("N/A", "N/A"));
        if (width === 390) {
          const setFilter = (index, value) => js(`(() => {
            const select = document.querySelectorAll('main select')[${index}];
            select.value = ${JSON.stringify(value)};
            select.dispatchEvent(new Event('change', { bubbles: true }));
          })()`);
          await setFilter(1, "lowest");
          await wait(`(${scores})[0] === "20"`);
          assert.deepEqual((await js(scores)).slice(-2), ["N/A", "N/A"]);
          await setFilter(0, "Anthropic");
          await wait(`(${scores}).length === 4`);
          assert.deepEqual(await js(scores), ["36", "49", "55", "59"]);
          await setFilter(1, "name");
          await wait(`document.querySelector('main tbody tr th').textContent.startsWith('Claude Fable 5.1')`);
          assert.deepEqual(await js(scores), ["49", "36", "59", "55"]);
        }
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
