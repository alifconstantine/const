import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ComputerToolContext, ToolExecutionResult } from "@const/agent";
import { DesktopScriptRuntimeHost } from "./desktop-script-runtime-host";
import { DesktopRequestQueue } from "./desktop-request-queue";
import { ComputerSnapshotStore } from "./computer-snapshot-store";
import type {
  BridgeRequest,
  ComputerActionResult,
  ComputerApp,
  ComputerSnapshot,
  ComputerWindow,
} from "./computer-types";

function resolveScriptPath(): string | null {
  const platform = process.platform;
  let filename = "";
  let directory = "";

  if (platform === "win32") {
    filename = "runtime.ps1";
    directory = "computer-use-windows";
  } else if (platform === "linux") {
    filename = "runtime.py";
    directory = "computer-use-linux";
  } else if (platform === "darwin") {
    filename = path.join("ConstComputerUse.app", "Contents", "MacOS", "const-computer-use-macos");
    directory = "computer-use-macos";
  } else {
    return null;
  }

  const candidates: string[] = [];

  // Packaged resources
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, "native", directory, filename),
      path.join(process.resourcesPath, directory, filename)
    );
  }

  // Development paths
  candidates.push(
    path.join(process.cwd(), "native", directory, "bin", process.arch, filename),
    path.join(process.cwd(), "apps/harness/desktop/native", directory, "bin", process.arch, filename),
    path.join(__dirname, "../native", directory, "bin", process.arch, filename),
    path.join(__dirname, "../native", directory, filename),
    path.join(__dirname, "../../native", directory, filename),
    path.join(process.cwd(), "native", directory, filename),
    path.join(process.cwd(), "apps/harness/desktop/native", directory, filename)
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export class ComputerController {
  private runtimeHost: Pick<DesktopScriptRuntimeHost, "request" | "dispose"> | null = null;
  private enabled: boolean = true;
  private snapshots = new ComputerSnapshotStore();
  private readonly operations = new DesktopRequestQueue();
  private owner: { sessionId: string; touched: number } | null = null;

  constructor(runtimeHost?: Pick<DesktopScriptRuntimeHost, "request" | "dispose">) {
    if (runtimeHost) this.runtimeHost = runtimeHost;
    else this.initRuntime();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.shutdown();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isAvailable(): boolean {
    return resolveScriptPath() !== null;
  }

  private initRuntime(): void {
    const scriptPath = resolveScriptPath();
    if (scriptPath) {
      this.runtimeHost = new DesktopScriptRuntimeHost(scriptPath);
    }
  }

  public async getCapabilities(): Promise<any> {
    if (!this.runtimeHost) {
      this.initRuntime();
    }
    if (!this.runtimeHost) {
      throw new Error(`Computer Use runtime not found for platform: ${process.platform}`);
    }
    const res = await this.runtimeHost.request({ tool: "handshake" });
    if (!res.ok) throw new Error(res.error || "Computer capability lookup failed");
    return res.capabilities;
  }

  public async listApps(): Promise<ComputerApp[]> {
    this.ensureReady();
    const res = await this.runtimeHost!.request({ tool: "list_apps" });
    if (!res.ok) throw new Error(res.error || "Computer app listing failed");
    return res.apps || [];
  }

  public async listWindows(targetApp: string): Promise<ComputerWindow[]> {
    this.ensureReady();
    const res = await this.runtimeHost!.request({
      tool: "list_windows",
      app: targetApp,
    });
    if (!res.ok) throw new Error(res.error || "Computer window listing failed");
    return res.windows || [];
  }

  public async getAppState(
    targetApp: string,
    options: {
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
      restoreWindow?: boolean;
    } = {}
  ): Promise<ComputerSnapshot> {
    this.ensureReady();
    let res;
    try { res = await this.runtimeHost!.request({
      tool: "get_app_state",
      session: options.sessionId ?? "default",
      app: targetApp,
      windowId: options.windowId,
      windowIndex: options.windowIndex,
      noScreenshot: options.noScreenshot,
      restoreWindow: options.restoreWindow ?? true,
    }); } catch (error) {
      this.snapshots.clear(options.sessionId ?? "default");
      throw error;
    }

    if (!res.ok || !res.snapshot) {
      this.snapshots.clear(options.sessionId ?? "default");
      throw new Error(res.error || `Failed to get app state for ${targetApp}`);
    }

    this.snapshots.remember(options.sessionId ?? "default", targetApp, res.snapshot);
    return res.snapshot;
  }

  public async click(
    targetApp: string,
    options: {
      elementIndex?: number;
      x?: number;
      y?: number;
      mouseButton?: string;
      clickCount?: number;
      modifiers?: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    } = {}
  ): Promise<ComputerActionResult> {
    return this.executeAction("click", targetApp, options);
  }

  public async setValue(
    targetApp: string,
    options: {
      elementIndex: number;
      value: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("set_value", targetApp, options);
  }

  public async typeText(
    targetApp: string,
    options: {
      text: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("type_text", targetApp, options);
  }

  public async pressKey(
    targetApp: string,
    options: {
      key: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("press_key", targetApp, options);
  }

  public async hotkey(
    targetApp: string,
    options: {
      key: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("hotkey", targetApp, options);
  }

  public async pasteText(
    targetApp: string,
    options: {
      text: string;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("paste_text", targetApp, options);
  }

  public async scroll(
    targetApp: string,
    options: {
      direction: string;
      pages?: number;
      elementIndex?: number;
      x?: number;
      y?: number;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("scroll", targetApp, options);
  }

  public async drag(
    targetApp: string,
    options: {
      fromElementIndex?: number;
      toElementIndex?: number;
      fromX?: number;
      fromY?: number;
      toX?: number;
      toY?: number;
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      sessionId?: string;
    }
  ): Promise<ComputerActionResult> {
    return this.executeAction("drag", targetApp, options);
  }

  private async executeAction(
    tool: string,
    targetApp: string,
    options: Record<string, any>
  ): Promise<ComputerActionResult> {
    this.ensureReady();
    const sessionId = options.sessionId ?? "default";
    const cached = this.snapshots.current(sessionId, targetApp, options.windowId, options.windowIndex);
    if (!cached) throw new Error("snapshot_required: inspect this app/window with computer_get_app_state before acting");
    const element = (index: unknown) => {
      if (index === undefined) return undefined;
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0) throw new Error("Invalid elementIndex");
      const record = cached.elements?.find(item => item.index === index);
      if (!record) throw new Error("stale_element: element index is absent from the latest snapshot; inspect the app again");
      return record;
    };
    const req: BridgeRequest = {
      tool,
      session: sessionId,
      app: `pid:${cached.app.pid}`,
      element: element(options.elementIndex),
      fromElement: element(options.fromElementIndex),
      toElement: element(options.toElementIndex),
      x: options.x,
      y: options.y,
      from_x: options.fromX,
      from_y: options.fromY,
      to_x: options.toX,
      to_y: options.toY,
      click_count: options.clickCount,
      mouse_button: options.mouseButton,
      modifiers: options.modifiers,
      action: options.action,
      direction: options.direction,
      pages: options.pages,
      text: options.text,
      key: options.key,
      value: options.value,
      windowId: options.windowId ?? (options.windowIndex == null ? cached.windowId : undefined),
      windowIndex: options.windowIndex ?? (options.windowId == null && cached.windowId == null ? cached.windowIndex : undefined),
      noScreenshot: options.noScreenshot,
      restoreWindow: true,
    };

    let res;
    try { res = await this.runtimeHost!.request(req); }
    catch (error) { this.snapshots.clear(sessionId); throw error; }
    if (!res.ok) {
      this.snapshots.clear(sessionId);
      return { ok: false, error: res.error || `Computer action ${tool} failed` };
    }
    if (res.snapshot) {
      this.snapshots.remember(sessionId, targetApp, res.snapshot);
    } else this.snapshots.clear(sessionId);
    return {
      ok: true,
      action: { ...res.action, verification: res.action?.verification ?? { state: "unverified", reason: "action_result_not_asserted" } },
      snapshot: res.snapshot,
      observationError: res.observationError,
    };
  }

  private ensureReady(): void {
    if (!this.enabled) {
      throw new Error("Computer Use is currently disabled in Settings.");
    }
    if (!this.runtimeHost) {
      this.initRuntime();
    }
    if (!this.runtimeHost) {
      throw new Error(`Computer Use runtime not found or unsupported for ${process.platform}.`);
    }
  }

  /**
   * Main dispatch entry point for Agent Tool Calling
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ComputerToolContext = {},
  ): Promise<ToolExecutionResult> {
    try {
      return await this.operations.enqueue(async () => {
        if (context.signal?.aborted) throw new Error("Computer operation cancelled before execution");
        const norm = toolName.toLowerCase().replace(/[-_]/g, "");
        const sessionId = context.sessionId ?? "default";
        if (this.owner && Date.now() - this.owner.touched > 120_000) this.releaseSession(this.owner.sessionId);
        if (!["computerlistapps", "computerlistwindows"].includes(norm)) {
          if (this.owner && this.owner.sessionId !== sessionId) throw new Error("desktop_busy: another chat owns desktop control; wait until it finishes");
          this.owner = { sessionId, touched: Date.now() };
        }
        const onAbort = () => {
          this.runtimeHost?.dispose();
          this.runtimeHost = null;
          this.releaseSession(sessionId);
        };
        context.signal?.addEventListener("abort", onAbort, { once: true });
        try { return await this.dispatchTool(toolName, { ...args, sessionId }); }
        finally { context.signal?.removeEventListener("abort", onAbort); }
      });
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }

  public releaseSession(sessionId: string): void {
    if (this.owner?.sessionId === sessionId) this.owner = null;
    this.snapshots.clear(sessionId);
  }

  private async dispatchTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    if (!this.enabled) {
      return {
        result: "Computer Use is currently disabled in Settings. Please turn on 'Enable Computer Use' in Settings > Computer Use to use desktop automation tools.",
        isError: true,
      };
    }

    const norm = toolName.toLowerCase().replace(/[-_]/g, "");

    try {
      if (norm === "computerlistapps") {
        const apps = await this.listApps();
        return {
          result: JSON.stringify({ count: apps.length, apps }, null, 2),
          isError: false,
        };
      }

      if (norm === "computerlistwindows") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const windows = await this.listWindows(String(args.app));
        return {
          result: JSON.stringify({ app: args.app, windows }, null, 2),
          isError: false,
        };
      }

      if (norm === "computergetappstate") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const snapshot = await this.getAppState(String(args.app), {
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
          restoreWindow: args.restoreWindow !== false,
        });

        const formatted = this.formatSnapshot(snapshot);
        return {
          result: formatted,
          isError: false,
          images: this.snapshotImages(snapshot),
        };
      }

      if (norm === "computerclick") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.click(String(args.app), {
          elementIndex: args.elementIndex !== undefined ? Number(args.elementIndex) : undefined,
          x: args.x !== undefined ? Number(args.x) : undefined,
          y: args.y !== undefined ? Number(args.y) : undefined,
          mouseButton: args.mouseButton,
          clickCount: args.clickCount,
          modifiers: args.modifiers,
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Click"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computersetvalue") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        if (args.elementIndex === undefined) throw new Error("Missing required argument: 'elementIndex'");
        const res = await this.setValue(String(args.app), {
          elementIndex: Number(args.elementIndex),
          value: String(args.value ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Set value"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computertypetext" || norm === "computertype") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.typeText(String(args.app), {
          text: String(args.text ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Type text"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computerpresskey") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.pressKey(String(args.app), {
          key: String(args.key ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Press key"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computerhotkey") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.hotkey(String(args.app), {
          key: String(args.key ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Hotkey"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computerpastetext" || norm === "computerpaste") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.pasteText(String(args.app), {
          text: String(args.text ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Paste"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computerscroll") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.scroll(String(args.app), {
          direction: String(args.direction ?? "down"),
          pages: args.pages ? Number(args.pages) : 1,
          elementIndex: args.elementIndex !== undefined ? Number(args.elementIndex) : undefined,
          x: args.x !== undefined ? Number(args.x) : undefined,
          y: args.y !== undefined ? Number(args.y) : undefined,
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Scroll"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      if (norm === "computerdrag") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.drag(String(args.app), {
          fromElementIndex: args.fromElementIndex !== undefined ? Number(args.fromElementIndex) : undefined,
          toElementIndex: args.toElementIndex !== undefined ? Number(args.toElementIndex) : undefined,
          fromX: args.fromX !== undefined ? Number(args.fromX) : undefined,
          fromY: args.fromY !== undefined ? Number(args.fromY) : undefined,
          toX: args.toX !== undefined ? Number(args.toX) : undefined,
          toY: args.toY !== undefined ? Number(args.toY) : undefined,
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
          sessionId: args.sessionId,
        });

        return {
          result: this.formatAction(res, "Drag"),
          isError: !res.ok,
          images: this.snapshotImages(res.snapshot),
        };
      }

      return {
        result: `Unknown computer tool: '${toolName}'`,
        isError: true,
      };
    } catch (err: any) {
      return {
        result: `Error executing ${toolName}: ${err.message || String(err)}`,
        isError: true,
      };
    }
  }

  private saveScreenshot(base64Data: string, appName: string): string | null {
    try {
      const dir = path.join(os.homedir(), ".const", "harness", "screenshots");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const safeApp = (appName || "app").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${safeApp}-latest.png`;
      const filePath = path.join(dir, filename);
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch {
      return null;
    }
  }

  private formatSnapshot(snapshot: ComputerSnapshot): string {
    const lines: string[] = [];
    lines.push(`App: ${snapshot.app.name} (PID: ${snapshot.app.pid})`);
    if (snapshot.windowTitle) {
      lines.push(`Window Title: "${snapshot.windowTitle}"`);
    }
    if (snapshot.windowBounds) {
      lines.push(
        `Bounds: [x=${snapshot.windowBounds.x}, y=${snapshot.windowBounds.y}, w=${snapshot.windowBounds.width}, h=${snapshot.windowBounds.height}]`
      );
    }
    if (snapshot.screenshotPngBase64) {
      const savedPath = this.saveScreenshot(
        snapshot.screenshotPngBase64,
        snapshot.app?.name || "app"
      );
      lines.push(
        `Screenshot: Captured (${snapshot.screenshotWidth}x${snapshot.screenshotHeight}, scale=${snapshot.screenshotScale ?? 1})`
      );
      if (savedPath) {
        lines.push(`Screenshot File: ${savedPath}`);
      }
      lines.push(
        `The screenshot is attached as a visual tool observation. Coordinates are window-local: x=image_pixel_x/${snapshot.screenshotScale ?? 1}, y=image_pixel_y/${snapshot.screenshotScale ?? 1}. Use computer_* tools to control ${snapshot.app.name}.`
      );
    } else lines.push("Screenshot: unavailable or skipped. No visual evidence was provided; use accessible UI evidence only.");
    lines.push("");
    lines.push("--- Accessible UI Elements Tree ---");
    if (snapshot.treeText) {
      lines.push(snapshot.treeText);
    } else if (snapshot.treeLines) {
      lines.push(snapshot.treeLines.join("\n"));
    }
    return lines.join("\n");
  }

  private snapshotImages(snapshot?: ComputerSnapshot): ToolExecutionResult["images"] {
    return snapshot?.screenshotPngBase64 ? [{ data: snapshot.screenshotPngBase64, mimeType: "image/png", width: snapshot.screenshotWidth ?? undefined, height: snapshot.screenshotHeight ?? undefined, scale: snapshot.screenshotScale ?? 1 }] : undefined;
  }

  private formatAction(action: ComputerActionResult, label: string): string {
    if (!action.ok) return `${label} failed: ${action.error}`;
    return `${label}: input/action delivered. Verification: ${JSON.stringify(action.action?.verification)}. Inspect the returned state/image before claiming the intended outcome (for example, a message sent).\n${action.snapshot ? this.formatSnapshot(action.snapshot) : `Post-action observation unavailable (${action.observationError ?? "unknown reason"}); inspect the app again before deciding whether to retry.`}`;
  }

  public shutdown(): void {
    this.runtimeHost?.dispose();
    this.runtimeHost = null;
    this.snapshots.clear();
    this.owner = null;
    this.operations.cancelPending(new Error("Computer controller shut down"));
  }
}

export const computerController = new ComputerController();
