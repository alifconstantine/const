import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app } from "electron";
import { DesktopScriptRuntimeHost } from "./desktop-script-runtime-host";
import type {
  BridgeRequest,
  BridgeResponse,
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
    filename = "const-computer-use-macos";
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
  private runtimeHost: DesktopScriptRuntimeHost | null = null;
  private enabled: boolean = true;
  private lastSnapshot: ComputerSnapshot | null = null;
  private snapshotCacheByApp = new Map<string, ComputerSnapshot>();

  constructor() {
    this.initRuntime();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
    return res.capabilities;
  }

  public async listApps(): Promise<ComputerApp[]> {
    this.ensureReady();
    const res = await this.runtimeHost!.request({ tool: "list_apps" });
    return res.apps || [];
  }

  public async listWindows(targetApp: string): Promise<ComputerWindow[]> {
    this.ensureReady();
    const res = await this.runtimeHost!.request({
      tool: "list_windows",
      app: targetApp,
    });
    return res.windows || [];
  }

  public async getAppState(
    targetApp: string,
    options: {
      windowId?: number | null;
      windowIndex?: number | null;
      noScreenshot?: boolean;
      restoreWindow?: boolean;
    } = {}
  ): Promise<ComputerSnapshot> {
    this.ensureReady();
    const res = await this.runtimeHost!.request({
      tool: "get_app_state",
      app: targetApp,
      windowId: options.windowId,
      windowIndex: options.windowIndex,
      noScreenshot: options.noScreenshot,
      restoreWindow: options.restoreWindow ?? true,
    });

    if (!res.ok || !res.snapshot) {
      throw new Error(res.error || `Failed to get app state for ${targetApp}`);
    }

    this.lastSnapshot = res.snapshot;
    this.snapshotCacheByApp.set(targetApp.toLowerCase(), res.snapshot);
    if (res.snapshot.app?.name) {
      this.snapshotCacheByApp.set(res.snapshot.app.name.toLowerCase(), res.snapshot);
    }
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
    const cached = this.snapshotCacheByApp.get(targetApp.toLowerCase()) || this.lastSnapshot;
    const req: BridgeRequest = {
      tool,
      app: targetApp,
      element: options.elementIndex !== undefined && cached?.elements ? cached.elements.find(e => e.index === options.elementIndex) : undefined,
      fromElement: options.fromElementIndex !== undefined && cached?.elements ? cached.elements.find(e => e.index === options.fromElementIndex) : undefined,
      toElement: options.toElementIndex !== undefined && cached?.elements ? cached.elements.find(e => e.index === options.toElementIndex) : undefined,
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
      windowId: options.windowId ?? cached?.windowId ?? null,
      windowIndex: options.windowIndex ?? cached?.windowIndex ?? null,
      noScreenshot: options.noScreenshot,
      restoreWindow: true,
    };

    const res = await this.runtimeHost!.request(req);
    if (!res.ok) {
      return { ok: false, error: res.error || `Computer action ${tool} failed` };
    }
    if (res.snapshot) {
      this.lastSnapshot = res.snapshot;
      this.snapshotCacheByApp.set(targetApp.toLowerCase(), res.snapshot);
    }
    return {
      ok: true,
      action: res.action,
      snapshot: res.snapshot,
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
    args: Record<string, any>
  ): Promise<{ result: any; isError: boolean }> {
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
          restoreWindow: args.restoreWindow !== false,
        });

        const formatted = this.formatSnapshot(snapshot);
        return {
          result: formatted,
          isError: false,
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
        });

        return {
          result: res.ok
            ? `Click successful.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Click failed: ${res.error}`,
          isError: !res.ok,
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
        });

        return {
          result: res.ok
            ? `Value set successfully.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Set value failed: ${res.error}`,
          isError: !res.ok,
        };
      }

      if (norm === "computertypetext" || norm === "computertype") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.typeText(String(args.app), {
          text: String(args.text ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
        });

        return {
          result: res.ok
            ? `Typed text successfully.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Type text failed: ${res.error}`,
          isError: !res.ok,
        };
      }

      if (norm === "computerpresskey") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.pressKey(String(args.app), {
          key: String(args.key ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
        });

        return {
          result: res.ok
            ? `Pressed key '${args.key}' successfully.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Press key failed: ${res.error}`,
          isError: !res.ok,
        };
      }

      if (norm === "computerhotkey") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.hotkey(String(args.app), {
          key: String(args.key ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
        });

        return {
          result: res.ok
            ? `Hotkey '${args.key}' sent successfully.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Hotkey failed: ${res.error}`,
          isError: !res.ok,
        };
      }

      if (norm === "computerpastetext" || norm === "computerpaste") {
        if (!args.app) throw new Error("Missing required argument: 'app'");
        const res = await this.pasteText(String(args.app), {
          text: String(args.text ?? ""),
          windowId: args.windowId,
          windowIndex: args.windowIndex,
          noScreenshot: args.noScreenshot === true,
        });

        return {
          result: res.ok
            ? `Pasted text successfully.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Paste failed: ${res.error}`,
          isError: !res.ok,
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
        });

        return {
          result: res.ok
            ? `Scroll ${args.direction} completed.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Scroll failed: ${res.error}`,
          isError: !res.ok,
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
        });

        return {
          result: res.ok
            ? `Drag completed.\n${res.snapshot ? this.formatSnapshot(res.snapshot) : ""}`
            : `Drag failed: ${res.error}`,
          isError: !res.ok,
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
        `Note: The screenshot is saved to disk for user reference. Do NOT navigate to it using browser tools. Use 'computer_*' tools ('computer_click', 'computer_type_text', 'computer_press_key', 'computer_hotkey') directly to control ${snapshot.app.name}.`
      );
    }
    lines.push("");
    lines.push("--- Accessible UI Elements Tree ---");
    if (snapshot.treeText) {
      lines.push(snapshot.treeText);
    } else if (snapshot.treeLines) {
      lines.push(snapshot.treeLines.join("\n"));
    }
    return lines.join("\n");
  }

  public shutdown(): void {
    this.runtimeHost?.dispose();
    this.runtimeHost = null;
    this.snapshotCacheByApp.clear();
  }
}

export const computerController = new ComputerController();
