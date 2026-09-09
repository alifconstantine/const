import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import type { FileMutationRecord } from "./mutation-ledger.js";

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  stepIndex?: number;
  onFileMutation?: (record: FileMutationRecord) => void;
}

// ---------------------------------------------------------------------------
// Shell Configuration & Discovery (aligned with Pi Windows architecture)
// ---------------------------------------------------------------------------

export interface ShellConfig {
  shell: string;
  args: string[];
  type: "bash" | "powershell";
}

let cachedShellConfig: ShellConfig | null = null;

export function getShellConfig(): ShellConfig {
  if (cachedShellConfig) return cachedShellConfig;

  if (process.platform === "win32") {
    // 1. Check Git Bash in standard locations
    const gitBashCandidates = [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
      "C:\\Program Files\\Git\\bin\\bash.exe",
    ];

    for (const candidate of gitBashCandidates) {
      if (fsSync.existsSync(candidate)) {
        cachedShellConfig = {
          shell: candidate,
          args: ["-c"],
          type: "bash",
        };
        return cachedShellConfig;
      }
    }

    // 2. Fallback to PowerShell
    cachedShellConfig = {
      shell: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"],
      type: "powershell",
    };
    return cachedShellConfig;
  }

  // Unix / macOS: /bin/bash, fallback to sh
  if (fsSync.existsSync("/bin/bash")) {
    cachedShellConfig = {
      shell: "/bin/bash",
      args: ["-c"],
      type: "bash",
    };
    return cachedShellConfig;
  }

  cachedShellConfig = {
    shell: "sh",
    args: ["-c"],
    type: "bash",
  };
  return cachedShellConfig;
}

// ---------------------------------------------------------------------------
// Path Normalization (supports Windows drive formats, Git Bash paths, & ~)
// ---------------------------------------------------------------------------

export function normalizeWindowsShellPath(filePath: string): string {
  if (!filePath || typeof filePath !== "string") return "";
  let clean = filePath.trim().replace(/^["']|["']$/g, "").trim();

  // Convert Git Bash/MSYS2 paths: /d/Code/... or /cygdrive/c/... -> D:\Code\...
  const bashDriveMatch = clean.match(/^\/(?:mnt\/|cygdrive\/)?([a-zA-Z])(?:\/(.*))?$/);
  if (bashDriveMatch) {
    const drive = bashDriveMatch[1]!.toUpperCase();
    const rest = (bashDriveMatch[2] || "").replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }

  // Convert bare drive with slash: d/Code/... or D/Code/... -> D:\Code\...
  const bareDriveMatch = clean.match(/^([a-zA-Z])\/(.*)$/);
  if (bareDriveMatch) {
    const drive = bareDriveMatch[1]!.toUpperCase();
    const rest = (bareDriveMatch[2] || "").replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }

  // Expand home directory ~
  if (clean === "~" || clean.startsWith("~/") || clean.startsWith("~\\")) {
    const home = os.homedir();
    clean = clean === "~" ? home : path.join(home, clean.slice(2));
  }

  return clean;
}

export function resolveSafePath(rawPath: string, workspacePath: string): string {
  if (!rawPath) return workspacePath;
  const normalized = normalizeWindowsShellPath(rawPath);
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(workspacePath, normalized);
}

// ---------------------------------------------------------------------------
// Native Tool Definitions (Pi Standard 4 Core Tools + Aliases)
// ---------------------------------------------------------------------------

export interface NativeToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export const CONST_DEFAULT_TOOLS: NativeToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read",
      description:
        "Read the contents of a file. Supports source code, text files, markdown, JSON, images (metadata), and PDF documents with automated text extraction. Optionally specify offset and limit to read specific line ranges.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read (relative to workspace or absolute).",
          },
          offset: {
            type: "number",
            description: "Line number to start reading from (1-indexed, optional).",
          },
          limit: {
            type: "number",
            description: "Maximum number of lines to read (optional).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description:
        "Create or overwrite a file with the specified content. Automatically creates any parent directories if they do not exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write (relative to workspace or absolute).",
          },
          content: {
            type: "string",
            description: "The complete content to write into the file.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit",
      description:
        "Edit an existing file by replacing an exact existing text substring (old_content) with new content (new_content). Automatically normalizes CRLF/LF line endings.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit.",
          },
          old_content: {
            type: "string",
            description: "The exact existing text chunk to find and replace.",
          },
          new_content: {
            type: "string",
            description: "The new text chunk to insert as replacement.",
          },
        },
        required: ["path", "old_content", "new_content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Execute a shell command in the workspace directory (using Git Bash on Windows or bash on Unix). Returns standard output, standard error, and exit status.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash shell command to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (defaults to 60).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ls",
      description:
        "List directory contents. Returns entries sorted alphabetically with '/' suffix for directories. Essential for inspecting workspace and folder structures.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory to list (defaults to workspace root).",
          },
          limit: {
            type: "number",
            description: "Maximum number of entries to return (default: 500).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find",
      description:
        "Search for files and directories matching a pattern or glob (e.g. '*.ts', '**/*.json', 'src/**/*.tsx'). Respects common ignores (.git, node_modules).",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern or name to match.",
          },
          path: {
            type: "string",
            description: "Directory to search in (defaults to workspace root).",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 1000).",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description:
        "Search file contents for regex or text patterns across files in the workspace.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Search pattern (regex or literal text).",
          },
          path: {
            type: "string",
            description: "Directory or file to search in (defaults to workspace root).",
          },
          glob: {
            type: "string",
            description: "Optional glob pattern to filter files (e.g. '*.ts', '*.json').",
          },
          ignore_case: {
            type: "boolean",
            description: "Case-insensitive search (default: false).",
          },
          limit: {
            type: "number",
            description: "Maximum number of matches to return (default: 100).",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mkdir",
      description:
        "Explicitly create a new directory or folder structure recursively. Safe to call if the folder already exists.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path of the directory to create (relative to workspace or absolute).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "powershell",
      description:
        "Execute a PowerShell command (Windows PowerShell or pwsh). Returns standard output, standard error, and exit status.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The PowerShell command to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (defaults to 60).",
          },
        },
        required: ["command"],
      },
    },
  },
];

// Helper argument extractors
function extractPathArg(args: Record<string, any>): string {
  const val =
    args.path ??
    args.file_path ??
    args.filePath ??
    args.filename ??
    args.file ??
    args.targetPath ??
    args.dir ??
    args.directory ??
    "";
  return typeof val === "string" ? normalizeWindowsShellPath(val) : "";
}

function extractContentArg(args: Record<string, any>): string {
  const val =
    args.content ??
    args.contents ??
    args.data ??
    args.text ??
    args.code ??
    args.body ??
    "";
  return typeof val === "string" ? val : JSON.stringify(val, null, 2);
}

function extractCommandArg(args: Record<string, any>): string {
  const val =
    args.command ??
    args.cmd ??
    args.script ??
    args.instruction ??
    args.raw ??
    "";
  return typeof val === "string" ? val.trim() : "";
}

// ---------------------------------------------------------------------------
// PDF Text Extraction Helper (Instant pdftotext with safe fallback)
// ---------------------------------------------------------------------------

async function extractPdfText(
  filePath: string,
  signal?: AbortSignal
): Promise<{ text: string; pages: number }> {
  const shellCfg = getShellConfig();

  // Fast path: If shell is Git Bash, use native pdftotext
  if (shellCfg.type === "bash") {
    try {
      const posixPath = filePath.replace(/\\/g, "/");
      const cmd = `pdftotext "${posixPath}" -`;

      const result = await runProcess(shellCfg.shell, [...shellCfg.args, cmd], {
        cwd: path.dirname(filePath),
        signal,
        timeoutMs: 15000,
      });

      if (result.stdout && result.stdout.trim().length > 0) {
        const text = result.stdout.trim();
        const pages = text.split("\f").filter(Boolean).length || 1;
        return { text, pages };
      }
    } catch {
      // Fallback below
    }
  }

  // Safe Fallback: Streamlined text extraction
  try {
    const buffer = await fs.readFile(filePath);
    const content = buffer.toString("latin1");
    const matches = content.match(/\/Title\s*\(([^)]+)\)|\/Author\s*\(([^)]+)\)/g) || [];
    const info = matches.map((m) => m.replace(/[\/\(\)]/g, "")).join(" | ");
    return {
      text: `[PDF Document: ${path.basename(filePath)}]\n${info ? `Metadata: ${info}\n` : ""}(PDF file is valid on disk. Note: install Git for Windows to enable native high-speed pdftotext extraction).`,
      pages: 1,
    };
  } catch (err: any) {
    throw new Error(`Failed to extract text from PDF: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Process Runner (Pi style: never crashes on non-zero exit codes)
// ---------------------------------------------------------------------------

interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      const child = spawn(
        path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
        ["/F", "/T", "/PID", String(pid)],
        {
          stdio: "ignore",
          detached: true,
          windowsHide: true,
        }
      );
      child.once("error", () => {});
    } catch {
      // Ignore errors if taskkill fails
    }
  } else {
    // Unix: kill entire process group with negative PID
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Process already dead
      }
    }
  }
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<ProcessRunResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error("Operation cancelled"));
    }

    const isUnix = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      detached: isUnix,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let isSettled = false;
    let timer: NodeJS.Timeout | undefined;
    let drainTimer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (drainTimer) clearTimeout(drainTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    };

    const finish = (code: number | null) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();

      try {
        child.stdout?.destroy();
      } catch {}
      try {
        child.stderr?.destroy();
      } catch {}

      if (timedOut) {
        return resolve({
          stdout,
          stderr: `${stderr}\n[Command timed out after ${options.timeoutMs! / 1000}s]`,
          exitCode: 124,
        });
      }
      resolve({ stdout, stderr, exitCode: code });
    };

    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          killProcessTree(child.pid);
        }
        drainTimer = setTimeout(() => finish(124), 1000);
      }, options.timeoutMs);
    }

    const onAbort = () => {
      if (child.pid) {
        killProcessTree(child.pid);
      }
      try {
        child.stdout?.destroy();
      } catch {}
      try {
        child.stderr?.destroy();
      } catch {}
      cleanup();
      reject(new Error("Operation cancelled"));
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    });

    // When shell process exits, give remaining background streams at most 1.5s to drain.
    // Prevents orphan background servers (e.g. `pnpm start &`) from hanging execution indefinitely.
    child.on("exit", (code) => {
      if (drainTimer) return;
      drainTimer = setTimeout(() => {
        if (child.pid) {
          killProcessTree(child.pid);
        }
        finish(code);
      }, 1500);
    });

    child.on("close", (code) => {
      finish(code);
    });
  });
}

// ---------------------------------------------------------------------------
// Tool Execution Router
// ---------------------------------------------------------------------------

export async function executeNativeTool(
  toolName: string,
  args: Record<string, any>,
  workspacePath: string,
  optionsOrSignal?: AbortSignal | ExecuteToolOptions
): Promise<{ result: any; isError: boolean }> {
  try {
    const options: ExecuteToolOptions =
      optionsOrSignal instanceof AbortSignal
        ? { signal: optionsOrSignal }
        : optionsOrSignal || {};
    const signal = options.signal;

    if (signal?.aborted) {
      return { result: "Action cancelled", isError: true };
    }

    const normalizedTool = toolName.toLowerCase().replace(/[-_]/g, "");

    // -----------------------------------------------------------------------
    // Tool: read (aliases: read_file, cat)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "read" ||
      normalizedTool === "readfile" ||
      normalizedTool === "cat"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }

      const filePath = resolveSafePath(rawPath, workspacePath);

      try {
        const stat = await fs.stat(filePath);

        // Self-heal: If directory, list its contents
        if (stat.isDirectory()) {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          const items = entries.map(
            (e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`
          );
          return {
            result: `Path '${filePath}' is a directory, not a file.\nDirectory contents:\n${items.join("\n")}`,
            isError: false,
          };
        }

        const ext = path.extname(filePath).toLowerCase();

        // 1. PDF File Extraction
        if (ext === ".pdf") {
          try {
            const { text, pages } = await extractPdfText(filePath, signal);
            const previewLimit = 35000;
            const preview =
              text.length > previewLimit
                ? text.slice(0, previewLimit) +
                  `\n\n[... Document truncated at ${previewLimit} characters (Total: ${text.length} chars, ~${pages} pages) ...]`
                : text;

            return {
              result: `[PDF Document: ${path.basename(filePath)} | ${pages} Pages | ${(stat.size / 1024).toFixed(1)} KB]\n\n${preview}`,
              isError: false,
            };
          } catch (pdfErr: any) {
            return {
              result: `Failed to extract PDF text (${path.basename(filePath)}): ${pdfErr.message}`,
              isError: true,
            };
          }
        }

        // 2. Image Files
        const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".ico"];
        if (imageExtensions.includes(ext)) {
          return {
            result: `[Image File: ${path.basename(filePath)} | Format: ${ext.slice(1).toUpperCase()} | Size: ${(stat.size / 1024).toFixed(1)} KB]\nPath: ${filePath}\n(Image file verified on disk).`,
            isError: false,
          };
        }

        // 3. Regular Text & Code Files
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split(/\r?\n/);

        // Handle offset & limit (1-indexed)
        const offset = typeof args.offset === "number" && args.offset > 0 ? args.offset - 1 : 0;
        const limit = typeof args.limit === "number" && args.limit > 0 ? args.limit : lines.length;

        const selectedLines = lines.slice(offset, offset + limit);
        const slicedText = selectedLines.join("\n");

        const maxChars = 50000;
        if (slicedText.length > maxChars) {
          const truncated =
            slicedText.slice(0, maxChars) +
            `\n\n[... Content truncated at ${maxChars} characters (Total: ${lines.length} lines) ...]`;
          return { result: truncated, isError: false };
        }

        return { result: slicedText, isError: false };
      } catch (err: any) {
        if (err.code === "ENOENT") {
          const parentDir = path.dirname(filePath);
          let suggestion = "";
          try {
            if (fsSync.existsSync(parentDir)) {
              const files = await fs.readdir(parentDir);
              suggestion =
                `\nFiles available in '${parentDir}':\n` +
                files.slice(0, 15).map((f) => `- ${f}`).join("\n");
            }
          } catch {
            // ignore
          }

          return {
            result: `File not found: '${filePath}'. Verify the path.${suggestion}`,
            isError: true,
          };
        }
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Tool: write (aliases: write_file)
    // -----------------------------------------------------------------------
    if (normalizedTool === "write" || normalizedTool === "writefile") {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const filePath = resolveSafePath(rawPath, workspacePath);
      const content = extractContentArg(args);

      // Auto-create parent directories (Pi standard)
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Pre-flight snapshot check for rollback
      let previousContent: string | null = null;
      let operation: "create" | "modify" = "create";
      if (fsSync.existsSync(filePath)) {
        try {
          previousContent = await fs.readFile(filePath, "utf-8");
          operation = "modify";
        } catch {
          // ignore
        }
      }

      await fs.writeFile(filePath, content, "utf-8");

      const displayPath = path.isAbsolute(rawPath)
        ? filePath
        : path.relative(workspacePath, filePath);

      // Record file mutation for rollback ledger
      options.onFileMutation?.({
        id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        stepIndex: options.stepIndex ?? 0,
        operation,
        absolutePath: filePath,
        filePath: filePath,
        targetFile: displayPath || filePath,
        previousContent,
        newContent: content,
        timestamp: Date.now(),
      });

      return {
        result: `File written successfully: ${displayPath} (${content.length} characters)`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: edit (aliases: edit_file, replace_in_file)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "edit" ||
      normalizedTool === "editfile" ||
      normalizedTool === "replaceinfile"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const filePath = resolveSafePath(rawPath, workspacePath);

      const oldContent =
        args.old_content ??
        args.oldContent ??
        args.old_text ??
        args.oldText ??
        args.old_string ??
        args.target_content ??
        "";
      const newContent =
        args.new_content ??
        args.newContent ??
        args.new_text ??
        args.newText ??
        args.replacement_content ??
        "";

      if (!oldContent) {
        return {
          result: "Error: Missing 'old_content' parameter to replace.",
          isError: true,
        };
      }

      const fileText = await fs.readFile(filePath, "utf-8");

      const editDisplayPath = path.isAbsolute(rawPath)
        ? filePath
        : path.relative(workspacePath, filePath);

      // 1. Direct match
      if (fileText.includes(oldContent)) {
        const updated = fileText.replace(oldContent, newContent);
        await fs.writeFile(filePath, updated, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: updated,
          timestamp: Date.now(),
        });

        return {
          result: `Successfully edited '${path.basename(filePath)}'. Replaced ${oldContent.length} characters with ${newContent.length} characters.`,
          isError: false,
        };
      }

      // 2. CRLF <-> LF tolerant matching
      const normalizedFileText = fileText.replace(/\r\n/g, "\n");
      const normalizedOld = oldContent.replace(/\r\n/g, "\n");

      if (normalizedFileText.includes(normalizedOld)) {
        const updated = normalizedFileText.replace(normalizedOld, newContent.replace(/\r\n/g, "\n"));
        await fs.writeFile(filePath, updated, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: updated,
          timestamp: Date.now(),
        });

        return {
          result: `Successfully edited '${path.basename(filePath)}' (line-endings normalized).`,
          isError: false,
        };
      }

      // 3. Trim trailing whitespace tolerant matching (Pi standard)
      const trimTrailing = (s: string) => s.split("\n").map((l) => l.trimEnd()).join("\n");
      const trimmedFileText = trimTrailing(normalizedFileText);
      const trimmedOld = trimTrailing(normalizedOld);

      if (trimmedFileText.includes(trimmedOld)) {
        const updated = trimmedFileText.replace(trimmedOld, trimTrailing(newContent.replace(/\r\n/g, "\n")));
        await fs.writeFile(filePath, updated, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: updated,
          timestamp: Date.now(),
        });

        return {
          result: `Successfully edited '${path.basename(filePath)}' (whitespace-tolerant matching).`,
          isError: false,
        };
      }

      const totalLines = fileText.split(/\r?\n/).length;
      return {
        result: `[EDIT FAILED]: 'old_content' not found in '${path.basename(filePath)}' (file has ${totalLines} lines).\nReason: Exact match failed. The target content may have different indentation, whitespace, or may have already been modified.\nAction Required: Use the 'read' tool to inspect the latest file contents around your target area before attempting another edit. Do NOT repeat the exact same edit arguments without verifying the file.`,
        isError: true,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: bash (aliases: run_command, exec, terminal, sh)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "bash" ||
      normalizedTool === "runcommand" ||
      normalizedTool === "exec" ||
      normalizedTool === "terminal" ||
      normalizedTool === "sh"
    ) {
      let cmd = extractCommandArg(args);
      if (!cmd) {
        return {
          result: "Error: No command provided to execute.",
          isError: true,
        };
      }

      // Strip redundant powershell -Command wrappers if passed
      if (cmd.startsWith("powershell -Command ") || cmd.startsWith("powershell.exe -Command ")) {
        cmd = cmd.replace(/^powershell(?:\.exe)?\s+-Command\s+["']?(.*?)["']?$/s, "$1");
      }

      const shellCfg = getShellConfig();
      const timeoutMs = (typeof args.timeout === "number" ? args.timeout : 60) * 1000;

      const { stdout, stderr, exitCode } = await runProcess(
        shellCfg.shell,
        [...shellCfg.args, cmd],
        {
          cwd: workspacePath,
          signal,
          timeoutMs,
        }
      );

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      const isFailed = exitCode !== 0 && exitCode !== null;
      if (isFailed) {
        output = `[Command failed with exit code ${exitCode}]\nExit code: ${exitCode}\n${output}`.trim();
      }

      if (!output.trim()) {
        output = isFailed
          ? `[Command exited with error code ${exitCode} and produced no output]`
          : "(Command completed with no output)";
      }

      return {
        result: output.trim(),
        isError: isFailed,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: ls (aliases: list_dir, dir)
    // -----------------------------------------------------------------------
    if (normalizedTool === "ls" || normalizedTool === "listdir" || normalizedTool === "dir") {
      const rawPath = extractPathArg(args);
      const targetDir = rawPath ? resolveSafePath(rawPath, workspacePath) : workspacePath;

      if (!fsSync.existsSync(targetDir)) {
        return {
          result: `Directory not found: '${targetDir}'`,
          isError: true,
        };
      }

      const stat = await fs.stat(targetDir);
      if (!stat.isDirectory()) {
        return {
          result: `Path '${targetDir}' is a file, not a directory.`,
          isError: true,
        };
      }

      const limit = typeof args.limit === "number" ? args.limit : 500;
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
      const truncated = sorted.slice(0, limit);

      const formatted = truncated.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
      const notice = sorted.length > limit ? `\n... (${sorted.length - limit} more entries truncated)` : "";

      return {
        result: formatted ? formatted + notice : "(Empty directory)",
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: mkdir (aliases: create_directory, makedir)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "mkdir" ||
      normalizedTool === "createdirectory" ||
      normalizedTool === "makedir"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing directory path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const dirPath = resolveSafePath(rawPath, workspacePath);
      await fs.mkdir(dirPath, { recursive: true });
      const displayPath = path.isAbsolute(rawPath) ? dirPath : path.relative(workspacePath, dirPath);
      return {
        result: `Directory created: ${displayPath || "."}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: find (aliases: find_files, glob)
    // -----------------------------------------------------------------------
    if (normalizedTool === "find" || normalizedTool === "findfiles" || normalizedTool === "glob") {
      const rawPattern = (args.pattern ?? args.query ?? args.glob ?? "").trim();
      const rawPath = extractPathArg(args);
      const searchRoot = rawPath ? resolveSafePath(rawPath, workspacePath) : workspacePath;
      const limit = typeof args.limit === "number" ? args.limit : 1000;

      if (!fsSync.existsSync(searchRoot)) {
        return {
          result: `Search directory not found: '${searchRoot}'`,
          isError: true,
        };
      }

      const results: string[] = [];
      const ignoreDirs = new Set([".git", "node_modules", "dist", ".turbo", ".next", "build", ".const"]);

      let regex: RegExp;
      if (rawPattern) {
        try {
          const escaped = rawPattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/\\\\]*")
            .replace(/\?/g, ".");
          regex = new RegExp(escaped, "i");
        } catch {
          regex = new RegExp(rawPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        }
      } else {
        regex = /.*/;
      }

      async function scan(currentDir: string, depth: number) {
        if (depth > 20 || results.length >= limit) return;
        let entries: fsSync.Dirent[];
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (results.length >= limit) break;
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(workspacePath, fullPath).replace(/\\/g, "/");

          if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
              if (regex.test(relPath) || regex.test(entry.name)) {
                results.push(`${relPath}/`);
              }
              await scan(fullPath, depth + 1);
            }
          } else {
            if (regex.test(relPath) || regex.test(entry.name)) {
              results.push(relPath);
            }
          }
        }
      }

      await scan(searchRoot, 0);

      const notice = results.length >= limit ? `\n... (capped at ${limit} results)` : "";
      return {
        result: results.length > 0 ? results.join("\n") + notice : "No matching files found.",
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: grep (aliases: grep_search, search)
    // -----------------------------------------------------------------------
    if (normalizedTool === "grep" || normalizedTool === "grepsearch" || normalizedTool === "search") {
      const pattern = (args.pattern ?? args.query ?? "").trim();
      if (!pattern) {
        return {
          result: "Error: Missing 'pattern' parameter to search for.",
          isError: true,
        };
      }

      const rawPath = extractPathArg(args);
      const searchTarget = rawPath ? resolveSafePath(rawPath, workspacePath) : workspacePath;
      const ignoreCase = Boolean(args.ignore_case ?? args.ignoreCase ?? false);
      const limit = typeof args.limit === "number" ? args.limit : 100;
      const fileGlob = typeof args.glob === "string" ? args.glob.trim() : "";

      let globRegex: RegExp | null = null;
      if (fileGlob) {
        const escaped = fileGlob
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/\\\\]*");
        globRegex = new RegExp(`^${escaped}$`, "i");
      }

      let searchRegex: RegExp;
      try {
        searchRegex = new RegExp(pattern, ignoreCase ? "gi" : "g");
      } catch {
        searchRegex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "gi" : "g");
      }

      const matches: string[] = [];
      const ignoreDirs = new Set([".git", "node_modules", "dist", ".turbo", ".next", "build", ".const"]);

      async function grepFile(filePath: string) {
        if (matches.length >= limit) return;
        try {
          const stat = await fs.stat(filePath);
          if (stat.size > 2 * 1024 * 1024) return; // Skip files > 2MB

          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split(/\r?\n/);
          const relPath = path.relative(workspacePath, filePath).replace(/\\/g, "/");

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= limit) break;
            const line = lines[i]!;
            searchRegex.lastIndex = 0;
            if (searchRegex.test(line)) {
              matches.push(`${relPath}:${i + 1}: ${line.slice(0, 300)}`);
            }
          }
        } catch {}
      }

      async function walkDir(currentDir: string, depth: number) {
        if (depth > 15 || matches.length >= limit) return;
        let entries: fsSync.Dirent[];
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (matches.length >= limit) break;
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
              await walkDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            if (!globRegex || globRegex.test(entry.name)) {
              await grepFile(fullPath);
            }
          }
        }
      }

      if (!fsSync.existsSync(searchTarget)) {
        return {
          result: `Search target not found: '${searchTarget}'`,
          isError: true,
        };
      }

      const targetStat = await fs.stat(searchTarget);
      if (targetStat.isDirectory()) {
        await walkDir(searchTarget, 0);
      } else {
        await grepFile(searchTarget);
      }

      const notice = matches.length >= limit ? `\n... (capped at ${limit} matches)` : "";
      return {
        result: matches.length > 0 ? matches.join("\n") + notice : "No matches found.",
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: powershell (aliases: pwsh)
    // -----------------------------------------------------------------------
    if (normalizedTool === "powershell" || normalizedTool === "pwsh") {
      let cmd = extractCommandArg(args);
      if (!cmd) {
        return {
          result: "Error: No command provided to execute.",
          isError: true,
        };
      }

      const shellBinary = process.platform === "win32" ? "powershell.exe" : "pwsh";
      const shellArgs = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd];
      const timeoutMs = (typeof args.timeout === "number" ? args.timeout : 60) * 1000;

      const { stdout, stderr, exitCode } = await runProcess(
        shellBinary,
        shellArgs,
        {
          cwd: workspacePath,
          signal,
          timeoutMs,
        }
      );

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      const isFailed = exitCode !== 0 && exitCode !== null;
      if (isFailed) {
        output = `[PowerShell command failed with exit code ${exitCode}]\nExit code: ${exitCode}\n${output}`.trim();
      }

      if (!output.trim()) {
        output = isFailed
          ? `[PowerShell command exited with error code ${exitCode} and produced no output]`
          : "(Command completed with no output)";
      }

      return {
        result: output.trim(),
        isError: isFailed,
      };
    }

    return {
      result: `Tool '${toolName}' is not recognized. Available tools: read, write, edit, bash, powershell, ls, find, grep, mkdir.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      result: `Error executing ${toolName}: ${err.message || String(err)}`,
      isError: true,
    };
  }
}
