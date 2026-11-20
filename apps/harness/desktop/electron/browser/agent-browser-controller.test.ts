import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import WebSocket from "ws";
import { resolveAgentBrowserBinary } from "./agent-browser-daemon.js";
import { AgentBrowserController } from "./agent-browser-controller.js";

function startLocalTestServer(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/page-a") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html>
          <html><head><title>Workspace A</title></head>
          <body style="margin:0;padding:24px;font-family:sans-serif">
            <h1 id="heading">Hello Harness</h1>
            <input id="email" type="text" style="width:240px;height:32px;display:block;margin-bottom:12px" />
            <button id="set-cookie" onclick="document.cookie='const_shared_auth=logged_in; path=/'; localStorage.setItem('const_user','alif'); document.getElementById('status').textContent='Logged In';">Sign In</button>
            <p id="status">Guest</p>
          </body></html>`);
        return;
      }
      if (req.url === "/page-b") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html>
          <html><head><title>Workspace B</title></head>
          <body style="margin:0;padding:24px;font-family:sans-serif">
            <h1>Workspace B</h1>
            <p id="shared-state"></p>
            <script>
              document.getElementById('shared-state').textContent =
                'cookie=' + document.cookie + '|ls=' + (localStorage.getItem('const_user') || 'none') + '|lang=' + navigator.language;
            </script>
          </body></html>`);
        return;
      }
      res.writeHead(404);
      res.end("Not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert.ok(addr && typeof addr !== "string");
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test("agent-browser native controller: shared session, tab isolation, stream, inspectPoint, and Stop/Continue flow", async () => {
  const bin = resolveAgentBrowserBinary();
  assert.ok(fs.existsSync(bin), `Expected native agent-browser binary at ${bin}`);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "const-ab-test-"));
  const { server, url } = await startLocalTestServer();

  let stopTriggeredFor: string | undefined;
  const controller = new AgentBrowserController({
    session: `test-${Date.now().toString(36)}`,
    socketDir: path.join(tempRoot, "daemon"),
    profileDir: path.join(tempRoot, "profile"),
    downloadDir: path.join(tempRoot, "downloads"),
  });

  controller.setCallbacks({
    onStopAgent: (convoId) => {
      stopTriggeredFor = convoId;
    },
  });

  try {
    // 1. Open tab in Workspace 1 & click "Sign In" via native agent-browser snapshot ref
    const sessA = await controller.openOrActivateTab("tab-ws-1", {
      url: `${url}/page-a`,
      conversationId: "convo-1",
      viewport: { width: 960, height: 640 },
    });
    assert.ok(sessA.streamUrl, "Expected live WebSocket streamUrl from agent-browser daemon");
    assert.equal(sessA.title, "Workspace A");

    const snapRes = await controller.executeTool("browser_snapshot", { tabId: "tab-ws-1" }, { sessionId: "convo-1" });
    assert.equal(snapRes.isError, false);
    assert.match(snapRes.result, /Sign In/);

    // Verify pill transitioned to running when agent executed a browser tool
    assert.equal(controller.getControl("convo-1").status, "running");

    const clickRes = await controller.executeTool(
      "browser_click",
      { tabId: "tab-ws-1", selector: "#set-cookie" },
      { sessionId: "convo-1" },
    );
    assert.equal(clickRes.isError, false);

    const verifyRes = await controller.executeTool(
      "browser_verify_text",
      { tabId: "tab-ws-1", text: "Logged In" },
      { sessionId: "convo-1" },
    );
    assert.equal(verifyRes.isError, false);

    // 2. Open tab in Workspace 2 -> must share cookies + localStorage + en-US language!
    const sessB = await controller.openOrActivateTab("tab-ws-2", {
      url: `${url}/page-b`,
      conversationId: "convo-2",
      viewport: { width: 960, height: 640 },
    });
    assert.equal(sessB.title, "Workspace B");

    const sharedState = await controller.executeTool(
      "browser_verify_text",
      { tabId: "tab-ws-2", text: "const_shared_auth=logged_in" },
      { sessionId: "convo-2" },
    );
    assert.equal(sharedState.isError, false, `Shared cookie missing: ${sharedState.result}`);

    const sharedLs = await controller.executeTool(
      "browser_verify_text",
      { tabId: "tab-ws-2", text: "ls=alif" },
      { sessionId: "convo-2" },
    );
    assert.equal(sharedLs.isError, false, `Shared localStorage missing: ${sharedLs.result}`);

    const langCheck = await controller.executeTool(
      "browser_verify_text",
      { tabId: "tab-ws-2", text: "lang=en-US" },
      { sessionId: "convo-2" },
    );
    assert.equal(langCheck.isError, false, `Expected en-US browser language: ${langCheck.result}`);

    // Verify real desktop Chrome UA (no HeadlessChrome token that triggers anti-bot WAFs)
    const uaRes = await controller.evaluate({ tabId: "tab-ws-2", script: "navigator.userAgent" }) as { result?: string };
    assert.ok(typeof uaRes?.result === "string" && uaRes.result.includes("Chrome/"));
    assert.equal(/HeadlessChrome/i.test(uaRes.result), false, `UA must not expose HeadlessChrome: ${uaRes.result}`);

    // 3. Switch back to Workspace 1 -> isolated tab still on Page A & control state preserved
    const reactivated = await controller.openOrActivateTab("tab-ws-1", { conversationId: "convo-1" });
    assert.equal(reactivated.control.status, "running");
    const inspected = await controller.inspectPoint("tab-ws-1", 40, 40);
    assert.ok(inspected, "Expected inspectPoint to return element metadata");
    assert.equal(inspected.url, `${url}/page-a`);

    // 4. Verify live WebSocket stream delivers JPEG frames, accepts human keyboard typing, and resizes live!
    const wsCheck = await new Promise<{ gotFrame: boolean; gotResizedFrame: boolean }>((resolve) => {
      const ws = new WebSocket(sessA.streamUrl!);
      let gotFrame = false;
      let gotResizedFrame = false;
      let sentTyping = false;
      let sentResize = false;
      const timer = setTimeout(() => {
        ws.close();
        resolve({ gotFrame, gotResizedFrame });
      }, 8_000);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "frame" && typeof msg.data === "string" && msg.data.length > 50) {
            gotFrame = true;
            if (typeof msg.seq === "number") {
              ws.send(JSON.stringify({ type: "ack", seq: msg.seq }));
            }
            if (!sentTyping) {
              sentTyping = true;
              // Focus #email via click at its center then type "ab@c" over WS keyboard protocol
              void controller
                .evaluate({ tabId: "tab-ws-1", script: "document.getElementById('email').focus(); true" })
                .then(() => {
                  for (const ch of ["a", "b", "@", "c"]) {
                    ws.send(
                      JSON.stringify({
                        type: "input_keyboard",
                        eventType: "keyDown",
                        key: ch,
                        code: ch === "@" ? "Digit2" : `Key${ch.toUpperCase()}`,
                        text: ch,
                        windowsVirtualKeyCode: ch === "@" ? 50 : ch.toUpperCase().charCodeAt(0),
                        modifiers: ch === "@" ? 8 : 0,
                      }),
                    );
                    ws.send(
                      JSON.stringify({
                        type: "input_keyboard",
                        eventType: "keyUp",
                        key: ch,
                        code: ch === "@" ? "Digit2" : `Key${ch.toUpperCase()}`,
                        windowsVirtualKeyCode: ch === "@" ? 50 : ch.toUpperCase().charCodeAt(0),
                        modifiers: ch === "@" ? 8 : 0,
                      }),
                    );
                  }
                });
            }
            if (!sentResize) {
              sentResize = true;
              void controller.setViewport("tab-ws-1", 720, 540, false);
            }
            if (msg.metadata?.deviceWidth === 720 && msg.metadata?.deviceHeight === 540) {
              gotResizedFrame = true;
              clearTimeout(timer);
              ws.close();
              resolve({ gotFrame, gotResizedFrame });
            }
          }
        } catch {}
      });
      ws.on("error", () => {
        clearTimeout(timer);
        resolve({ gotFrame, gotResizedFrame });
      });
    });
    assert.equal(wsCheck.gotFrame, true, "Expected live JPEG frame over agent-browser WebSocket stream");
    assert.equal(wsCheck.gotResizedFrame, true, "Expected live resized 720x540 JPEG frame after setViewport");

    const typedAndSize = (await controller.evaluate({
      tabId: "tab-ws-1",
      script: "document.getElementById('email').value + '|' + window.innerWidth + 'x' + window.innerHeight",
    })) as { result?: string };
    assert.equal(typedAndSize?.result, "ab@c|720x540", `Expected WS typing + resize to apply, got: ${typedAndSize?.result}`);

    // 5. Pause (browser_request_help) -> Continue (releaseControl) flow
    const helpPromise = controller.executeTool(
      "browser_request_help",
      { tabId: "tab-ws-1", reason: "Enter password" },
      { sessionId: "convo-1" },
    );
    await new Promise((r) => setTimeout(r, 40));
    const pausedState = controller.getControl("convo-1");
    assert.equal(pausedState.status, "paused");
    assert.equal(pausedState.requested, true);

    controller.releaseControl("tab-ws-1");
    const helpOutcome = await helpPromise;
    assert.equal(helpOutcome.isError, false);
    assert.match(helpOutcome.result, /Continue/);
    assert.equal(controller.getControl("convo-1").status, "running");

    // 6. Stop pill button (takeControl) -> sets idle & fires onStopAgent
    controller.takeControl("tab-ws-1");
    assert.equal(controller.getControl("convo-1").status, "idle");
    assert.equal(stopTriggeredFor, "convo-1");

    // 7. Domain block policy still enforced
    const blocked = await controller.executeTool(
      "browser_navigate",
      { tabId: "tab-ws-1", url: "file:///C:/Windows/win.ini" },
      { sessionId: "convo-1" },
    );
    assert.equal(blocked.isError, true);
  } finally {
    await controller.shutdown();
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
