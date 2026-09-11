import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import type { FileMutationRecord } from "./mutation-ledger.js";
import type { TodoItem, QuestionItem, BackgroundTaskItem } from "./types.js";

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  stepIndex?: number;
  onFileMutation?: (record: FileMutationRecord) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  askUser?: (questions: QuestionItem[]) => Promise<any>;
  onTaskStarted?: (task: BackgroundTaskItem) => void;
  onTaskStopped?: (taskId: string, code: number | null) => void;
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
    // 1. Check Git Bash in standard locations and per-user AppData
    const localAppData =
      process.env.LOCALAPPDATA ||
      (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local") : "");
    const gitBashCandidates = [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
      localAppData ? path.join(localAppData, "Programs", "Git", "bin", "bash.exe") : "",
      "C:\\Program Files\\Git\\bin\\bash.exe",
    ].filter(Boolean);

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

  // Unix / macOS: Check process.env.SHELL first, then standard paths
  const unixShells = [
    process.env.SHELL,
    "/bin/bash",
    "/usr/bin/bash",
    "/bin/zsh",
    "/usr/bin/zsh",
    "/bin/sh",
  ].filter(Boolean) as string[];

  for (const candidate of unixShells) {
    if (candidate.startsWith("/") && fsSync.existsSync(candidate)) {
      cachedShellConfig = {
        shell: candidate,
        args: ["-c"],
        type: "bash",
      };
      return cachedShellConfig;
    }
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

  // Expand home directory ~
  if (clean === "~" || clean.startsWith("~/") || clean.startsWith("~\\")) {
    const home = os.homedir();
    clean = clean === "~" ? home : path.join(home, clean.slice(2));
  }

  // Windows-specific drive conversions: only run on Windows
  if (process.platform === "win32") {
    // Convert Git Bash/MSYS2 paths: /d/Code/... or /cygdrive/c/... -> D:\Code\...
    const bashDriveMatch = clean.match(/^\/(?:mnt\/|cygdrive\/)?([a-zA-Z])(?:\/(.*))?$/);
    if (bashDriveMatch) {
      const drive = bashDriveMatch[1]!.toUpperCase();
      const rest = (bashDriveMatch[2] || "").replace(/\//g, "\\");
      return `${drive}:\\${rest}`;
    }

    // Convert bare drive with slash: d/Code/... or D/Code/... -> D:\Code\...
    // Only apply if it has subpaths indicating a drive reference rather than a single relative folder
    const bareDriveMatch = clean.match(/^([a-zA-Z])\/(.+)$/);
    if (bareDriveMatch && bareDriveMatch[2] && (bareDriveMatch[2].includes("/") || bareDriveMatch[2].includes("\\") || clean.length > 3)) {
      const drive = bareDriveMatch[1]!.toUpperCase();
      const rest = (bareDriveMatch[2] || "").replace(/\//g, "\\");
      return `${drive}:\\${rest}`;
    }
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

export function isPathWithinWorkspace(targetPath: string, workspacePath: string): boolean {
  if (!targetPath || !workspacePath) return true;
  const isCaseInsensitive = process.platform === "win32" || process.platform === "darwin";
  const normTarget = path.normalize(targetPath);
  const normWorkspace = path.normalize(workspacePath);

  const compareTarget = isCaseInsensitive ? normTarget.toLowerCase() : normTarget;
  const compareWorkspace = isCaseInsensitive ? normWorkspace.toLowerCase() : normWorkspace;

  const rel = path.relative(compareWorkspace, compareTarget);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function isAllowedInternalPath(targetPath: string): boolean {
  if (!targetPath) return false;
  const isCaseInsensitive = process.platform === "win32" || process.platform === "darwin";
  const normTarget = isCaseInsensitive ? path.normalize(targetPath).toLowerCase() : path.normalize(targetPath);
  const constHome = isCaseInsensitive ? path.join(os.homedir(), ".const").toLowerCase() : path.join(os.homedir(), ".const");

  return normTarget.startsWith(constHome);
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
  {
    type: "function",
    function: {
      name: "todo_write",
      description:
        "Update the active task checklist to track plan progress. Replace the entire list on each update. Set status as 'pending', 'in_progress', or 'completed'.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "The complete updated list of todos.",
            items: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "Concise description of the task or milestone.",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Status of this task item.",
                },
              },
              required: ["content", "status"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_question",
      description:
        "Ask the user a clarifying question when requirements or architecture options need user confirmation. Provide recommended options if available. Execution pauses until the user responds.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "Array of questions to ask the user.",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique identifier for this question.",
                },
                category: {
                  type: "string",
                  description: "Short category or topic badge (e.g. 'Tema Desain', 'Palet Warna').",
                },
                question: {
                  type: "string",
                  description: "The question text to present to the user.",
                },
                options: {
                  type: "array",
                  description:
                    "Predefined choices for the user. Place the most recommended option first with recommended: true.",
                  items: {
                    type: "object",
                    properties: {
                      label: {
                        type: "string",
                        description: "Option label.",
                      },
                      description: {
                        type: "string",
                        description: "Brief rationale or explanation for this choice.",
                      },
                      recommended: {
                        type: "boolean",
                        description: "Set true if this is the AI's top recommended choice.",
                      },
                    },
                    required: ["label"],
                  },
                },
                is_multi_select: {
                  type: "boolean",
                  description: "Whether the user can select multiple options.",
                },
              },
              required: ["question"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_patch",
      description:
        "Apply a unified diff patch (Git format) to an existing file. Ideal for precise multi-line and multi-hunk modifications.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to patch.",
          },
          patch: {
            type: "string",
            description:
              "The unified diff patch string containing @@ -start,len +start,len @@ hunk headers.",
          },
        },
        required: ["path", "patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command. Set is_daemon to true for long-running processes (like dev servers or background workers) so they run in the background without blocking.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute.",
          },
          is_daemon: {
            type: "boolean",
            description:
              "Set to true if this command starts a long-running/background process (e.g. 'node server.js', 'npm run dev') that should keep running.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds for synchronous execution.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_task",
      description:
        "Manage active background processes started by the agent. Actions: 'list' (list running tasks), 'status' (view logs and state), 'kill' (terminate a task).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "status", "kill"],
            description: "Action to perform on background tasks.",
          },
          task_id: {
            type: "string",
            description: "The task ID to inspect or terminate (required for 'status' and 'kill').",
          },
        },
        required: ["action"],
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

export function extractCommandArg(args: Record<string, any>): string {
  if (!args || typeof args !== "object") return "";
  const val =
    args.command ??
    args.cmd ??
    args.commandLine ??
    args.CommandLine ??
    args.script ??
    args.instruction ??
    args.raw ??
    args.input ??
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
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
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

export function isDevServerCommand(cmd: string): boolean {
  if (!cmd || typeof cmd !== "string") return false;
  const trimmed = cmd.trim();
  return /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|watch)|(?:vite|webpack-dev-server|next\s+dev|astro\s+dev|nuxt\s+dev|nodemon)/i.test(trimmed);
}

// ---------------------------------------------------------------------------
// Background Process Manager (Supports long-running dev servers & daemons)
// ---------------------------------------------------------------------------

export interface ActiveBackgroundTask {
  id: string;
  command: string;
  cwd: string;
  pid?: number;
  startTime: number;
  status: "running" | "completed" | "failed";
  exitCode: number | null;
  logs: string[];
  child?: ChildProcess;
}

export type BackgroundTaskListener = (event: {
  type: "output" | "status";
  taskId: string;
  data?: string;
  status?: "running" | "completed" | "failed";
  code?: number | null;
}) => void;

export class BackgroundProcessManager {
  private tasks: Map<string, ActiveBackgroundTask> = new Map();
  private listeners: Set<BackgroundTaskListener> = new Set();

  public startTask(command: string, cwd: string): ActiveBackgroundTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const shellCfg = getShellConfig();
    const child = spawn(shellCfg.shell, [...shellCfg.args, command], {
      cwd,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const task: ActiveBackgroundTask = {
      id: taskId,
      command,
      cwd,
      pid: child.pid,
      startTime: Date.now(),
      status: "running",
      exitCode: null,
      logs: [`[Process started: ${command} (PID: ${child.pid})]`],
      child,
    };

    const appendLog = (chunk: string) => {
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        if (line) {
          task.logs.push(line);
          if (task.logs.length > 5000) task.logs.shift();
          this.emit({ type: "output", taskId, data: line });
        }
      }
    };

    child.stdout?.on("data", (data) => appendLog(data.toString()));
    child.stderr?.on("data", (data) => appendLog(data.toString()));

    child.on("close", (code) => {
      task.status = code === 0 ? "completed" : "failed";
      task.exitCode = code;
      task.logs.push(`[Process exited with code ${code}]`);
      this.emit({ type: "status", taskId, status: task.status, code });
    });

    child.on("error", (err) => {
      task.status = "failed";
      task.logs.push(`[Process error: ${err.message}]`);
      this.emit({ type: "status", taskId, status: "failed" });
    });

    this.tasks.set(taskId, task);
    return task;
  }

  public listTasks(): BackgroundTaskItem[] {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      command: t.command,
      pid: t.pid,
      status: t.status,
      startTime: t.startTime,
      output: t.logs.slice(-20),
    }));
  }

  public getTask(taskId: string): ActiveBackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  public killTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status !== "running") return true;

    try {
      if (task.pid) {
        killProcessTree(task.pid);
      }
      task.status = "completed";
      task.logs.push("[Process terminated by user/AI request]");
      this.emit({ type: "status", taskId, status: "completed", code: null });
      return true;
    } catch {
      return false;
    }
  }

  public subscribe(cb: BackgroundTaskListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(event: Parameters<BackgroundTaskListener>[0]) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }
}

export const globalTaskManager = new BackgroundProcessManager();

// ---------------------------------------------------------------------------
// Unified Diff Patcher (Unified standard Git diff applicator)
// ---------------------------------------------------------------------------

export function applyUnifiedDiff(
  originalText: string,
  patchText: string
): { success: boolean; resultText?: string; error?: string } {
  const origLines = originalText.split(/\r?\n/);
  const patchLines = patchText.split(/\r?\n/);
  const eol = originalText.includes("\r\n") ? "\r\n" : "\n";

  let i = 0;
  while (i < patchLines.length && !patchLines[i]!.startsWith("@@")) {
    i++;
  }

  if (i >= patchLines.length) {
    return { success: false, error: "Malformed patch: No hunk header ('@@ -... +... @@') found." };
  }

  let workingLines = [...origLines];
  let lineOffset = 0;

  while (i < patchLines.length) {
    const headerLine = patchLines[i]!;
    if (!headerLine.startsWith("@@")) {
      i++;
      continue;
    }

    const match = headerLine.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!match) {
      return { success: false, error: `Invalid hunk header: '${headerLine}'` };
    }

    const oldStart = parseInt(match[1]!, 10);
    let origTargetIdx = oldStart - 1 + lineOffset;
    i++;

    const hunkOps: Array<{ type: " " | "-" | "+"; line: string }> = [];
    while (i < patchLines.length && !patchLines[i]!.startsWith("@@")) {
      const line = patchLines[i]!;
      if (line.startsWith("---") || line.startsWith("+++")) {
        i++;
        continue;
      }
      const marker = line[0];
      if (marker === " " || marker === "-" || marker === "+") {
        hunkOps.push({ type: marker, line: line.slice(1) });
      } else if (line.trim() === "") {
        hunkOps.push({ type: " ", line: "" });
      }
      i++;
    }

    const firstContext = hunkOps.find((op) => op.type === " " || op.type === "-");
    if (firstContext) {
      if (
        origTargetIdx < 0 ||
        origTargetIdx >= workingLines.length ||
        workingLines[origTargetIdx]?.trimEnd() !== firstContext.line.trimEnd()
      ) {
        let foundIdx = -1;
        for (let searchOffset = 1; searchOffset <= 25; searchOffset++) {
          const tryDown = origTargetIdx + searchOffset;
          if (tryDown < workingLines.length && workingLines[tryDown]?.trimEnd() === firstContext.line.trimEnd()) {
            foundIdx = tryDown;
            break;
          }
          const tryUp = origTargetIdx - searchOffset;
          if (tryUp >= 0 && workingLines[tryUp]?.trimEnd() === firstContext.line.trimEnd()) {
            foundIdx = tryUp;
            break;
          }
        }
        if (foundIdx !== -1) {
          origTargetIdx = foundIdx;
        }
      }
    }

    const newChunk: string[] = [];
    let currentIdx = Math.max(0, origTargetIdx);
    let removeCount = 0;

    for (const op of hunkOps) {
      if (op.type === " ") {
        newChunk.push(workingLines[currentIdx] ?? op.line);
        currentIdx++;
        removeCount++;
      } else if (op.type === "-") {
        currentIdx++;
        removeCount++;
      } else if (op.type === "+") {
        newChunk.push(op.line);
      }
    }

    workingLines.splice(Math.max(0, origTargetIdx), removeCount, ...newChunk);
    lineOffset += newChunk.length - removeCount;
  }

  return { success: true, resultText: workingLines.join(eol) };
}

interface RunProcessOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  isDevServer?: boolean;
  rawCommand?: string;
}

function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions
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
    let isDevServerVerified = false;
    let timer: NodeJS.Timeout | undefined;
    let drainTimer: NodeJS.Timeout | undefined;
    let devServerGraceTimer: NodeJS.Timeout | undefined;
    let devServerFallbackTimer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (drainTimer) clearTimeout(drainTimer);
      if (devServerGraceTimer) clearTimeout(devServerGraceTimer);
      if (devServerFallbackTimer) clearTimeout(devServerFallbackTimer);
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

      if (isDevServerVerified) {
        return resolve({
          stdout:
            stdout +
            `\n\n[Dev Server Verified & Stopped]: Process started successfully and verified network readiness.\n(Note: The continuous development server was stopped after verifying startup so agent task execution can proceed).`,
          stderr,
          exitCode: 0,
        });
      }

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

    if (options.isDevServer) {
      // If a dev server runs for 15s without triggering error or exit, consider it successfully initialized
      devServerFallbackTimer = setTimeout(() => {
        if (!isSettled) {
          isDevServerVerified = true;
          if (child.pid) {
            killProcessTree(child.pid);
          }
          finish(0);
        }
      }, 15000);
    }

    const onAbort = () => {
      if (child.pid) {
        killProcessTree(child.pid);
      }
      try {
        child.kill("SIGKILL");
      } catch {}
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
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const DEV_READY_REGEX = /(?:Local:\s+http|Network:\s+http|ready in \d+|compiled successfully|ready on http|Server running at|listening on (?:port|\d+)|listening at http|VITE v\d+.*ready)/i;

    child.stdout?.on("data", (chunk) => {
      const str = chunk.toString();
      stdout += str;

      if (options.isDevServer && !isDevServerVerified && DEV_READY_REGEX.test(stdout)) {
        isDevServerVerified = true;
        // Allow 1200ms to capture the rest of the startup banner
        if (!devServerGraceTimer) {
          devServerGraceTimer = setTimeout(() => {
            if (child.pid) {
              killProcessTree(child.pid);
            }
            finish(0);
          }, 1200);
        }
      }
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
      const originalEol = fileText.includes("\r\n") ? "\r\n" : "\n";
      const normalizedFileText = fileText.replace(/\r\n/g, "\n");
      const normalizedOld = oldContent.replace(/\r\n/g, "\n");

      if (normalizedFileText.includes(normalizedOld)) {
        const updated = normalizedFileText.replace(normalizedOld, newContent.replace(/\r\n/g, "\n"));
        const finalContent = originalEol === "\r\n" ? updated.replace(/\n/g, "\r\n") : updated;
        await fs.writeFile(filePath, finalContent, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: finalContent,
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
        const finalContent = originalEol === "\r\n" ? updated.replace(/\n/g, "\r\n") : updated;
        await fs.writeFile(filePath, finalContent, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: finalContent,
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

      const rawCwd = args.cwd || args.working_directory || args.workdir || args.path;
      const targetCwd = rawCwd ? resolveSafePath(rawCwd, workspacePath) : workspacePath;
      const executionCwd = fsSync.existsSync(targetCwd) && fsSync.statSync(targetCwd).isDirectory()
        ? targetCwd
        : workspacePath;

      const shellCfg = getShellConfig();

      // Check if caller explicitly requested background daemon execution
      if (args.is_daemon || args.isDaemon || args.background) {
        const bgTask = globalTaskManager.startTask(cmd, executionCwd);
        options.onTaskStarted?.({
          id: bgTask.id,
          command: bgTask.command,
          pid: bgTask.pid,
          startTime: bgTask.startTime,
          status: bgTask.status,
          output: bgTask.logs,
        });
        return {
          result: `Started background task [${bgTask.id}] (PID: ${bgTask.pid ?? "unknown"}): '${cmd}'. It is now running in the background. Use 'manage_task' to check status, view logs, or kill it.`,
          isError: false,
        };
      }

      const isBuildOrInstall = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|install|add|compile|test)|(?:tsc|cargo\s+build|dotnet\s+build)/i.test(cmd);
      const isDevServer = isDevServerCommand(cmd);
      const defaultTimeoutSec = isBuildOrInstall ? 180 : (isDevServer ? 30 : 60);
      const timeoutMs = (typeof args.timeout === "number" ? args.timeout : defaultTimeoutSec) * 1000;

      const { stdout, stderr, exitCode } = await runProcess(
        shellCfg.shell,
        [...shellCfg.args, cmd],
        {
          cwd: executionCwd,
          signal,
          timeoutMs,
          isDevServer,
          rawCommand: cmd,
        }
      );

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      const MAX_OUTPUT_CHARS = 50000;
      if (output.length > MAX_OUTPUT_CHARS) {
        const head = output.slice(0, 25000);
        const tail = output.slice(-20000);
        output = `${head}\n\n... [Output truncated: ${output.length} total characters. Showing first 25,000 and last 20,000 characters] ...\n\n${tail}`;
      }

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

      const rawCwd = args.cwd || args.working_directory || args.workdir || args.path;
      const targetCwd = rawCwd ? resolveSafePath(rawCwd, workspacePath) : workspacePath;
      const executionCwd = fsSync.existsSync(targetCwd) && fsSync.statSync(targetCwd).isDirectory()
        ? targetCwd
        : workspacePath;

      let shellBinary = process.platform === "win32" ? "powershell.exe" : "pwsh";
      let shellArgs = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd];

      // On Unix, check if pwsh is installed; fallback to system shell if absent
      if (process.platform !== "win32") {
        const hasPwsh = fsSync.existsSync("/usr/bin/pwsh") || fsSync.existsSync("/usr/local/bin/pwsh");
        if (!hasPwsh) {
          const sysShell = getShellConfig();
          shellBinary = sysShell.shell;
          shellArgs = [...sysShell.args, cmd];
        }
      }
      const isBuildOrInstall = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|install|add|compile|test)|(?:tsc|cargo\s+build|dotnet\s+build)/i.test(cmd);
      const isDevServer = isDevServerCommand(cmd);
      const defaultTimeoutSec = isBuildOrInstall ? 180 : (isDevServer ? 30 : 60);
      const timeoutMs = (typeof args.timeout === "number" ? args.timeout : defaultTimeoutSec) * 1000;

      const { stdout, stderr, exitCode } = await runProcess(
        shellBinary,
        shellArgs,
        {
          cwd: executionCwd,
          signal,
          timeoutMs,
          isDevServer,
          rawCommand: cmd,
        }
      );

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      const MAX_OUTPUT_CHARS = 50000;
      if (output.length > MAX_OUTPUT_CHARS) {
        const head = output.slice(0, 25000);
        const tail = output.slice(-20000);
        output = `${head}\n\n... [Output truncated: ${output.length} total characters. Showing first 25,000 and last 20,000 characters] ...\n\n${tail}`;
      }

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

    // -----------------------------------------------------------------------
    // Tool: todo_write (aliases: todo, todowrite)
    // -----------------------------------------------------------------------
    if (normalizedTool === "todowrite" || normalizedTool === "todo") {
      const rawTodos = args.todos ?? args.tasks ?? args.items ?? [];
      if (!Array.isArray(rawTodos)) {
        return {
          result: "Error: 'todos' parameter must be an array of todo items.",
          isError: true,
        };
      }

      const validTodos: TodoItem[] = rawTodos
        .map((t: any) => ({
          content: String(t.content ?? t.task ?? t.text ?? "").trim(),
          status:
            t.status === "completed" || t.status === "in_progress" || t.status === "pending"
              ? (t.status as "completed" | "in_progress" | "pending")
              : "pending",
        }))
        .filter((t) => t.content.length > 0);

      options.onTodoUpdate?.(validTodos);

      const pendingCount = validTodos.filter((t) => t.status === "pending").length;
      const inProgressCount = validTodos.filter((t) => t.status === "in_progress").length;
      const completedCount = validTodos.filter((t) => t.status === "completed").length;

      return {
        result: `Updated todo list: ${completedCount} completed, ${inProgressCount} in progress, ${pendingCount} pending (${validTodos.length} total).`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: ask_question (aliases: question, askuser)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "askquestion" ||
      normalizedTool === "question" ||
      normalizedTool === "askuser"
    ) {
      const rawQuestions = args.questions ?? (args.question ? [args] : []);
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        return {
          result: "Error: Missing 'questions' parameter to ask the user.",
          isError: true,
        };
      }

      const parsedQuestions: QuestionItem[] = rawQuestions
        .map((q: any, idx: number) => ({
          id: String(q.id || `q_${idx}_${Date.now()}`),
          category: q.category || q.topic || q.header || undefined,
          question: String(q.question || q.prompt || q.text || ""),
          options: Array.isArray(q.options)
            ? q.options.map((opt: any) => ({
                label: typeof opt === "string" ? opt : String(opt.label || opt.text || ""),
                description: typeof opt === "object" ? opt.description : undefined,
                recommended: typeof opt === "object" ? Boolean(opt.recommended) : false,
              }))
            : undefined,
          is_multi_select: Boolean(q.is_multi_select ?? q.multi_select ?? false),
        }))
        .filter((q) => q.question.length > 0);

      if (parsedQuestions.length === 0) {
        return {
          result: "Error: No valid questions provided.",
          isError: true,
        };
      }

      if (options.askUser) {
        try {
          const userResponse = await options.askUser(parsedQuestions);
          return {
            result:
              typeof userResponse === "string" ? userResponse : JSON.stringify(userResponse),
            isError: false,
          };
        } catch (err: any) {
          return {
            result: `Failed to receive answer from user: ${err.message || String(err)}`,
            isError: true,
          };
        }
      }

      return {
        result: "User prompt submitted: Waiting for user answer.",
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: apply_patch (aliases: patch, applypatch)
    // -----------------------------------------------------------------------
    if (normalizedTool === "applypatch" || normalizedTool === "patch") {
      const rawPath = extractPathArg(args);
      const patchContent = String(args.patch || args.diff || "").trim();

      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }

      if (!patchContent) {
        return {
          result: "Error: Missing 'patch' content to apply.",
          isError: true,
        };
      }

      const filePath = resolveSafePath(rawPath, workspacePath);
      if (!fsSync.existsSync(filePath)) {
        return {
          result: `File not found to patch: '${filePath}'`,
          isError: true,
        };
      }

      const originalContent = await fs.readFile(filePath, "utf-8");
      const { success, resultText, error } = applyUnifiedDiff(originalContent, patchContent);

      if (!success || resultText === undefined) {
        return {
          result: `[PATCH FAILED]: Could not apply patch to '${path.basename(
            filePath
          )}'. ${error || "Hunk context matching failed."}\nAction: Use 'read' tool to inspect the latest file content before generating a new patch or edit.`,
          isError: true,
        };
      }

      await fs.writeFile(filePath, resultText, "utf-8");

      const displayPath = path.isAbsolute(rawPath)
        ? filePath
        : path.relative(workspacePath, filePath);

      options.onFileMutation?.({
        id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        stepIndex: options.stepIndex ?? 0,
        operation: "modify",
        absolutePath: filePath,
        filePath: filePath,
        targetFile: displayPath || filePath,
        previousContent: originalContent,
        newContent: resultText,
        timestamp: Date.now(),
      });

      return {
        result: `Patch applied successfully to '${displayPath}'. File updated.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: manage_task (aliases: task_manager, jobs)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "managetask" ||
      normalizedTool === "taskmanager" ||
      normalizedTool === "jobs"
    ) {
      const action = String(args.action || "").toLowerCase().trim();
      const taskId = String(args.task_id || args.taskId || args.id || "").trim();

      if (action === "list") {
        const tasks = globalTaskManager.listTasks();
        if (tasks.length === 0) {
          return {
            result: "(No active or recent background tasks)",
            isError: false,
          };
        }
        const formatted = tasks
          .map(
            (t) =>
              `- Task ID: ${t.id} | Command: '${t.command}' | Status: ${t.status} | PID: ${
                t.pid ?? "unknown"
              }`
          )
          .join("\n");
        return {
          result: `Background Tasks:\n${formatted}`,
          isError: false,
        };
      }

      if (action === "status") {
        if (!taskId) {
          return {
            result: "Error: Missing 'task_id' parameter for status action.",
            isError: true,
          };
        }
        const task = globalTaskManager.getTask(taskId);
        if (!task) {
          return {
            result: `Task not found: '${taskId}'`,
            isError: true,
          };
        }
        const tailLogs = task.logs.slice(-30).join("\n");
        return {
          result: `Task '${task.id}' [${task.status}] (PID: ${
            task.pid ?? "unknown"
          }):\nCommand: ${task.command}\n\nRecent output:\n${tailLogs || "(no output yet)"}`,
          isError: false,
        };
      }

      if (action === "kill" || action === "stop") {
        if (!taskId) {
          return {
            result: "Error: Missing 'task_id' parameter for kill action.",
            isError: true,
          };
        }
        const success = globalTaskManager.killTask(taskId);
        if (success) {
          options.onTaskStopped?.(taskId, null);
          return {
            result: `Successfully stopped task '${taskId}'.`,
            isError: false,
          };
        }
        return {
          result: `Failed to stop task '${taskId}' or task was not found.`,
          isError: true,
        };
      }

      return {
        result: `Unknown action '${action}'. Available actions: list, status, kill.`,
        isError: true,
      };
    }

    return {
      result: `Tool '${toolName}' is not recognized. Available tools: read, write, edit, apply_patch, bash, run_command, manage_task, powershell, ls, find, grep, mkdir, todo_write, ask_question.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      result: `Error executing ${toolName}: ${err.message || String(err)}`,
      isError: true,
    };
  }
}
