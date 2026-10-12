import vm from "node:vm";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";

export interface EvalOptions {
  code: string;
  language?: "javascript" | "typescript" | "python" | "js" | "ts" | "py";
  sessionId?: string;
  timeoutMs?: number;
}

export interface EvalResult {
  value: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  isError: boolean;
  formatted: string;
}

// In-memory VM contexts indexed by session ID
const activeVmContexts = new Map<string, vm.Context>();

function getOrCreateVmContext(sessionId: string, workspacePath: string): vm.Context {
  let ctx = activeVmContexts.get(sessionId);
  if (!ctx) {
    const sandbox: Record<string, any> = {
      console: {
        log: (...args: any[]) => sandbox.__stdout.push(args.map(formatArg).join(" ")),
        warn: (...args: any[]) => sandbox.__stderr.push(args.map(formatArg).join(" ")),
        error: (...args: any[]) => sandbox.__stderr.push(args.map(formatArg).join(" ")),
        info: (...args: any[]) => sandbox.__stdout.push(args.map(formatArg).join(" ")),
      },
      __stdout: [] as string[],
      __stderr: [] as string[],
      workspacePath,
      process: {
        cwd: () => workspacePath,
        env: { ...process.env },
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    };
    ctx = vm.createContext(sandbox);
    activeVmContexts.set(sessionId, ctx);
  }
  return ctx;
}

function formatArg(arg: any): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * Execute in-memory code snippets with persistent state (REPL).
 * Inspired by oh-my-pi's EvalTool.
 */
export async function executeEval(
  options: EvalOptions,
  workspacePath: string,
  signal?: AbortSignal
): Promise<EvalResult> {
  const { code, language = "javascript", sessionId = "default", timeoutMs = 15000 } = options;
  const start = Date.now();

  const lang = language.toLowerCase();
  const isPython = lang === "python" || lang === "py";

  if (isPython) {
    return executePythonEval(code, workspacePath, timeoutMs, signal);
  }

  // JavaScript / TypeScript in-memory VM evaluation
  const ctx = getOrCreateVmContext(sessionId, workspacePath);
  ctx.__stdout = [];
  ctx.__stderr = [];

  try {
    const script = new vm.Script(code, {
      filename: `eval_${sessionId}.js`,
    });

    const result = script.runInContext(ctx, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    const durationMs = Date.now() - start;
    const stdout = (ctx.__stdout || []).join("\n");
    const stderr = (ctx.__stderr || []).join("\n");
    const formattedVal = result !== undefined ? formatArg(result) : "";

    const parts: string[] = [];
    if (stdout) parts.push(`[stdout]\n${stdout}`);
    if (stderr) parts.push(`[stderr]\n${stderr}`);
    if (formattedVal) parts.push(`[result]\n${formattedVal}`);
    if (parts.length === 0) parts.push("(Code evaluated successfully with no output)");

    return {
      value: formattedVal,
      stdout,
      stderr,
      durationMs,
      isError: false,
      formatted: parts.join("\n\n"),
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const stdout = (ctx.__stdout || []).join("\n");
    const stderr = (ctx.__stderr || []).join("\n");
    const errMsg = err.message || String(err);

    return {
      value: "",
      stdout,
      stderr: stderr ? `${stderr}\n${errMsg}` : errMsg,
      durationMs,
      isError: true,
      formatted: `[Eval Error]: ${errMsg}\n${stderr ? `stderr:\n${stderr}` : ""}`,
    };
  }
}

async function executePythonEval(
  code: string,
  workspacePath: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<EvalResult> {
  const start = Date.now();

  // Try uv run python or python
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  return new Promise((resolve) => {
    const child = spawn(pythonCmd, ["-c", code], {
      cwd: workspacePath,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill();
      });
    }

    child.stdout.on("data", (d) => {
      stdout += d.toString("utf-8");
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf-8");
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (timedOut) {
        return resolve({
          value: "",
          stdout,
          stderr: `Execution timed out after ${timeoutMs}ms`,
          durationMs,
          isError: true,
          formatted: `[Python Error]: Execution timed out after ${timeoutMs}ms`,
        });
      }

      const isError = exitCode !== 0 && exitCode !== null;
      const parts: string[] = [];
      if (stdout.trim()) parts.push(stdout.trim());
      if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);
      if (!parts.length) parts.push(isError ? `Process exited with code ${exitCode}` : "(Completed with no output)");

      resolve({
        value: stdout.trim(),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs,
        isError,
        formatted: parts.join("\n\n"),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      resolve({
        value: "",
        stdout: "",
        stderr: err.message,
        durationMs,
        isError: true,
        formatted: `[Python Error]: Failed to spawn Python: ${err.message}`,
      });
    });
  });
}
