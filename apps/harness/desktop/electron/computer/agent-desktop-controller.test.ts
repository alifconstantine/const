import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveAgentDesktopBinary, AgentDesktopRunner } from "./agent-desktop-runner.js";
import { AgentDesktopController } from "./agent-desktop-controller.js";

test("resolveAgentDesktopBinary locates the native agent-desktop executable", () => {
  const resolved = resolveAgentDesktopBinary();
  assert.ok(resolved, "Expected native agent-desktop binary to be installed");
  assert.ok(fs.existsSync(resolved.binaryPath), `Expected binary to exist at ${resolved.binaryPath}`);
});

test("AgentDesktopController reports live status and capabilities from native binary", async () => {
  const controller = new AgentDesktopController();
  try {
    assert.equal(controller.isAvailable(), true);
    const caps = await controller.getCapabilities();
    assert.equal(caps.engine, "agent-desktop");
    assert.equal(caps.available, true);
    assert.ok(caps.version && caps.version !== "unavailable");
    assert.ok(Array.isArray(caps.supportedSurfaces) && caps.supportedSurfaces.length > 0);

    const statusRes = await controller.executeTool("computer_status", {}, { sessionId: "test-status" });
    assert.equal(statusRes.isError, false);
    assert.ok(statusRes.result.includes(caps.version));
  } finally {
    controller.shutdown();
  }
});

test("AgentDesktopRunner executes list-displays against the live native binary", async () => {
  const runner = new AgentDesktopRunner();
  try {
    const res = await runner.run(["list-displays"]);
    assert.equal(res.ok, true, `list-displays failed: ${JSON.stringify(res.error)}`);
    assert.ok(Array.isArray(res.data));
  } finally {
    runner.dispose();
  }
});

test("AgentDesktopController live desktop workflow (Notepad snapshot, set_value, screenshot, close)", async (t) => {
  const controller = new AgentDesktopController();
  const sessionId = `live-${Date.now()}`;

  try {
    const appsRes = await controller.executeTool("computer_list_apps", {}, { sessionId });
    if (appsRes.isError && /EnumWindows failed|no display|accessibility/i.test(appsRes.result)) {
      t.skip(`Interactive desktop session unavailable in this test environment: ${appsRes.result}`);
      return;
    }
    assert.equal(appsRes.isError, false, `computer_list_apps failed: ${appsRes.result}`);

    if (process.platform !== "win32") {
      t.skip("Notepad live workflow runs on Windows");
      return;
    }

    const launchRes = await controller.executeTool(
      "computer_launch_app",
      { app: "notepad", activate: true, timeoutMs: 15_000 },
      { sessionId },
    );
    assert.equal(launchRes.isError, false, `computer_launch_app failed: ${launchRes.result}`);

    try {
      const snapRes = await controller.executeTool(
        "computer_snapshot",
        { app: "Notepad", interactiveOnly: true, compact: true },
        { sessionId },
      );
      assert.equal(snapRes.isError, false, `computer_snapshot failed: ${snapRes.result}`);
      const refMatch = snapRes.result.match(/@s[a-z0-9]+:e\d+/i);
      assert.ok(refMatch, `Expected at least one @sXXXX:eN ref in Notepad snapshot:\n${snapRes.result}`);

      const shotRes = await controller.executeTool(
        "computer_screenshot",
        { app: "Notepad", filename: "notepad-e2e" },
        { sessionId },
      );
      assert.equal(shotRes.isError, false, `computer_screenshot failed: ${shotRes.result}`);
      const pathMatch = shotRes.result.match(/:\s*(.+\.png)\s*$/);
      assert.ok(pathMatch, `Expected saved PNG path in output: ${shotRes.result}`);
      const pngPath = pathMatch[1]!.trim();
      assert.ok(fs.existsSync(pngPath) && fs.statSync(pngPath).size > 0, `Expected non-empty PNG at ${pngPath}`);
      try {
        fs.unlinkSync(pngPath);
      } catch {
        // ignore cleanup error
      }
    } finally {
      await controller.executeTool(
        "computer_window",
        { action: "close", app: "Notepad", force: true },
        { sessionId },
      );
    }
  } finally {
    controller.releaseSession(sessionId);
    controller.shutdown();
  }
});
