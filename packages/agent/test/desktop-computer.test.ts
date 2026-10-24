import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { DesktopScriptRuntimeHost } from "../../../apps/harness/desktop/electron/computer/desktop-script-runtime-host";
import { ComputerSnapshotStore } from "../../../apps/harness/desktop/electron/computer/computer-snapshot-store";
import { ComputerController } from "../../../apps/harness/desktop/electron/computer/computer-controller";
import { encodeMacRequest, decodeMacResponse } from "../../../apps/harness/desktop/electron/computer/macos-runtime-protocol";
import type { BridgeRequest, ComputerSnapshot } from "../../../apps/harness/desktop/electron/computer/computer-types";

class FakeProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  writes: Array<BridgeRequest> = [];
  stdin = new Writable({ write: (chunk, _encoding, done) => { this.writes.push(JSON.parse(String(chunk))); done(); } });
  kill = vi.fn(() => { queueMicrotask(() => this.emit("close", 0, null)); return true; });
  line(value: unknown) { this.stdout.write(JSON.stringify(value) + "\n"); }
  reply(index = 0) { this.line({ ok: true, requestId: this.writes[index]!.requestId }); }
}

const hosts: DesktopScriptRuntimeHost[] = [];
function runtime(ready = true, platform: NodeJS.Platform = "win32") {
  const children: FakeProcess[] = [];
  const launch = vi.fn(() => {
    const child = new FakeProcess(); children.push(child);
    if (ready) queueMicrotask(() => child.line({ ready: true }));
    return child as unknown as ChildProcess;
  });
  const host = new DesktopScriptRuntimeHost("fixture", { platform, spawn: launch as unknown as typeof spawn, requestTimeoutMs: 100, startupTimeoutMs: 100, idleTimeoutMs: 500 });
  hosts.push(host);
  return { host, children, launch };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
afterEach(() => { for (const host of hosts.splice(0)) host.dispose(); vi.useRealTimers(); });

describe("desktop runtime lifecycle", () => {
  it.each(["win32", "linux", "darwin"] as const)("uses the %s launch protocol", async platform => {
    vi.useFakeTimers(); const { host, children, launch } = runtime(true, platform);
    const request = host.request({ tool: "handshake" }); await flush();
    const args = launch.mock.calls[0] as unknown as [string, string[], unknown];
    if (platform === "darwin") {
      expect(args[1]).toEqual(["--stdio-agent", "--parent-pid", String(process.pid)]);
      expect(children[0]!.writes[0]).toMatchObject({ id: 1, method: "handshake" });
      children[0]!.line({ id: 1, ok: true, result: { platform: "darwin" } });
      expect(await request).toMatchObject({ ok: true, capabilities: { platform: "darwin" } });
    } else {
      expect(args[1]).toContain("-Serve");
      if (platform === "linux") expect(args[0]).toBe("python3");
      if (platform === "win32") expect(args[1]).toContain("-STA");
      children[0]!.reply(); await request;
    }
  });
  it("waits for the previous response before sending the next request", async () => {
    vi.useFakeTimers(); const { host, children } = runtime();
    const first = host.request({ tool: "handshake" }); const second = host.request({ tool: "list_apps" });
    await flush(); expect(children[0]!.writes).toHaveLength(1);
    children[0]!.reply(); await first; await flush();
    expect(children[0]!.writes).toHaveLength(2); children[0]!.reply(1); await second;
  });

  it("rejects startup exit and queued callers instead of leaving promises pending", async () => {
    vi.useFakeTimers(); const { host, children, launch } = runtime(false);
    const settled = Promise.allSettled([host.request({ tool: "handshake" }), host.request({ tool: "click" })]);
    await flush(); children[0]!.stderr.write("startup failed"); children[0]!.emit("close", 1, null);
    expect((await settled).map(item => item.status)).toEqual(["rejected", "rejected"]); expect(launch).toHaveBeenCalledTimes(1);
  });
  it("preserves a Linux startup diagnostic before the ready announcement", async () => {
    vi.useFakeTimers(); const { host, children } = runtime(false, "linux");
    const request = host.request({ tool: "handshake" });
    const rejected = expect(request).rejects.toThrow("missing desktop session");
    await flush(); children[0]!.line({ ok: false, error: "missing desktop session" });
    await rejected;
  });

  it("kills a timed-out helper and never replays the action or abandoned queue", async () => {
    vi.useFakeTimers(); const { host, children, launch } = runtime();
    const settled = Promise.allSettled([host.request({ tool: "click" }), host.request({ tool: "type_text" })]);
    await flush(); await vi.advanceTimersByTimeAsync(101);
    const results = await settled;
    expect(results.every(item => item.status === "rejected")).toBe(true);
    expect(children[0]!.writes.map(item => item.tool)).toEqual(["click"]);
    expect(children[0]!.kill).toHaveBeenCalledTimes(1); expect(launch).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched response IDs and starts a fresh helper only on a new request", async () => {
    vi.useFakeTimers(); const { host, children } = runtime();
    const first = host.request({ tool: "click" }); const failed = expect(first).rejects.toThrow("did not match");
    await flush(); children[0]!.line({ ok: true, requestId: 999 }); await failed;
    const second = host.request({ tool: "get_app_state" }); await flush();
    expect(children).toHaveLength(2); children[1]!.reply(); await second;
  });

  it("settles startup and queued requests when disposed", async () => {
    vi.useFakeTimers(); const { host, children } = runtime(false);
    const settled = Promise.allSettled([host.request({ tool: "handshake" }), host.request({ tool: "click" })]);
    await flush(); host.dispose(); expect((await settled).every(item => item.status === "rejected")).toBe(true);
    children[0]!.line({ ready: true }); expect(children[0]!.writes).toHaveLength(0);
    await expect(host.request({ tool: "handshake" })).rejects.toThrow("disposed");
  });

  it("terminates a helper when its input pipe fails before the process exits", async () => {
    vi.useFakeTimers(); const { host, children } = runtime();
    const request = host.request({ tool: "get_app_state" });
    const failed = expect(request).rejects.toThrow("pipe failed");
    await flush(); children[0]!.stdin.emit("error", new Error("pipe failed"));
    await failed;
    expect(children[0]!.kill).toHaveBeenCalledTimes(1);
  });

  it("bounds the response buffer and reclaims an idle helper", async () => {
    vi.useFakeTimers(); const { host, children } = runtime();
    const first = host.request({ tool: "handshake" }); await flush(); children[0]!.reply(); await first; await flush();
    await vi.advanceTimersByTimeAsync(501); expect(children[0]!.kill).toHaveBeenCalledTimes(1);
    const second = host.request({ tool: "get_app_state" }); const failed = expect(second).rejects.toThrow("buffer limit");
    await flush(); children[1]!.stdout.write("x".repeat(8 * 1024 * 1024 + 1)); await failed;
  });
});

describe("macOS native RPC adapter", () => {
  it("translates flat bridge arguments into native methods and element selectors", () => {
    expect(encodeMacRequest({ tool: "drag", requestId: 5, app: "pid:42", session: "one", fromElement: { index: 7 }, toElement: { index: 8 }, from_x: 10, from_y: 20, to_x: 30, to_y: 40, windowId: 99 })).toMatchObject({
      id: 5, method: "drag", params: { app: "pid:42", session: "one", fromElementIndex: 7, toElementIndex: 8, fromX: 10, fromY: 20, toX: 30, toY: 40, windowId: 99 },
    });
    expect(encodeMacRequest({ tool: "click", requestId: 6, element: { index: 9 }, click_count: 2, mouse_button: "right" })).toMatchObject({ method: "click", params: { elementIndex: 9, clickCount: 2, mouseButton: "right" } });
  });
  it("normalizes native windows, Retina screenshots, and sparse element indices", () => {
    const result = decodeMacResponse({ id: 1, ok: true, result: { snapshot: { id: "s1", app: { name: "Editor", pid: 42 }, window: { id: 99, x: 30, y: 40, width: 800, height: 600, title: "Document" }, treeText: '0 window Document\n\t7 text field Input', elements: [{ index: 0 }, { index: 7 }], elementCount: 2 }, screenshot: { data: "aW1hZ2U=", width: 1600, height: 1200, scale: 2 } } }, { tool: "get_app_state" });
    expect(result.snapshot).toMatchObject({ windowId: 99, windowBounds: { x: 30, y: 40, width: 800, height: 600 }, screenshotScale: 2, screenshotPngBase64: "aW1hZ2U=", elements: [{ index: 0 }, { index: 7 }] });
  });
  it("preserves permission errors and delivered actions whose window closed", () => {
    expect(decodeMacResponse({ id: 1, ok: false, error: { code: "permission_denied", message: "Grant Accessibility" } }, { tool: "click" })).toMatchObject({ ok: false, error: "permission_denied: Grant Accessibility" });
    expect(decodeMacResponse({ id: 2, ok: true, result: { action: { verification: { state: "unverified" } }, observationError: "window closed" } }, { tool: "hotkey" })).toMatchObject({ ok: true, observationError: "window closed", action: { verification: { state: "unverified" } } });
    expect(() => decodeMacResponse({ id: 3, ok: true, result: {} }, { tool: "get_app_state" })).toThrow("no snapshot");
  });
});

const snapshot = (pid = 10, windowId = 100): ComputerSnapshot => ({ app: { name: `App${pid}`, pid }, windowId, windowBounds: { x: 0, y: 0, width: 800, height: 600 }, elements: [{ index: 1, name: "Editor" }], screenshotPngBase64: "aW1hZ2U=", screenshotWidth: 800, screenshotHeight: 600, screenshotScale: 1 });

describe("desktop snapshot targeting", () => {
  it("isolates app, session, and window aliases and never caches image data", () => {
    const store = new ComputerSnapshotStore(); store.remember("one", "editor", snapshot());
    expect(store.current("one", "pid:10")?.screenshotPngBase64).toBeNull();
    expect(store.current("two", "editor")).toBeUndefined(); expect(store.current("one", "other")).toBeUndefined();
    expect(store.current("one", "editor", 101)).toBeUndefined();
    store.remember("one", "editor", snapshot(10, 101));
    expect(store.current("one", "editor", 100)?.windowId).toBe(100);
    expect(store.current("one", "editor", 101)?.windowId).toBe(101);
  });
  it("expires old snapshots and bounds retained entries", () => {
    let now = 1; const store = new ComputerSnapshotStore(() => now, 100, 2);
    for (const pid of [10, 11, 12]) store.remember("one", `App${pid}`, snapshot(pid));
    expect(store.current("one", "App10")).toBeUndefined();
    now = 102; expect(store.current("one", "App12")).toBeUndefined();
  });
});

describe("desktop controller", () => {
  function fixture() {
    const request = vi.fn(async (_request: BridgeRequest) => ({ ok: true, snapshot: snapshot(), action: { path: "synthetic", verification: { state: "unverified", reason: "synthetic_input" } } }));
    return { request, controller: new ComputerController({ request, dispose: vi.fn() }) };
  }
  it("requires observation of the matching app/window and rejects absent element indices", async () => {
    const { request, controller } = fixture(); await controller.getAppState("App10");
    await expect(controller.click("App11", { elementIndex: 1 })).rejects.toThrow("snapshot_required");
    await expect(controller.click("App10", { elementIndex: 1, windowId: 999 })).rejects.toThrow("snapshot_required");
    await expect(controller.click("App10", { elementIndex: 99 })).rejects.toThrow("stale_element");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("pins actions to the observed PID/window and preserves unverified status plus images", async () => {
    const { request, controller } = fixture();
    const state = await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "one" });
    expect(state.images?.[0]?.data).toBe("aW1hZ2U=");
    const result = await controller.executeTool("computer_type_text", { app: "App10", text: "Hai" }, { sessionId: "one" });
    expect(request.mock.calls.at(-1)?.[0]).toMatchObject({ app: "pid:10", windowId: 100, tool: "type_text" });
    expect(result.result).toContain('"state":"unverified"'); expect(result.result).not.toContain("successfully"); expect(result.images).toHaveLength(1);
  });
  it("keeps another chat from taking focus until the owner releases desktop control", async () => {
    const { request, controller } = fixture();
    await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "one" });
    const blocked = await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "two" });
    expect(blocked.isError).toBe(true); expect(blocked.result).toContain("desktop_busy"); expect(request).toHaveBeenCalledTimes(1);
    controller.releaseSession("one");
    const allowed = await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "two" }); expect(allowed.isError).toBe(false);
    controller.releaseSession("two");
  });
  it("does not silently report an app list when the bridge returned an error", async () => {
    const controller = new ComputerController({ request: async () => ({ ok: false, error: "permission denied" }), dispose() {} });
    await expect(controller.listApps()).rejects.toThrow("permission denied");
  });
  it("invalidates cached elements when an action was delivered but post-action observation failed", async () => {
    let actionRequests = 0;
    const controller = new ComputerController({
      request: async request => {
        if (request.tool === "get_app_state") return { ok: true, snapshot: snapshot() };
        actionRequests++;
        return { ok: true, action: { verification: { state: "unverified", reason: "post_action_observation_failed" } }, observationError: "window closed" };
      }, dispose() {},
    });
    await controller.executeTool("computer_get_app_state", { app: "App10" });
    const result = await controller.executeTool("computer_hotkey", { app: "App10", key: "Alt+F4" });
    expect(result.isError).toBe(false); expect(result.result).toContain("window closed");
    const next = await controller.executeTool("computer_click", { app: "App10", elementIndex: 1 });
    expect(next.isError).toBe(true); expect(next.result).toContain("snapshot_required"); expect(actionRequests).toBe(1);
  });
  it("disposes the active worker on cancellation and never delivers a pre-cancelled call", async () => {
    const abort = new AbortController();
    const dispose = vi.fn();
    const request = vi.fn(async () => {
      abort.abort(); return { ok: false, error: "cancelled" };
    });
    const controller = new ComputerController({ request, dispose });
    await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "one", signal: abort.signal });
    expect(dispose).toHaveBeenCalledTimes(1);
    await controller.executeTool("computer_get_app_state", { app: "App10" }, { sessionId: "one", signal: abort.signal });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
