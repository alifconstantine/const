import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { unlink } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, nativeImage, session, webContents } from "electron";
import { BrowserController, HELP_REQUEST_TTL_MS } from "../electron/browser-controller";
import { BROWSER_PARTITION, applyBrowserContentsPolicy, applyBrowserSessionPolicy } from "../electron/browser/guest-policy";
import { assertBrowserNavigation, normalizeBrowserUrl } from "../electron/browser/navigation-policy";
import { sanitizeConsoleText, sanitizeUrl } from "../electron/browser/console-sanitizer";
import { browserPartition } from "../src/lib/browser-session";

app.setPath("userData", process.argv[2]!);
app.on("window-all-closed", () => {});
const driver = new BrowserController();
app.on("web-contents-created", (_event, contents) => {
  applyBrowserContentsPolicy(contents, (url) => driver.assertNavigationAllowed(url));
});
const fixture = `<!doctype html><style>
body { margin:24px; font:16px sans-serif; background:white; color:black }
input,button { display:block; margin:12px; width:240px; height:32px }
#cover { position:fixed; inset:0; background:white; z-index:999999 }
#hidden { display:none }
#hover:hover { background:rgb(0, 128, 0) }
</style><h1>Automation fixture</h1><input id="password" type="password" aria-label="Password" value="hidden-password-341">
<input id="otp" autocomplete="one-time-code" aria-label="OTP" value="684937">
<input id="custom" aria-label="Custom code"><input id="editor" aria-label="Editor" value="old">
<button id="click" onclick="this.textContent='Clicked'">Click me</button>
<button id="hover">Hover me</button><button id="hidden" aria-label="Hidden">Invisible text</button>
<button id="disabled" disabled>Disabled</button><div id="result"></div>`;
let origin = "";
let blockedDestinationHits = 0;
const server = createServer((req, res) => {
  if (req.url === "/browser-tab-host") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><body></body>");
    return;
  }
  if (req.url === "/redirect") {
    res.writeHead(302, { Location: origin.replace("127.0.0.1", "localhost") + "/blocked-destination" });
    res.end();
    return;
  }
  if (req.url === "/blocked-destination") blockedDestinationHits++;
  res.writeHead(200, { "content-type": "text/html" });
  res.end(fixture);
});
let passed = 0;
async function check(name: string, run: () => Promise<void> | void) {
  await run();
  console.log(`PASS ${++passed}: ${name}`);
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await app.whenReady();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browserSession = session.fromPartition(BROWSER_PARTITION);
  applyBrowserSessionPolicy(browserSession, (url) => driver.assertNavigationAllowed(url));
  const host = new BrowserWindow({ show: false, width: 1100, height: 1000, webPreferences: { webviewTag: true, contextIsolation: true, sandbox: true } });
  await host.loadURL(origin + "/browser-tab-host");
  const addGuest = async (id: string) => {
    const attached = once(host.webContents, "did-attach-webview");
    await host.webContents.executeJavaScript(`(() => {
      const view = document.createElement('webview'); view.id = ${JSON.stringify(id)};
      view.setAttribute('partition', ${JSON.stringify(BROWSER_PARTITION)});
      view.style.cssText = 'width:1000px;height:900px';
      view.src = ${JSON.stringify(origin)};
      document.body.appendChild(view);
    })()`);
    const [, guest] = await attached;
    if (guest.isLoading()) await once(guest, "did-finish-load");
    driver.registerWebview(id, guest.id);
    return guest as Electron.WebContents;
  };
  const guest = await addGuest("primary");
  const js = (code: string) => guest.executeJavaScript(code);

  await check("scheme and domain validation", () => {
    assert.equal(normalizeBrowserUrl("localhost:3000/path"), "http://localhost:3000/path");
    for (const url of ["file:///etc/passwd", "data:text/html,secret", "javascript:alert(1)", "blob:https://example.com/id"]) {
      assert.throws(() => normalizeBrowserUrl(url));
    }
    assertBrowserNavigation("https://app.example.com", ["*.example.com"]);
    assert.throws(() => assertBrowserNavigation("https://example.com.attacker.test", ["*.example.com"]));
  });
  await check("guest runs sandboxed without Node integration", () => {
    const prefs = guest.getLastWebPreferences()!;
    assert.equal(prefs.sandbox, true);
    assert.equal(prefs.nodeIntegration, false);
    assert.equal(prefs.contextIsolation, true);
  });
  await check("snapshot masks ARIA values, element values and readable text without changing inputs", async () => {
    await js(`document.querySelector('#result').textContent = document.querySelector('#otp').value`);
    const snap = await driver.snapshot();
    const payload = JSON.stringify(snap);
    assert.ok(!payload.includes("hidden-password-341"));
    assert.ok(!payload.includes("684937"));
    assert.ok(snap.ariaSnapshot?.includes("Password"));
    assert.equal(await js(`document.querySelector('#otp').value`), "684937");
    assert.equal(await js(`Object.hasOwn(document.querySelector('#otp'), 'value')`), false);
  });
  await check("hidden semantic elements remain attached", async () => {
    await driver.waitFor({ selector: "role/button[name=Hidden]", state: "attached", timeoutMs: 100 });
    await assert.rejects(driver.waitFor({ selector: "role/button[name=Hidden]", state: "detached", timeoutMs: 100 }));
  });
  await check("waits for a delayed element", async () => {
    await js(`setTimeout(() => { const b=document.createElement('button'); b.id='later'; b.textContent='Ready'; document.body.append(b) }, 150)`);
    await driver.waitFor({ selector: "#later", timeoutMs: 2000 });
  });
  await check("invalid and non-finite wait parameters fail promptly", async () => {
    await assert.rejects(driver.waitFor({}));
    await assert.rejects(driver.waitFor({ selector: "#never", timeoutMs: NaN }));
    await assert.rejects(driver.waitFor({ timeMs: Infinity }));
  });
  await check("click waits for an overlay to clear", async () => {
    await js(`const cover = document.createElement('div'); cover.id='cover'; document.body.append(cover); setTimeout(() => cover.remove(), 200)`);
    await driver.click({ selector: "#click" });
    assert.equal(await js(`document.querySelector('#click').textContent`), "Clicked");
  });
  await check("text selector clicks the leaf control", async () => {
    await driver.click({ selector: "text/Ready" });
    assert.equal(await js(`document.activeElement.id`), "later");
  });
  await check("native typing and paste update editable input", async () => {
    await driver.type({ selector: "#editor", text: "first" });
    assert.equal(await js(`document.querySelector('#editor').value`), "first");
    await driver.paste({ selector: "#editor", text: "多言語\nsecond" });
    // Text inputs normalize newlines; textarea/contenteditable preserve them.
    assert.equal(await js(`document.querySelector('#editor').value`), "多言語second");
  });
  await check("typing without a selector clears the focused input", async () => {
    await js(`document.querySelector('#editor').focus()`);
    await driver.type({ text: "replacement" });
    assert.equal(await js(`document.querySelector('#editor').value`), "replacement");
  });
  await check("paste rejects a non-editable focused target", async () => {
    await js(`document.querySelector('#click').focus()`);
    await assert.rejects(driver.paste({ text: "must-not-type" }));
  });
  await check("hover dispatch reaches the target", async () => {
    await driver.hover({ selector: "#hover" });
    assert.equal(await js(`getComputedStyle(document.querySelector('#hover')).backgroundColor`), "rgb(0, 128, 0)");
  });
  await check("text assertions cannot pass on a missing scope or hidden text", async () => {
    const hidden = await driver.verifyText({ text: "Invisible text" });
    assert.equal(hidden.matched, false);
    await assert.rejects(driver.verifyText({ selector: "#missing", text: "anything", state: "absent" }));
    const result = await driver.executeTool("browser_verify_text", { text: "nonexistent" });
    assert.equal(result.isError, true);
    const original = guest.executeJavaScript;
    guest.executeJavaScript = async () => { throw new Error("renderer unavailable"); };
    try {
      await assert.rejects(driver.verifyText({ text: "anything", state: "absent" }), /renderer unavailable/);
    } finally {
      guest.executeJavaScript = original;
    }
  });
  await check("find includes its scope root and excludes hidden nodes", async () => {
    assert.equal((await driver.find({ selector: "#click", text: "Clicked" })).totalMatches, 1);
    assert.equal((await driver.find({ text: "Invisible text" })).totalMatches, 0);
  });
  await check("manual control blocks automation and in-flight waits", async () => {
    const pending = driver.waitFor({ selector: "#never", timeoutMs: 2000 });
    const rejection = assert.rejects(pending, /human|assistance/);
    setTimeout(() => driver.takeControl(), 100);
    await rejection;
    await assert.rejects(driver.click({ selector: "#click" }));
    driver.releaseControl();
  });
  await check("explicit missing tab never falls back to another tab", async () => {
    await assert.rejects(driver.click({ tabId: "closed-tab", selector: "#click" }));
  });
  await check("secret supply requires a pending request", async () => {
    await assert.rejects(driver.supplySecret("should-not-write"));
  });
  await check("secret handoff stays on the requested tab and remains masked afterwards", async () => {
    driver.requestSecret("verification code", "#custom");
    const other = await addGuest("secondary");
    await driver.supplySecret("custom-secret-729");
    assert.equal(await js(`document.querySelector('#custom').value`), "custom-secret-729");
    assert.equal(await other.executeJavaScript(`document.querySelector('#custom').value`), "");
    const snap = await driver.snapshot({ tabId: "primary" });
    assert.ok(!JSON.stringify(snap).includes("custom-secret-729"));
  });
  await check("missing explicit secret target never falls back to password", async () => {
    driver.requestSecret("code", "#missing");
    await assert.rejects(driver.supplySecret("wrong-target"));
    assert.equal(await js(`document.querySelector('#password').value`), "hidden-password-341");
    driver.releaseControl();
  });
  await check("stale snapshot refs fail closed", async () => {
    const snap = await driver.snapshot();
    const ref = snap.elements.find((el) => el.name === "Custom code")!.ref;
    driver.requestSecret("code", ref);
    await driver.snapshot();
    await assert.rejects(driver.supplySecret("must-not-write"), /refs changed/);
    driver.releaseControl();
  });
  await check("secret target origin is checked after navigation", async () => {
    driver.requestSecret("password", "#password");
    await guest.loadURL(origin.replace("127.0.0.1", "localhost"));
    await assert.rejects(driver.supplySecret("must-not-leak"), /origin changed/);
    driver.releaseControl();
    await guest.loadURL(origin);
  });
  await check("expired help keeps manual control", () => {
    driver.requestHelp("verification");
    (driver as any).controlState.requestedAt = new Date(Date.now() - HELP_REQUEST_TTL_MS - 1).toISOString();
    assert.equal(driver.getControl().holder, "human");
    assert.throws(() => driver.assertBotMayAct());
    driver.releaseControl();
  });
  await check("telemetry redacts credentials from actual console events", async () => {
    await js(`console.error('Authorization: Bearer confidential-123'); console.log('password="secret-456"')`);
    await delay(100);
    const telemetry = JSON.stringify(await driver.readConsoleAndNetwork({ includeNetwork: true }));
    assert.ok(!telemetry.includes("confidential-123"));
    assert.ok(!telemetry.includes("secret-456"));
    assert.ok(sanitizeConsoleText('api_key="abc"').includes("[REDACTED]"));
    assert.ok(!sanitizeUrl("https://user:pass@example.com/?token=sensitive").includes("sensitive"));
  });
  await check("screenshots capture and clean up secret masks", async () => {
    const shot = await driver.screenshot({ annotate: false, format: "png" });
    assert.ok(shot.width > 0 && shot.height > 0 && shot.base64.length > 100);
    const rect = await js(`(() => { const r=document.querySelector('#otp').getBoundingClientRect(); return {x:r.x,y:r.y} })()`);
    const image = nativeImage.createFromBuffer(Buffer.from(shot.base64, 'base64'));
    const pixel = image.crop({ x: Math.round(rect.x + 2), y: Math.round(rect.y + 2), width: 1, height: 1 }).toBitmap();
    assert.deepEqual([...pixel.subarray(0, 3)], [34, 34, 34], "OTP field must be covered in captured pixels");
    assert.equal(await js(`document.querySelector('[id^="const-mask-"]')`), null);
    await unlink(shot.filePath);
  });
  await check("concurrent AI and remote screenshots cannot leak annotations into the remote frame", async () => {
    const [annotated, remote] = await Promise.all([
      driver.screenshot({ annotate: true, ephemeral: true, format: "png" }),
      driver.screenshot({ annotate: false, ephemeral: true, format: "png" }),
    ]);
    assert.notEqual(annotated.base64, remote.base64, "the plain remote frame must differ from the annotated AI capture");
    assert.equal(await js(`document.querySelector('[data-const-screenshot-annotations]')`), null);
    assert.equal(await js(`document.querySelector('[id^="const-mask-"]')`), null);
  });
  await check("guest popups cannot create unmanaged windows", async () => {
    const before = webContents.getAllWebContents().length;
    await js(`window.open(${JSON.stringify(origin)})`);
    await delay(100);
    assert.equal(webContents.getAllWebContents().length, before);
  });
  await check("permission requests default to denied", async () => {
    assert.equal(await js(`Notification.requestPermission()`), "denied");
  });
  await check("server redirects cannot bypass the host allowlist", async () => {
    driver.setAllowedDomains(["127.0.0.1"]);
    await assert.rejects(guest.loadURL(origin + "/redirect"));
    assert.equal(blockedDestinationHits, 0);
    driver.setAllowedDomains([]);
  });
  await check("remote human input targets the guest, pauses AI, and rejects invalid coordinates", async () => {
    await driver.remoteInput({ tabId: "primary", action: "evaluate", script: "document.querySelector('#editor').focus(); document.querySelector('#editor').value = ''" });
    await driver.remoteInput({ tabId: "primary", action: "text", text: "remote input" });
    assert.equal(await js("document.querySelector('#editor').value"), "remote input");
    assert.equal(driver.getControl().holder, "human");
    await assert.rejects(driver.remoteInput({ tabId: "primary", action: "click", x: Infinity, y: 0.5 }), /invalid/);
    await assert.rejects(driver.remoteInput({ tabId: "missing", action: "text", text: "must not insert" }));
    assert.equal(await js("document.querySelector('#editor').value"), "remote input");
    driver.releaseControl();
  });
  await check("remote browser frames are ephemeral and leave no screenshot file", async () => {
    const shot = await driver.screenshot({ tabId: "primary", format: "jpeg", quality: 55, ephemeral: true });
    assert.ok(shot.dataUrl.startsWith("data:image/jpeg;base64,"));
    assert.ok(!shot.filePath);
  });
  await check("concurrent chats isolate tabs, explicit targets and help controls", async () => {
    const scoped = new BrowserController();
    const second = await addGuest("workspace-b-guest");
    scoped.inSession("a", () => scoped.registerWebview("a-tab", guest.id));
    scoped.inSession("b", () => scoped.registerWebview("b-tab", second.id));
    const [a, b] = await Promise.all([
      scoped.executeTool("browser_evaluate", { script: "return 'workspace A'" }, { sessionId: "a" }),
      scoped.executeTool("browser_evaluate", { script: "return 'workspace B'" }, { sessionId: "b" }),
    ]);
    assert.equal(JSON.parse(a.result).tabId, "a-tab");
    assert.equal(JSON.parse(b.result).tabId, "b-tab");
    const crossed = await scoped.executeTool("browser_evaluate", { tabId: "a-tab", script: "return 'wrong'" }, { sessionId: "b" });
    assert.equal(crossed.isError, true);
    const crossedSelection = await scoped.executeTool("browser_tabs", { tabId: "a-tab" }, { sessionId: "b" });
    assert.equal(crossedSelection.isError, true);
    await host.webContents.executeJavaScript(`document.getElementById('primary').style.visibility = 'hidden'; document.getElementById('primary').inert = true`);
    const typed = await scoped.executeTool("browser_type", { selector: "#editor", text: "workspace A input" }, { sessionId: "a" });
    assert.equal(typed.isError, false);
    assert.equal(await js(`document.querySelector('#editor').value`), "workspace A input");
    assert.notEqual(await second.executeJavaScript(`document.querySelector('#editor').value`), "workspace A input");
    scoped.inSession("a", () => scoped.requestHelp("A needs verification"));
    scoped.forTab("b-tab", () => scoped.releaseControl());
    assert.equal(scoped.inSession("a", () => scoped.getControl().requested), true);
    assert.equal(scoped.inSession("b", () => scoped.getControl().requested), false);
    assert.deepEqual(scoped.inSession("b", () => scoped.listTabs().map(tab => tab.tabId)), ["b-tab"]);
    scoped.inSession("a", () => scoped.unregisterWebview("a-tab"));
    scoped.inSession("b", () => scoped.unregisterWebview("b-tab"));
  });
  await check("tools within one chat serialize while pre-cancelled calls never execute", async () => {
    const scoped = new BrowserController();
    scoped.inSession("a", () => scoped.registerWebview("serial-tab", guest.id));
    const first = scoped.executeTool("browser_evaluate", { script: "window.__steps = []; await new Promise(resolve => setTimeout(resolve, 50)); window.__steps.push('first'); return true" }, { sessionId: "a" });
    const second = scoped.executeTool("browser_evaluate", { script: "window.__steps.push('second'); return window.__steps" }, { sessionId: "a" });
    assert.equal((await first).isError, false);
    assert.deepEqual(JSON.parse((await second).result).result, ["first", "second"]);
    const abort = new AbortController();
    abort.abort();
    const cancelled = await scoped.executeTool("browser_evaluate", { script: "window.__steps.push('wrong'); return true" }, { sessionId: "a", signal: abort.signal });
    assert.equal(cancelled.isError, true);
    assert.deepEqual(await js("window.__steps"), ["first", "second"]);
    scoped.inSession("a", () => scoped.unregisterWebview("serial-tab"));
  });
  await check("another chat's snapshot cannot invalidate a pending secret reference", async () => {
    const scoped = new BrowserController();
    const second = await addGuest("snapshot-b-guest");
    scoped.inSession("a", () => scoped.registerWebview("a-secret", guest.id));
    scoped.inSession("b", () => scoped.registerWebview("b-snapshot", second.id));
    const snapshot = await scoped.inSession("a", () => scoped.snapshot());
    const ref = snapshot.elements.find(element => element.name === "Custom code")!.ref;
    scoped.inSession("a", () => scoped.requestSecret("verification code", ref));
    await scoped.inSession("b", () => scoped.snapshot());
    await scoped.inSession("b", () => scoped.snapshot());
    await scoped.inSession("a", () => scoped.supplySecret("isolated-secret-321"));
    assert.equal(await js(`document.querySelector('#custom').value`), "isolated-secret-321");
    assert.equal(await second.executeJavaScript(`document.querySelector('#custom').value`), "");
    scoped.inSession("a", () => scoped.unregisterWebview("a-secret"));
    scoped.inSession("b", () => scoped.unregisterWebview("b-snapshot"));
  });
  await check("new-tab requests cannot reuse another chat's registered tab", async () => {
    let requests = 0;
    const scoped = new BrowserController({ onTabOpenRequest: async () => { requests++; return null; } });
    scoped.inSession("a", () => scoped.registerWebview("owned-a", guest.id));
    const result = await scoped.executeTool("browser_navigate", { url: origin, tabId: "owned-a", newTab: true }, { sessionId: "b" });
    assert.equal(result.isError, true);
    assert.match(result.result, /another conversation/);
    assert.equal(requests, 0);
    assert.equal(scoped.inSession("a", () => scoped.getTargetTab()!.guestContentsId), guest.id);
    scoped.inSession("a", () => scoped.unregisterWebview("owned-a"));
  });
  await check("pending auto-open tabs already have an owner before guest registration", async () => {
    const scoped = new BrowserController({ onTabOpenRequest: async payload => payload.tabId! });
    const waiting = scoped.inSession("a", () => scoped.ensureTargetTab({ tabId: "pending-a", newTab: true }));
    await assert.rejects(scoped.inSession("b", () => scoped.ensureTargetTab({ tabId: "pending-a", newTab: true })), /another conversation/);
    assert.throws(() => scoped.inSession("b", () => scoped.setActiveTab("pending-a")), /another conversation/);
    assert.throws(() => scoped.inSession("b", () => scoped.registerWebview("pending-a", guest.id)), /another conversation/);
    scoped.inSession("a", () => scoped.registerWebview("pending-a", guest.id));
    assert.equal((await waiting).tabId, "pending-a");
    scoped.inSession("a", () => scoped.unregisterWebview("pending-a"));
  });
  await check("late cleanup from a replaced guest cannot unregister its replacement", async () => {
    const scoped = new BrowserController();
    const replacement = await addGuest("replacement-guest");
    const originalListeners = guest.listenerCount("console-message");
    const replacementListeners = replacement.listenerCount("console-message");
    scoped.inSession("a", () => {
      scoped.registerWebview("replace-tab", guest.id);
      scoped.registerWebview("replace-tab", replacement.id);
      assert.equal(guest.listenerCount("console-message"), originalListeners);
      scoped.unregisterWebview("replace-tab", guest.id);
      assert.equal(scoped.getTargetTab()!.guestContentsId, replacement.id);
      scoped.unregisterWebview("replace-tab", replacement.id);
      assert.equal(scoped.getTargetTab(), null);
      assert.equal(replacement.listenerCount("console-message"), replacementListeners);
    });
  });
  await check("auto-open correlates each registration with its requested chat and tab", async () => {
    const requests: Array<{ tabId?: string; conversationId?: string }> = [];
    const scoped = new BrowserController({ onTabOpenRequest: async payload => { requests.push(payload); return payload.tabId!; } });
    const a = scoped.inSession("a", () => scoped.ensureTargetTab());
    const b = scoped.inSession("b", () => scoped.ensureTargetTab());
    assert.deepEqual(requests.map(request => request.conversationId), ["a", "b"]);
    assert.notEqual(requests[0].tabId, requests[1].tabId);
    const second = webContents.getAllWebContents().find(contents => contents.getType() === "webview" && contents.id !== guest.id)!;
    scoped.inSession("b", () => scoped.registerWebview(requests[1].tabId!, second.id));
    scoped.inSession("a", () => scoped.registerWebview("unrelated", guest.id));
    scoped.inSession("a", () => scoped.registerWebview(requests[0].tabId!, guest.id));
    assert.equal((await a).tabId, requests[0].tabId);
    assert.equal((await b).tabId, requests[1].tabId);
    scoped.inSession("a", () => { scoped.unregisterWebview(requests[0].tabId!); scoped.unregisterWebview("unrelated"); });
    scoped.inSession("b", () => scoped.unregisterWebview(requests[1].tabId!));
  });
  await check("cancellation releases a browser evaluation that never settles", async () => {
    const scoped = new BrowserController();
    scoped.inSession("stuck", () => scoped.registerWebview("stuck-tab", guest.id));
    await delay(50);
    const baselineListeners = guest.listenerCount("destroyed");
    const abort = new AbortController();
    const running = scoped.executeTool("browser_evaluate", { script: "return await new Promise(() => {})" }, { sessionId: "stuck", signal: abort.signal });
    await delay(100);
    abort.abort();
    const result = await running;
    assert.equal(result.isError, true);
    assert.match(result.result, /cancelled/);
    assert.equal(guest.listenerCount("destroyed"), baselineListeners);
    scoped.inSession("stuck", () => scoped.unregisterWebview("stuck-tab"));
  });
  await check("page promise timeout and guest destruction release their listeners", async () => {
    const baselineListeners = guest.listenerCount("destroyed");
    await assert.rejects((driver as any).awaitPage(guest, new Promise(() => {}), 50), /timed out/);
    assert.equal(guest.listenerCount("destroyed"), baselineListeners);
    const doomed = await addGuest("doomed");
    const operation = (driver as any).awaitPage(doomed, new Promise(() => {}));
    const rejected = assert.rejects(operation, /closed/);
    await host.webContents.executeJavaScript(`document.getElementById('doomed').remove()`);
    await rejected;
  });
  await check("cancelling human help clears the pending request", async () => {
    const abort = new AbortController();
    const help = driver.executeTool("browser_request_help", { reason: "verification" }, { signal: abort.signal });
    await delay(30);
    abort.abort();
    const result = await help;
    assert.equal(result.isError, true);
    assert.equal(driver.getControl().requested, false);
  });
  await check("four React browser guests survive chat switches and isolate same-origin storage", async () => {
    await host.webContents.executeJavaScript(await readFile(path.join(process.argv[2]!, "browser-isolation.js"), "utf8"));
    await host.webContents.executeJavaScript(`window.__renderIsolation(['d','b','a','c'], 'a', ${JSON.stringify(origin)})`);
    const readGuests = () => host.webContents.executeJavaScript(`['a','b','c','d'].map(id => document.getElementById('isolation-'+id).getWebContentsId())`) as Promise<number[]>;
    let ids: number[] = [];
    for (let i = 0; i < 100; i++) {
      try { ids = await readGuests(); if (ids.length === 4 && ids.every(Boolean)) break; } catch { /* Attach is asynchronous. */ }
      await delay(25);
    }
    assert.equal(ids.length, 4);
    const guests = ids.map(id => webContents.fromId(id)!);
    for (const [index, contents] of guests.entries()) {
      if (contents.isLoading()) await once(contents, "did-finish-load");
      assert.equal(await contents.executeJavaScript(`localStorage.getItem('isolation-owner')`), null);
      await contents.executeJavaScript(`localStorage.setItem('isolation-owner', '${index}');document.cookie='owner=${index};path=/'`);
    }
    const pending = guests[0]!.executeJavaScript(`new Promise(resolve => setTimeout(() => resolve(localStorage.getItem('isolation-owner')), 300))`);
    for (const active of ["b", "c", "d", "a"]) {
      await host.webContents.executeJavaScript(`window.__renderIsolation(['c','a','d','b'], '${active}', ${JSON.stringify(origin)})`);
      assert.deepEqual(await readGuests(), ids);
    }
    assert.equal(await pending, "0");
    for (const [index, contents] of guests.entries()) {
      assert.equal(contents.isDestroyed(), false);
      assert.equal(await contents.executeJavaScript(`localStorage.getItem('isolation-owner')`), String(index));
      assert.equal(await contents.executeJavaScript(`document.cookie`), `owner=${index}`);
    }
    const background = guests[3]!;
    assert.equal(await background.executeJavaScript(`Promise.race([new Promise(resolve => requestAnimationFrame(() => resolve('frame'))), new Promise(resolve => setTimeout(() => resolve('timeout'), 1500))])`), "frame");
    const backgroundDriver = new BrowserController();
    backgroundDriver.inSession("d", () => backgroundDriver.registerWebview("background-d", background.id));
    const shot = await backgroundDriver.inSession("d", () => backgroundDriver.screenshot({ annotate: false, format: "png" }));
    assert.ok(shot.width > 0 && shot.base64.length > 100);
    await unlink(shot.filePath);
    backgroundDriver.inSession("d", () => backgroundDriver.unregisterWebview("background-d", background.id));
    await host.webContents.executeJavaScript(`window.__unmountIsolation()`);
  });
  await check("address-bar search survives a Google challenge and offers an explicit fallback", async () => {
    const google = "https://www.google.com/";
    const query = "café & tea";
    const searchUrl = `${google}search?q=${encodeURIComponent(query)}`;
    const challengeUrl = `${google}sorry/index?continue=${encodeURIComponent(searchUrl + "&sei=fixture")}`;
    const fallbackRequests: string[] = [];
    let finishSearch!: () => void;
    const pendingSearch = new Promise<void>(resolve => { finishSearch = resolve; });
    session.fromPartition(browserPartition("search-test")).protocol.handle("https", async (request) => {
      if (request.url === searchUrl) {
        await pendingSearch;
        return Response.redirect(challengeUrl, 302);
      }
      if (request.url.startsWith("https://duckduckgo.com/?")) fallbackRequests.push(request.url);
      return new Response("<!doctype html><title>Search fixture</title>", {
        status: request.url === challengeUrl ? 429 : 200,
        headers: { "content-type": "text/html" },
      });
    });
    await host.loadURL(origin + "/browser-tab-host");
    const render = (code: string) => host.webContents.executeJavaScript(code);
    const waitForRenderer = async (condition: string) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        if (await render(condition)) return;
        await delay(25);
      }
      assert.fail(`Browser tab did not reflect navigation: ${condition}`);
    };
    const addressBarValue = 'document.querySelector("input").value';
    await render(await readFile(path.join(process.argv[2]!, "browser-isolation.js"), "utf8"));
    const attached = once(host.webContents, "did-attach-webview");
    await render(`window.__renderSearch(${JSON.stringify(google)})`);
    const [, searchGuest] = await attached;
    if (searchGuest.isLoading()) await once(searchGuest, "did-finish-load");
    const finished = once(searchGuest, "did-finish-load");
    try {
      await render(`window.__submitSearch(${JSON.stringify(query)})`);
      assert.equal(await render(addressBarValue), searchUrl);
    } finally {
      finishSearch();
    }
    await finished;
    assert.equal(searchGuest.getURL(), challengeUrl);
    const fallbackButton = `Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Search with DuckDuckGo")`;
    await waitForRenderer(`Boolean(${fallbackButton})`);
    assert.deepEqual(fallbackRequests, []);

    const fallbackFinished = once(searchGuest, "did-finish-load");
    await render(`${fallbackButton}.click()`);
    await fallbackFinished;
    const expectedFallback = new URL("https://duckduckgo.com/");
    expectedFallback.searchParams.set("q", query);
    assert.deepEqual(fallbackRequests, [expectedFallback.href]);
    assert.equal(searchGuest.getURL(), expectedFallback.href);
    await waitForRenderer(`${addressBarValue} === ${JSON.stringify(expectedFallback.href)} && !(${fallbackButton})`);

    const untrusted = "https://example.test/search?q=do-not-forward";
    for (const url of [
      `${google}sorry/index?continue=${encodeURIComponent(untrusted)}`,
      `https://example.test/sorry/index?continue=${encodeURIComponent(searchUrl)}`,
    ]) {
      await searchGuest.loadURL(url);
      await waitForRenderer(`${addressBarValue} === ${JSON.stringify(url)}`);
      assert.equal(await render(`Boolean(${fallbackButton})`), false);
    }
    assert.deepEqual(fallbackRequests, [expectedFallback.href]);
  });
  host.destroy();
  console.log(`Browser integration: ${passed} checks passed on Electron ${process.versions.electron}.`);
}

run().then(() => { server.close(); app.exit(0); }).catch((error) => {
  console.error(error);
  server.close();
  app.exit(1);
});
