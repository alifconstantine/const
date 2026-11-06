import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { monitorMainRenderer } from "../electron/renderer-health";

const directory = process.argv[2]!;
app.setPath("userData", path.join(directory, "profile"));
app.on("window-all-closed", () => {});
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 960, height: 720, webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true } });
  const js = (code: string) => win.webContents.executeJavaScript(code);
  const waitFor = async (code: string) => { for (let i = 0; i < 100; i++) { if (await js(code)) return; await delay(50); } throw new Error(`Timed out: ${code}`); };
  const errors: string[] = [];
  win.webContents.on("console-message", event => { if (event.message.includes("Maximum update depth")) errors.push(event.message); });
  await win.loadFile(path.join(directory, "index.html"));
  await waitFor("document.body.textContent.includes('LATEST_REASONING')");
  assert.equal(await js("document.body.textContent.includes('FULL_REASONING_START')"), false);
  assert.equal(await js("document.body.textContent.includes('HIDDEN_OUTPUT_179')"), false);
  assert.ok(await js("document.querySelectorAll('*').length < 2500"));
  console.log("PASS: long live reasoning and collapsed history keep a bounded DOM");
  await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Show earlier activity')).click()");
  await waitFor("document.body.textContent.includes('echo TOOL_61')");
  await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Show full reasoning')).click()");
  await waitFor("document.body.textContent.includes('FULL_REASONING_START')");
  console.log("PASS: earlier steps and complete reasoning remain accessible on demand");
  // Close the opt-in full view before streaming: ordinary updates must never reopen it.
  await js("Array.from(document.querySelectorAll('button')).findLast(b=>b.textContent.includes('Thinking')).click()");
  await delay(300);
  await js("window.rendererFixture.timer=setInterval(()=>window.rendererFixture.tick(),34)");
  await delay(15_000);
  assert.ok(await js("performance.getEntriesByType('measure').filter(e=>e.name.startsWith('\\u200b')).length < 100"));
  assert.equal(await js("document.body.textContent.includes('FULL_REASONING_START')"), false);
  assert.equal(errors.length, 0);
  win.webContents.debugger.attach("1.3");
  await win.webContents.debugger.sendCommand("HeapProfiler.collectGarbage");
  const dom = await win.webContents.debugger.sendCommand("Memory.getDOMCounters");
  assert.ok(dom.nodes < 4000, `Collapsed reasoning retained ${dom.nodes} DOM nodes after collection`);
  await js("clearInterval(window.rendererFixture.timer);window.rendererFixture.finish()");
  await delay(350);
  assert.equal(await js("document.querySelector('[data-working-process]')?.textContent || ''"), "");
  console.log("PASS: streaming does not retain React prop measurements or reopen collapsed reasoning; completion releases trace bodies");

  const file = path.join(directory, "renderer-health.jsonl");
  let prompts = 0;
  let navigations = 0;
  const health = monitorMainRenderer(win, { logFile: file, sampleIntervalMs: 30, unresponsiveDelayMs: 10,
    metrics: () => ({ rendererPid: win.webContents.getOSProcessId() }),
    recover: async (_reason, signal) => { prompts++; await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })); },
  });
  win.webContents.on("did-start-loading", () => navigations++);
  health.heartbeat({ heapBytes: 1234, nodes: 600, longTasks: 2, longestTaskMs: 120, secret: "DO_NOT_LOG" });
  win.emit("unresponsive"); await delay(30);
  assert.equal(prompts, 1);
  win.emit("unresponsive"); await delay(30);
  assert.equal(prompts, 1);
  win.emit("responsive"); await delay(20);
  win.webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 5 }); await delay(40);
  win.webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 5 }); await delay(40);
  assert.equal(prompts, 2);
  assert.equal(navigations, 0);
  await health.flushed();
  const log = await fs.readFile(file, "utf8");
  assert.ok(log.includes('"reason":"crashed"'));
  assert.ok(log.includes('"heapBytes":1234'));
  assert.ok(!log.includes("DO_NOT_LOG"));
  console.log("PASS: unresponsive/crash recovery is deduplicated, records safe diagnostics and never reloads a crashing transcript automatically");
  health.stop();
  let waitPrompts = 0;
  const waiting = monitorMainRenderer(win, { logFile: file, unresponsiveDelayMs: 10, metrics: () => ({}), recover: async () => { waitPrompts++; } });
  win.emit("unresponsive"); win.emit("responsive"); await delay(30);
  assert.equal(waitPrompts, 0);
  win.emit("unresponsive"); await delay(30);
  win.emit("unresponsive"); await delay(30);
  assert.equal(waitPrompts, 1);
  win.emit("responsive"); win.emit("unresponsive"); await delay(30);
  assert.equal(waitPrompts, 2);
  console.log("PASS: short stalls stay quiet and choosing Wait does not cause repeated recovery prompts");
  waiting.stop(); win.destroy(); app.exit(0);
}
run().catch(error => { console.error(error); app.exit(1); });
