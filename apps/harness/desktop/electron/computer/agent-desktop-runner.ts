import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";

const requireFromHere = createRequire(import.meta.url);

export interface AgentDesktopDisposition {
  delivery?: string;
  retry?: string;
}

export interface AgentDesktopRecovery {
  strategy?: string;
  retryable?: boolean;
  requires_fresh_snapshot?: boolean;
  retry_after_ms?: number;
}

export interface AgentDesktopError {
  code?: string;
  message?: string;
  suggestion?: string;
  recovery?: AgentDesktopRecovery;
  platform_detail?: string;
  disposition?: AgentDesktopDisposition;
}

export interface AgentDesktopEnvelope<T = any> {
  version?: string;
  ok: boolean;
  command?: string;
  data?: T;
  error?: AgentDesktopError;
}

export interface ResolvedAgentDesktopBinary {
  binaryPath: string;
  helperPath?: string;
  helperEnvKey?: string;
}

export interface AgentDesktopRunOptions {
  /** UTF-8 payload written to child stdin (for `--stdin` commands). */
  stdin?: string;
  /** Command execution timeout in milliseconds (default: 35_000). */
  timeoutMs?: number;
  /** Optional AbortSignal to cancel an in-flight command. */
  signal?: AbortSignal;
  /** Prepend global `--headed` flag before the subcommand. */
  headed?: boolean;
  /** Prepend global `--session <id>` namespace before the subcommand. */
  session?: string;
  /** Optional global `--wait-for <role:text>` selector. */
  waitFor?: string;
  /** Optional global `--wait-for-gone <role:text>` selector. */
  waitForGone?: string;
  /** Optional global `--wait-timeout <ms>` override. */
  waitTimeoutMs?: number;
}

export interface AgentDesktopRunnerOptions {
  binaryPath?: string;
  helperPath?: string;
  helperEnvKey?: string;
  stateRoot?: string;
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
  spawnImpl?: typeof spawn;
}

const DEFAULT_TIMEOUT_MS = 35_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

function platformBinarySpec(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): { binaryName: string; helperName?: string; helperEnvKey?: string } | null {
  if (platform === "win32") {
    if (arch === "arm64") return { binaryName: "agent-desktop-win32-arm64.exe" };
    return { binaryName: "agent-desktop-win32-x64.exe" };
  }
  if (platform === "darwin") {
    return {
      binaryName: arch === "x64" ? "agent-desktop-darwin-x64" : "agent-desktop-darwin-arm64",
      helperName: "agent-desktop-macos-helper",
      helperEnvKey: "AGENT_DESKTOP_MACOS_HELPER_PATH",
    };
  }
  if (platform === "linux") {
    return {
      binaryName: arch === "arm64" ? "agent-desktop-linux-arm64" : "agent-desktop-linux-x64",
      helperName: "agent-desktop-linux-clipboard-owner",
      helperEnvKey: "AGENT_DESKTOP_LINUX_CLIPBOARD_HELPER_PATH",
    };
  }
  return null;
}

function isReadableFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve the platform-specific native `agent-desktop` binary across dev,
 * pnpm workspace, packaged Electron (`app.asar.unpacked`), and extraResources.
 */
export function resolveAgentDesktopBinary(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): ResolvedAgentDesktopBinary | null {
  const override = process.env.CONST_AGENT_DESKTOP_BIN?.trim();
  if (override && isReadableFile(override)) {
    return { binaryPath: override };
  }

  const spec = platformBinarySpec(platform, arch);
  if (!spec) return null;

  const binDirs: string[] = [];

  // 1. Installed npm package `agent-desktop/bin/`
  try {
    const pkgJsonPath = requireFromHere.resolve("agent-desktop/package.json");
    const binDir = path.join(path.dirname(pkgJsonPath), "bin");
    const unpackedBinDir = binDir.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
    if (unpackedBinDir !== binDir) {
      binDirs.push(unpackedBinDir);
    }
    binDirs.push(binDir);
  } catch {
    // Package resolution may fail in non-standard bundle layouts; try fallbacks below.
  }

  // 2. Packaged Electron resourcesPath fallbacks
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    binDirs.push(
      path.join(resourcesPath, "app.asar.unpacked", "node_modules", "agent-desktop", "bin"),
      path.join(resourcesPath, "agent-desktop", "bin"),
      path.join(resourcesPath, "agent-desktop"),
    );
  }

  // 3. Local dev workspace fallbacks
  binDirs.push(
    path.join(process.cwd(), "node_modules", "agent-desktop", "bin"),
    path.join(process.cwd(), "apps", "harness", "desktop", "node_modules", "agent-desktop", "bin"),
  );

  for (const dir of binDirs) {
    const candidate = path.join(dir, spec.binaryName);
    if (isReadableFile(candidate)) {
      let helperPath: string | undefined;
      if (spec.helperName) {
        const helperCandidate = path.join(dir, spec.helperName);
        if (isReadableFile(helperCandidate)) {
          helperPath = helperCandidate;
        }
      }
      return {
        binaryPath: candidate,
        helperPath,
        helperEnvKey: helperPath ? spec.helperEnvKey : undefined,
      };
    }
  }

  return null;
}

export function defaultAgentDesktopStateRoot(): string {
  return path.join(os.homedir(), ".const", "harness", "agent-desktop");
}

function parseEnvelopeFromStdout(stdout: string, stderr: string, exitCode: number | null): AgentDesktopEnvelope {
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && "ok" in parsed) {
        return parsed as AgentDesktopEnvelope;
      }
    } catch {
      // Some commands may emit trailing/leading lines; scan lines from the end.
      const lines = trimmed.split(/\r?\n/).reverse();
      for (const line of lines) {
        const clean = line.trim();
        if (!clean.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(clean);
          if (parsed && typeof parsed === "object" && "ok" in parsed) {
            return parsed as AgentDesktopEnvelope;
          }
        } catch {
          // continue scanning
        }
      }
    }
  }

  const detail = (stderr || stdout || `exit code ${exitCode ?? "unknown"}`).trim();
  return {
    ok: false,
    error: {
      code: "RUNNER_PARSE_ERROR",
      message: `agent-desktop exited without a valid JSON response (${detail.slice(0, 400)})`,
    },
  };
}

/**
 * Serialized native runner for Vercel Labs' `agent-desktop` Rust binary.
 * Executes commands directly via `spawn(binaryPath, ...)` with isolated state root,
 * stdin piping for text/secrets, bounded buffers, timeout, and AbortSignal handling.
 */
export class AgentDesktopRunner {
  private readonly resolved: ResolvedAgentDesktopBinary | null;
  private readonly stateRoot: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly spawnImpl: typeof spawn;
  private queue: Promise<void> = Promise.resolve();
  private activeChild: ChildProcess | null = null;
  private disposed = false;

  constructor(options: AgentDesktopRunnerOptions = {}) {
    if (options.binaryPath) {
      this.resolved = {
        binaryPath: options.binaryPath,
        helperPath: options.helperPath,
        helperEnvKey: options.helperEnvKey,
      };
    } else {
      this.resolved = resolveAgentDesktopBinary();
    }
    this.stateRoot = options.stateRoot ?? defaultAgentDesktopStateRoot();
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.spawnImpl = options.spawnImpl ?? spawn;
  }

  public isAvailable(): boolean {
    return this.resolved !== null;
  }

  public getBinaryPath(): string | null {
    return this.resolved?.binaryPath ?? null;
  }

  public getStateRoot(): string {
    return this.stateRoot;
  }

  public buildArgs(subcommandArgs: string[], options: AgentDesktopRunOptions = {}): string[] {
    const globalFlags: string[] = [];
    if (options.session) {
      globalFlags.push("--session", options.session);
    }
    if (options.headed) {
      globalFlags.push("--headed");
    }
    if (options.waitFor) {
      globalFlags.push("--wait-for", options.waitFor);
    }
    if (options.waitForGone) {
      globalFlags.push("--wait-for-gone", options.waitForGone);
    }
    if (options.waitTimeoutMs !== undefined && Number.isFinite(options.waitTimeoutMs)) {
      globalFlags.push("--wait-timeout", String(Math.max(0, Math.round(options.waitTimeoutMs))));
    }
    return [...globalFlags, ...subcommandArgs];
  }

  /**
   * Run an `agent-desktop` subcommand serialized through the runner queue.
   */
  public run<T = any>(
    subcommandArgs: string[],
    options: AgentDesktopRunOptions = {},
  ): Promise<AgentDesktopEnvelope<T>> {
    if (this.disposed) {
      return Promise.reject(new Error("AgentDesktopRunner has been disposed."));
    }
    if (!this.resolved) {
      return Promise.reject(
        new Error(
          `Native agent-desktop binary not found for ${process.platform}/${process.arch}. Run pnpm install to install agent-desktop.`,
        ),
      );
    }

    const execute = () => this.execOnce<T>(subcommandArgs, options);
    const next = this.queue.then(execute, execute);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private execOnce<T = any>(
    subcommandArgs: string[],
    options: AgentDesktopRunOptions,
  ): Promise<AgentDesktopEnvelope<T>> {
    return new Promise((resolve, reject) => {
      if (this.disposed) {
        reject(new Error("AgentDesktopRunner has been disposed."));
        return;
      }
      if (options.signal?.aborted) {
        reject(new Error("Computer Use command aborted."));
        return;
      }

      const resolved = this.resolved!;
      try {
        fs.mkdirSync(this.stateRoot, { recursive: true });
      } catch {
        // Non-fatal; agent-desktop will surface a clear error if state root cannot be created.
      }

      const args = this.buildArgs(subcommandArgs, options);
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        AGENT_DESKTOP_HOME: this.stateRoot,
      };
      if (resolved.helperPath && resolved.helperEnvKey) {
        env[resolved.helperEnvKey] = resolved.helperPath;
      }

      const child = this.spawnImpl(resolved.binaryPath, args, {
        windowsHide: true,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.activeChild = child;

      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const timeoutMs = Math.max(1_000, options.timeoutMs ?? this.defaultTimeoutMs);
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (options.signal) {
          options.signal.removeEventListener("abort", onAbort);
        }
        if (this.activeChild === child) {
          this.activeChild = null;
        }
      };

      const terminateChild = () => {
        try {
          child.kill("SIGKILL");
        } catch {
          try {
            child.kill();
          } catch {
            // already exited
          }
        }
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        terminateChild();
        reject(err);
      };

      const onAbort = () => {
        fail(new Error("Computer Use command aborted."));
      };

      if (options.signal) {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      timer = setTimeout(() => {
        fail(new Error(`agent-desktop '${subcommandArgs[0] ?? "command"}' timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
        stdoutBytes += buf.length;
        if (stdoutBytes > this.maxOutputBytes) {
          fail(new Error(`agent-desktop stdout exceeded buffer limit (${this.maxOutputBytes} bytes).`));
          return;
        }
        stdoutChunks.push(buf);
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
        stderrBytes += buf.length;
        if (stderrBytes <= 512 * 1024) {
          stderrChunks.push(buf);
        }
      });

      child.on("error", (err) => {
        fail(new Error(`Failed to spawn agent-desktop: ${err.message}`));
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        resolve(parseEnvelopeFromStdout(stdout, stderr, code) as AgentDesktopEnvelope<T>);
      });

      if (child.stdin) {
        child.stdin.on("error", () => {
          // Child may exit before reading stdin (e.g., invalid flags); close event handles it.
        });
        if (options.stdin !== undefined) {
          child.stdin.end(options.stdin, "utf8");
        } else {
          child.stdin.end();
        }
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    if (this.activeChild) {
      try {
        this.activeChild.kill("SIGKILL");
      } catch {
        try {
          this.activeChild.kill();
        } catch {
          // ignore
        }
      }
      this.activeChild = null;
    }
  }
}
