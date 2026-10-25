import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { unlink } from "node:fs/promises";
import { app, BrowserWindow, nativeImage, session, webContents } from "electron";
import { BrowserController, HELP_REQUEST_TTL_MS } from "../electron/browser-controller";
import { BROWSER_PARTITION, applyBrowserContentsPolicy, applyBrowserSessionPolicy } from "../electron/browser/guest-policy";
import { assertBrowserNavigation, normalizeBrowserUrl } from "../electron/browser/navigation-policy";
import { sanitizeConsoleText, sanitizeUrl } from "../electron/browser/console-sanitizer";

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
  await host.loadURL("data:text/html,<html><body></body></html>");
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
  host.destroy();
  console.log(`Browser integration: ${passed} checks passed on Electron ${process.versions.electron}.`);
}

run().then(() => { server.close(); app.exit(0); }).catch((error) => {
  console.error(error);
  server.close();
  app.exit(1);
});
