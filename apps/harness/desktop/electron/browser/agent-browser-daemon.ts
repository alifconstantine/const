import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";

const requireFromHere = createRequire(import.meta.url);

export interface AgentBrowserResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  warning?: string;
}

export interface AgentBrowserDaemonOptions {
  session?: string;
  socketDir?: string;
  profileDir?: string;
  downloadDir?: string;
  /** Chrome args separated by commas for AGENT_BROWSER_ARGS. */
  chromeArgs?: string[];
  streamQuality?: number;
  /** Optional custom executable path for testing or explicit Chrome/Edge override. */
  executablePath?: string;
}

const DEFAULT_CHROME_ARGS = [
  "--lang=en-US",
  "--accept-lang=en-US,en;q=0.9",
  "--disable-blink-features=AutomationControlled",
];

function defaultDesktopChromeUserAgent(): string {
  if (process.platform === "darwin") {
    return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
  }
  if (process.platform === "linux") {
    return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
  }
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
}

/**
 * Resolve the platform-specific native `agent-browser` binary across dev,
 * pnpm workspace, and packaged Electron (`app.asar.unpacked`) layouts.
 */
export function resolveAgentBrowserBinary(): string {
  const override = process.env.CONST_AGENT_BROWSER_BIN?.trim();
  if (override && fs.existsSync(override)) return override;

  const platform = process.platform;
  const arch = process.arch;
  const isWin = platform === "win32";
  const ext = isWin ? ".exe" : "";

  const candidates: string[] = [];

  // 1. Platform optionalDependency package (@agent-browser/cli-<target>)
  const pkgCandidates: string[] = [];
  if (platform === "win32" && arch === "x64") {
    pkgCandidates.push("@agent-browser/cli-win32-x64-msvc");
  } else if (platform === "darwin" && arch === "arm64") {
    pkgCandidates.push("@agent-browser/cli-darwin-arm64");
  } else if (platform === "darwin" && arch === "x64") {
    pkgCandidates.push("@agent-browser/cli-darwin-x64");
  } else if (platform === "linux" && arch === "x64") {
    pkgCandidates.push("@agent-browser/cli-linux-x64-gnu", "@agent-browser/cli-linux-x64-musl");
  } else if (platform === "linux" && arch === "arm64") {
    pkgCandidates.push("@agent-browser/cli-linux-arm64-gnu", "@agent-browser/cli-linux-arm64-musl");
  }

  for (const pkgName of pkgCandidates) {
    try {
      const pkgJsonPath = requireFromHere.resolve(`${pkgName}/package.json`);
      const pkgDir = path.dirname(pkgJsonPath);
      const binName = `agent-browser${ext}`;
      candidates.push(path.join(pkgDir, binName));
      candidates.push(path.join(pkgDir, "bin", binName));
      // Packaged Electron asarUnpack path
      const unpacked = pkgDir.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
      if (unpacked !== pkgDir) {
        candidates.push(path.join(unpacked, binName));
        candidates.push(path.join(unpacked, "bin", binName));
      }
    } catch {
      // Optional package not installed for this target; try next.
    }
  }

  // 2. Main `agent-browser` package bin/ directory
  try {
    const mainPkgPath = requireFromHere.resolve("agent-browser/package.json");
    const mainDir = path.dirname(mainPkgPath);
    const binDir = path.join(mainDir, "bin");
    const platformName = `agent-browser-${platform}-${arch}${ext}`;
    candidates.push(path.join(binDir, platformName));
    candidates.push(path.join(binDir, `agent-browser${ext}`));
    const unpackedBinDir = binDir.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
    if (unpackedBinDir !== binDir) {
      candidates.push(path.join(unpackedBinDir, platformName));
      candidates.push(path.join(unpackedBinDir, `agent-browser${ext}`));
    }
  } catch {
    // Ignore if package resolution fails in unusual bundling environments.
  }

  // 3. Packaged Electron extraResources fallback
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, "agent-browser", `agent-browser${ext}`));
    candidates.push(path.join(resourcesPath, "native", "agent-browser", `agent-browser${ext}`));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Keep scanning.
    }
  }

  throw new Error(
    `Could not locate native agent-browser binary for ${platform}/${arch}. ` +
      `Ensure 'agent-browser' is installed (checked: ${candidates.slice(0, 4).join(", ")}).`,
  );
}

function defaultConstHarnessDir(): string {
  return path.join(os.homedir(), ".const", "harness");
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === "EPERM";
  }
}

/**
 * Manages a single shared persistent `agent-browser` native Rust daemon
 * backed by one shared Chromium user-data profile (`~/.const/harness/browser-profile`).
 *
 * All Harness workspaces & conversations share the same logged-in session
 * while keeping isolated tabs via `tab_new` / `tab_switch` labels.
 */
export class AgentBrowserDaemon {
  public readonly session: string;
  public readonly socketDir: string;
  public readonly profileDir: string;
  public readonly downloadDir: string;
  private readonly chromeArgs: string[];
  private readonly streamQuality: number;
  private readonly executablePath?: string;

  private child: ChildProcess | null = null;
  private startPromise: Promise<void> | null = null;
  private commandQueue: Promise<unknown> = Promise.resolve();
  private lastStderr: string[] = [];
  private disposed = false;

  constructor(options: AgentBrowserDaemonOptions = {}) {
    const baseDir = defaultConstHarnessDir();
    this.session = options.session || "const-harness";
    this.socketDir = options.socketDir || path.join(baseDir, "browser-daemon");
    this.profileDir = options.profileDir || path.join(baseDir, "browser-profile");
    this.downloadDir = options.downloadDir || path.join(baseDir, "browser-downloads");
    this.chromeArgs = options.chromeArgs?.length ? [...options.chromeArgs] : [...DEFAULT_CHROME_ARGS];
    this.streamQuality = options.streamQuality ?? 82;
    this.executablePath = options.executablePath;
  }

  private sidecarPath(ext: string): string {
    return path.join(this.socketDir, `${this.session}.${ext}`);
  }

  public getStreamPort(): number | null {
    try {
      const raw = fs.readFileSync(this.sidecarPath("stream"), "utf-8").trim();
      const port = Number.parseInt(raw, 10);
      return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
    } catch {
      return null;
    }
  }

  public getStreamUrl(options?: { maxFps?: number; pacing?: "ack" | "push" }): string | null {
    const port = this.getStreamPort();
    if (!port) return null;
    const maxFps = options?.maxFps ?? 30;
    const pacing = options?.pacing ?? "ack";
    return `ws://127.0.0.1:${port}/?pacing=${pacing}&maxFps=${maxFps}`;
  }

  private readPort(): number | null {
    try {
      const raw = fs.readFileSync(this.sidecarPath("port"), "utf-8").trim();
      const port = Number.parseInt(raw, 10);
      return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
    } catch {
      return null;
    }
  }

  private readPid(): number | null {
    try {
      const raw = fs.readFileSync(this.sidecarPath("pid"), "utf-8").trim();
      const pid = Number.parseInt(raw, 10);
      return Number.isInteger(pid) && pid > 0 ? pid : null;
    } catch {
      return null;
    }
  }

  private async canConnectEndpoint(): Promise<boolean> {
    if (process.platform === "win32") {
      const port = this.readPort();
      if (!port) return false;
      return await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        const timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 250);
        socket.once("connect", () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        });
      });
    }

    const sockPath = this.sidecarPath("sock");
    if (!fs.existsSync(sockPath)) return false;
    return await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ path: sockPath });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 250);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });
  }

  private cleanupStaleSidecars(): void {
    const pid = this.readPid();
    if (pid && isProcessAlive(pid)) return;
    for (const ext of ["pid", "port", "sock", "stream", "version", "engine", "provider", "extensions"]) {
      try {
        fs.rmSync(this.sidecarPath(ext), { force: true });
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  public async ensureStarted(): Promise<void> {
    if (this.disposed) {
      throw new Error("AgentBrowserDaemon has been disposed.");
    }
    if (await this.canConnectEndpoint()) {
      return;
    }
    if (this.startPromise) {
      return await this.startPromise;
    }
    this.startPromise = this.spawnDaemon().finally(() => {
      this.startPromise = null;
    });
    return await this.startPromise;
  }

  private async spawnDaemon(): Promise<void> {
    fs.mkdirSync(this.socketDir, { recursive: true });
    fs.mkdirSync(this.profileDir, { recursive: true });
    fs.mkdirSync(this.downloadDir, { recursive: true });

    if (await this.canConnectEndpoint()) {
      return;
    }

    this.cleanupStaleSidecars();
    const binary = resolveAgentBrowserBinary();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      AGENT_BROWSER_DAEMON: "1",
      AGENT_BROWSER_SESSION: this.session,
      AGENT_BROWSER_SOCKET_DIR: this.socketDir,
      AGENT_BROWSER_PROFILE: this.profileDir,
      AGENT_BROWSER_DOWNLOAD_PATH: this.downloadDir,
      AGENT_BROWSER_ARGS: this.chromeArgs.join(","),
      AGENT_BROWSER_USER_AGENT: process.env.AGENT_BROWSER_USER_AGENT || defaultDesktopChromeUserAgent(),
      AGENT_BROWSER_STREAM_QUALITY: String(this.streamQuality),
      AGENT_BROWSER_IDLE_TIMEOUT_MS: "0",
      AGENT_BROWSER_DEFAULT_TIMEOUT: "25000",
    };

    if (this.executablePath) {
      env.AGENT_BROWSER_EXECUTABLE_PATH = this.executablePath;
    }

    this.lastStderr = [];
    const child = spawn(binary, [], {
      env,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    this.child = child;

    let earlyExitCode: number | null = null;
    let spawnError: Error | null = null;

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trim();
      if (!text) return;
      this.lastStderr.push(text);
      if (this.lastStderr.length > 20) this.lastStderr.shift();
    });

    child.once("error", (err) => {
      spawnError = err;
    });

    child.once("exit", (code) => {
      earlyExitCode = code ?? 1;
      if (this.child === child) this.child = null;
    });

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`Failed to spawn agent-browser daemon: ${(spawnError as Error).message}`);
      }
      if (earlyExitCode !== null) {
        // Another daemon might have won the bind; check endpoint once.
        if (await this.canConnectEndpoint()) return;
        const stderrNote = this.lastStderr.length ? ` (${this.lastStderr.join(" | ")})` : "";
        throw new Error(`agent-browser daemon exited prematurely with code ${earlyExitCode}${stderrNote}`);
      }
      if (await this.canConnectEndpoint()) {
        // Give the daemon a brief moment to finish writing .stream sidecar if needed.
        for (let i = 0; i < 10 && !this.getStreamPort(); i++) {
          await new Promise((r) => setTimeout(r, 25));
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    const stderrNote = this.lastStderr.length ? ` (${this.lastStderr.join(" | ")})` : "";
    throw new Error(`Timed out waiting for agent-browser daemon to become ready${stderrNote}`);
  }

  /**
   * Run a serialized daemon action over the native TCP/Unix JSON socket.
   * Automatically starts or restarts the daemon if needed.
   */
  public send<T = any>(
    action: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30_000,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      await this.ensureStarted();
      try {
        return await this.sendOnce<T>(action, params, timeoutMs);
      } catch (err: any) {
        const msg = String(err?.message || "");
        const isConnErr =
          msg.includes("ECONNREFUSED") ||
          msg.includes("ECONNRESET") ||
          msg.includes("ENOENT") ||
          msg.includes("closed unexpectedly");
        if (!isConnErr || action === "close") {
          throw err;
        }
        // Recover once if the daemon crashed between calls.
        this.cleanupStaleSidecars();
        await this.ensureStarted();
        return await this.sendOnce<T>(action, params, timeoutMs);
      }
    };

    const next = this.commandQueue.then(run, run);
    this.commandQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async sendOnce<T>(
    action: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    const connectOpts: net.NetConnectOpts =
      process.platform === "win32"
        ? (() => {
            const port = this.readPort();
            if (!port) throw new Error("ENOENT: agent-browser daemon port file missing.");
            return { host: "127.0.0.1", port };
          })()
        : { path: this.sidecarPath("sock") };

    const id = crypto.randomUUID().slice(0, 12);
    const payload = JSON.stringify({ id, action, ...params }) + "\n";

    return await new Promise<T>((resolve, reject) => {
      const socket = net.createConnection(connectOpts);
      let buffer = "";
      let settled = false;

      const finish = (err?: Error, value?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (err) reject(err);
        else resolve(value as T);
      };

      const timer = setTimeout(() => {
        finish(new Error(`agent-browser '${action}' timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      socket.once("connect", () => {
        socket.write(payload);
      });

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf-8");
        const nl = buffer.indexOf("\n");
        if (nl === -1) return;
        const line = buffer.slice(0, nl).trim();
        if (!line) return;
        try {
          const parsed = JSON.parse(line) as AgentBrowserResponse<T>;
          if (parsed.success) {
            finish(undefined, parsed.data as T);
          } else {
            const err = new Error(parsed.error || `agent-browser '${action}' failed.`);
            if (parsed.code) (err as any).code = parsed.code;
            finish(err);
          }
        } catch (parseErr: any) {
          finish(new Error(`Invalid JSON response from agent-browser '${action}': ${parseErr?.message || parseErr}`));
        }
      });

      socket.once("error", (err) => {
        finish(err);
      });

      socket.once("close", () => {
        if (!settled) {
          finish(new Error(`agent-browser socket closed unexpectedly during '${action}'.`));
        }
      });
    });
  }

  /**
   * Gracefully shuts down the browser & daemon so Chrome flushes cookies and
   * localStorage cleanly into `profileDir`.
   */
  public async shutdown(): Promise<void> {
    try {
      if (await this.canConnectEndpoint()) {
        await this.sendOnce("close", {}, 5_000).catch(() => {});
      }
    } catch {
      // Best-effort graceful close.
    }

    const child = this.child;
    if (child && !child.killed) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            child.kill();
          } catch {}
          resolve();
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.child = null;
    this.cleanupStaleSidecars();
  }

  /**
   * Closes the running Chrome instance, wipes the shared persistent profile
   * directory, and lets the next browser command launch with a clean profile.
   */
  public async resetProfile(): Promise<void> {
    await this.shutdown();
    // Wait briefly for Windows file locks on Chrome's SQLite files to release.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(this.profileDir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    fs.mkdirSync(this.profileDir, { recursive: true });
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
    await this.shutdown();
  }
}
