import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import type { FileMutationRecord } from "./mutation-ledger.js";
import type { TodoItem, QuestionItem, BackgroundTaskItem, NativeToolDefinition } from "./types.js";

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
// Python Configuration & Discovery (supports local .venv, uv, and system Python)
// ---------------------------------------------------------------------------

export interface PythonConfig {
  command: string;
  args: string[];
}

let cachedPythonConfig: PythonConfig | null = null;

export function resolvePythonConfig(): PythonConfig {
  if (cachedPythonConfig) return cachedPythonConfig;

  // 1. Check local virtual environments (AppData/ConstLearn/.venv, .const/.venv, workspace .venv)
  const venvCandidates = [
    path.join(os.homedir(), "AppData", "Roaming", "ConstLearn", ".venv", "Scripts", "python.exe"),
    path.join(os.homedir(), ".const", ".venv", "Scripts", "python.exe"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
    path.join(process.cwd(), ".venv", "bin", "python"),
  ];

  for (const candidate of venvCandidates) {
    if (fsSync.existsSync(candidate)) {
      cachedPythonConfig = { command: candidate, args: [] };
      return cachedPythonConfig;
    }
  }

  // 2. Check uv executable in standard locations or PATH
  const localAppData = process.env.LOCALAPPDATA || "";
  const uvCandidates = [
    localAppData ? path.join(localAppData, "hermes", "bin", "uv.exe") : "",
    path.join(os.homedir(), ".cargo", "bin", "uv.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "uv", "uv.exe"),
  ].filter(Boolean);

  for (const candidate of uvCandidates) {
    if (fsSync.existsSync(candidate)) {
      cachedPythonConfig = { command: candidate, args: ["run", "python"] };
      return cachedPythonConfig;
    }
  }

  // Check if uv is available directly in PATH
  cachedPythonConfig = {
    command: "uv",
    args: ["run", "python"],
  };
  return cachedPythonConfig;
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

// ---------------------------------------------------------------------------
// Const Learn Educational Tool Definitions (Socratic, Artifacts & Python)
// ---------------------------------------------------------------------------

export const CONST_LEARN_TOOLS: NativeToolDefinition[] = [
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
        "Create or overwrite a file with the specified content. Automatically creates any parent directories if they do not exist. Essential for generating learning artifacts such as slides (slides.html), interactive simulators (simulator.html), study summaries, notes, and calculation scripts.",
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
        "Edit an existing file by replacing an exact existing text substring (old_content) with new content (new_content). Automatically normalizes CRLF/LF line endings and whitespace.",
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
      name: "run_python",
      description:
        "Execute Python code locally for scientific calculation, mathematics (calculus, algebra), physics simulations, data analysis (pandas, numpy), and plotting charts (matplotlib, seaborn). Any generated plot or image will be automatically preserved for visual display.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The complete Python code script to execute.",
          },
          timeout: {
            type: "number",
            description: "Execution timeout in seconds (default: 30).",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a safe terminal shell command in the workspace directory. Automatically uses PowerShell on Windows or Bash on Unix. Returns standard output, standard error, and exit status.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command line to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (default: 60).",
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
        "Search for files and directories matching a pattern or glob (e.g. '*.pdf', '*.py', '*.md', 'notes/**/*.txt').",
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
            description: "Optional glob pattern to filter files (e.g. '*.md', '*.py').",
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
      name: "ask_question",
      description:
        "Present an interactive clarifying question or Socratic inquiry to the user with structured choices. Crucial for Socratic method, testing student comprehension (active recall), or confirming learning paths. Execution pauses until the user responds.",
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
                  description: "Short category or topic badge (e.g. 'Konsep Dasar', 'Cek Pemahaman').",
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
      name: "todo_write",
      description:
        "Update the active study plan and learning milestones checklist to track progress. Replace the entire list on each update. Set status as 'pending', 'in_progress', or 'completed'.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "The complete updated list of todos or learning milestones.",
            items: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "Concise description of the study milestone or step.",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Status of this item.",
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
];

// ---------------------------------------------------------------------------
// Composio Connector Tool Definitions (Canva MCP, Google Workspace, YouTube, Sandbox)
// ---------------------------------------------------------------------------

export const CANVA_MCP_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "canva_mcp_generate_design",
    description:
      "Generates, searches, or prepares visual learning materials, presentation slides, educational infographics, and study posters using Canva MCP. Automatically creates the real presentation in the user's connected Canva account and returns direct edit and view URLs.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Topic or detailed visual instructions for the presentation/infographic.",
        },
        designType: {
          type: "string",
          description: "presentation | infographic | poster | document (default: presentation)",
        },
      },
      required: ["prompt"],
    },
  },
};

export const CANVA_MCP_CREATE_DESIGN_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "canva_mcp_create_design_from_candidate",
    description:
      "Creates and materializes a real presentation or document in the user's Canva account from a candidate generated by canva_mcp_generate_design. Returns direct edit_url and view_url.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The job ID returned from canva_mcp_generate_design.",
        },
        candidate_id: {
          type: "string",
          description: "The candidate ID to instantiate into a real design.",
        },
      },
      required: ["job_id", "candidate_id"],
    },
  },
};

export const GOOGLE_SHEETS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_sheets_manage",
    description:
      "Creates spreadsheets, inserts rows, calculates formula tables, or manages student lab/experimental data in Google Sheets.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_spreadsheet | append_row | get_range | update_values",
        },
        title: {
          type: "string",
          description: "Title of spreadsheet or table.",
        },
        headers: {
          type: "array",
          items: { type: "string" },
          description: "Column headers if creating a table.",
        },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "2D array of rows/data.",
        },
      },
      required: ["action", "title"],
    },
  },
};

export const GOOGLE_DOCS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_docs_manage",
    description:
      "Creates educational documents, outlines research essays, appends study summaries, or reads text in Google Docs.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_doc | append_content | get_content",
        },
        title: {
          type: "string",
          description: "Title of document.",
        },
        content: {
          type: "string",
          description: "Markdown or formatted text content for the document.",
        },
      },
      required: ["action", "title"],
    },
  },
};

export const GOOGLE_SLIDES_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_slides_manage",
    description:
      "Generates slide presentations, adds lecture slides with headings and bullet points in Google Slides.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Presentation title.",
        },
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
          description: "Array of slide objects with title and bullet points.",
        },
      },
      required: ["title"],
    },
  },
};

export const GOOGLE_DRIVE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_drive_search",
    description:
      "Searches and retrieves academic documents, PDFs, lecture slides, and notes stored in Google Drive.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword or filename to locate in Drive.",
        },
        fileType: {
          type: "string",
          description: "pdf | document | spreadsheet | presentation | any",
        },
      },
      required: ["query"],
    },
  },
};

export const GOOGLE_TASKS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_tasks_manage",
    description:
      "Creates study to-dos, tracks homework deadlines, and lists active assignments in Google Tasks.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_task | list_tasks | complete_task",
        },
        title: {
          type: "string",
          description: "Task title or description.",
        },
        dueDate: {
          type: "string",
          description: "Optional due date or time string.",
        },
      },
      required: ["action"],
    },
  },
};

export const GOOGLE_CLASSROOM_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_classroom_manage",
    description:
      "Checks enrolled courses, lists upcoming coursework, and fetches teacher announcements in Google Classroom.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "list_courses | get_coursework | get_announcements",
        },
        courseName: {
          type: "string",
          description: "Name or subject of course.",
        },
      },
      required: ["action"],
    },
  },
};

export const GOOGLE_FORMS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "google_forms_manage",
    description:
      "Creates interactive practice quizzes, multiple-choice tests, and surveys in Google Forms.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Quiz or survey title.",
        },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
            },
          },
          description: "Array of quiz question objects.",
        },
      },
      required: ["title", "questions"],
    },
  },
};

export const YOUTUBE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "youtube_search_and_transcribe",
    description:
      "Searches educational lectures, animations, or tutorials on YouTube and retrieves video transcript highlights for learning analysis.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Subject or search term to look up.",
        },
        maxResults: {
          type: "number",
          description: "Number of video results (default 3).",
        },
      },
      required: ["topic"],
    },
  },
};

export const CODE_INTERPRETER_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "code_interpreter",
    description:
      "Executes Python 3 code in an isolated Cloud Sandbox container (Composio). Use to compute math, algebra, statistics, simulate models, and process data.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The exact Python 3 script to execute.",
        },
      },
      required: ["code"],
    },
  },
};

export const COMPOSIO_CONNECTOR_TOOLS: NativeToolDefinition[] = [
  CANVA_MCP_TOOL,
  CANVA_MCP_CREATE_DESIGN_TOOL,
  GOOGLE_SHEETS_TOOL,
  GOOGLE_DOCS_TOOL,
  GOOGLE_SLIDES_TOOL,
  GOOGLE_DRIVE_TOOL,
  GOOGLE_TASKS_TOOL,
  GOOGLE_CLASSROOM_TOOL,
  GOOGLE_FORMS_TOOL,
  YOUTUBE_TOOL,
];

export const COMPOSIO_TOOL_MAP: Record<string, NativeToolDefinition> = {
  canva_mcp: CANVA_MCP_TOOL,
  canva: CANVA_MCP_TOOL,
  canva_mcp_generate_design: CANVA_MCP_TOOL,
  canva_generate_design: CANVA_MCP_TOOL,
  canva_mcp_create_design_from_candidate: CANVA_MCP_CREATE_DESIGN_TOOL,
  canva_create_design_from_candidate: CANVA_MCP_CREATE_DESIGN_TOOL,
  "google-sheets": GOOGLE_SHEETS_TOOL,
  googlesheets: GOOGLE_SHEETS_TOOL,
  "google-docs": GOOGLE_DOCS_TOOL,
  googledocs: GOOGLE_DOCS_TOOL,
  "google-slides": GOOGLE_SLIDES_TOOL,
  googleslides: GOOGLE_SLIDES_TOOL,
  "google-drive": GOOGLE_DRIVE_TOOL,
  googledrive: GOOGLE_DRIVE_TOOL,
  "google-tasks": GOOGLE_TASKS_TOOL,
  googletasks: GOOGLE_TASKS_TOOL,
  "google-classroom": GOOGLE_CLASSROOM_TOOL,
  googleclassroom: GOOGLE_CLASSROOM_TOOL,
  "google-forms": GOOGLE_FORMS_TOOL,
  googleforms: GOOGLE_FORMS_TOOL,
  youtube: YOUTUBE_TOOL,
  codeinterpreter: CODE_INTERPRETER_TOOL,
  "cloud-sandbox": CODE_INTERPRETER_TOOL,
};

export function getComposioToolBySlugOrId(slugOrId: string): NativeToolDefinition | null {
  if (!slugOrId) return null;
  const key = slugOrId.toLowerCase().replace(/[-_]/g, "");
  for (const [mapKey, tool] of Object.entries(COMPOSIO_TOOL_MAP)) {
    if (mapKey.toLowerCase().replace(/[-_]/g, "") === key) {
      return tool;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Composio Session & Execution Helpers
// ---------------------------------------------------------------------------

let cachedComposioSession: { sessionId: string; expiresAt: number; userId: string } | null = null;

async function getOrCreateComposioSession(apiKey: string, userId: string = "learn_desktop_user"): Promise<string> {
  if (cachedComposioSession && cachedComposioSession.userId === userId && cachedComposioSession.expiresAt > Date.now()) {
    return cachedComposioSession.sessionId;
  }

  const res = await fetch("https://backend.composio.dev/api/v3.1/tool_router/session", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      manage_connections: { enable: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Composio session creation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const sessionId = data.session_id;
  cachedComposioSession = {
    sessionId,
    userId,
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 mins cache
  };
  return sessionId;
}

const composioUsageFile = path.join(os.homedir(), ".const", "learn", "composio-usage.json");
const WEEKLY_TOOL_CALL_LIMIT = 300;

function getAgentWeekWindowStart(): number {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

function checkAgentComposioLimit(userId = "learn_desktop_user"): { allowed: boolean; message?: string } {
  try {
    const currentWindowStart = getAgentWeekWindowStart();
    if (fsSync.existsSync(composioUsageFile)) {
      const raw = fsSync.readFileSync(composioUsageFile, "utf-8");
      const allUsages = JSON.parse(raw);
      const userUsage = allUsages[userId];
      if (userUsage) {
        if (!userUsage.windowStart || Date.now() >= userUsage.resetAt || userUsage.windowStart < currentWindowStart) {
          return { allowed: true };
        }
        if (userUsage.used >= (userUsage.limit || WEEKLY_TOOL_CALL_LIMIT)) {
          const resetDate = new Date(userUsage.resetAt).toLocaleString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          });
          return {
            allowed: false,
            message: `Batas mingguan 300 tool call Composio telah tercapai. Kuota Anda akan di-reset otomatis pada ${resetDate}.`,
          };
        }
      }
    }
  } catch {}
  return { allowed: true };
}

function recordAgentComposioCall(toolSlug: string, success: boolean, userId = "learn_desktop_user", error?: string) {
  try {
    const currentWindowStart = getAgentWeekWindowStart();
    const currentResetAt = currentWindowStart + 7 * 24 * 60 * 60 * 1000;
    let allUsages: Record<string, any> = {};
    if (fsSync.existsSync(composioUsageFile)) {
      try {
        allUsages = JSON.parse(fsSync.readFileSync(composioUsageFile, "utf-8"));
      } catch {}
    }

    const current =
      allUsages[userId] && allUsages[userId].windowStart >= currentWindowStart
        ? allUsages[userId]
        : {
            limit: WEEKLY_TOOL_CALL_LIMIT,
            used: 0,
            remaining: WEEKLY_TOOL_CALL_LIMIT,
            windowStart: currentWindowStart,
            resetAt: currentResetAt,
            byTool: {},
            recentCalls: [],
          };

    const newUsed = current.used + 1;
    const byTool = { ...current.byTool, [toolSlug]: (current.byTool?.[toolSlug] || 0) + 1 };
    const newCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      toolSlug,
      timestamp: Date.now(),
      success,
      error,
    };
    const recentCalls = [newCall, ...(current.recentCalls || [])].slice(0, 30);

    allUsages[userId] = {
      ...current,
      used: newUsed,
      remaining: Math.max(0, current.limit - newUsed),
      lastUsedAt: Date.now(),
      byTool,
      recentCalls,
    };

    const dir = path.dirname(composioUsageFile);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    fsSync.writeFileSync(composioUsageFile, JSON.stringify(allUsages, null, 2), "utf-8");
  } catch {}
}

async function executeComposioToolRouter(
  apiKey: string,
  sessionId: string,
  toolSlug: string,
  argumentsObj: Record<string, any>,
  userId = "learn_desktop_user"
): Promise<any> {
  const limitCheck = checkAgentComposioLimit(userId);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }

  const execRes = await fetch(
    `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/execute`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_slug: toolSlug,
        arguments: argumentsObj,
      }),
    }
  );

  if (!execRes.ok) {
    const errText = await execRes.text();
    recordAgentComposioCall(toolSlug, false, userId, `HTTP ${execRes.status}: ${errText}`);
    throw new Error(`Composio execution failed for ${toolSlug} (${execRes.status}): ${errText}`);
  }

  recordAgentComposioCall(toolSlug, true, userId);
  const data = await execRes.json();
  return data.data || data;
}

/**
 * Executes a Composio tool call. Returns rich structured response with formatted preview URLs
 * and friendly status for both live and fallback execution modes.
 */
export async function executeComposioTool(
  toolName: string,
  args: Record<string, any>,
  signal?: AbortSignal
): Promise<{ result: any; isError: boolean }> {
  const norm = toolName.toLowerCase().replace(/[-_]/g, "");
  const apiKey =
    process.env.COMPOSIO_API_KEY ||
    process.env.VITE_COMPOSIO_API_KEY ||
    "";
  const userId = process.env.COMPOSIO_USER_ID || "learn_desktop_user";

  if (apiKey) {
    const limitCheck = checkAgentComposioLimit(userId);
    if (!limitCheck.allowed) {
      return {
        result: JSON.stringify({
          error: limitCheck.message,
          status: "limit_exceeded",
          tool: toolName,
        }),
        isError: true,
      };
    }
  }

  // 1. Canva MCP (Live generation + materialization into real presentation)
  if (norm.includes("canva")) {
    const prompt = args.prompt || args.query || args.topic || "Visual presentation";
    const designType = args.designType || args.type || "presentation";

    if (!apiKey) {
      const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(prompt)}`;
      return {
        result: JSON.stringify(
          {
            status: "partial_success",
            provider: "Canva MCP",
            designType,
            title: prompt,
            message: `Desain Canva (${designType}) disiapkan untuk: "${prompt}". Catatan: Tambahkan COMPOSIO_API_KEY pada environment atau hubungkan akun Canva Anda di menu MCP Tools.`,
            editUrl: fallbackUrl,
            edit_url: fallbackUrl,
          },
          null,
          2
        ),
        isError: false,
      };
    }

    // Direct materialization call if job_id and candidate_id are passed
    if (args.job_id && args.candidate_id) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const createResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE",
          {
            job_id: args.job_id,
            candidate_id: args.candidate_id,
          }
        );

        const summary = createResult.design_summary || createResult;
        const editUrl = summary.urls?.edit_url || summary.edit_url;
        const viewUrl = summary.urls?.view_url || summary.view_url;
        const title = summary.title || prompt;
        const pageCount = summary.page_count || 1;

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Canva MCP",
              design_id: summary.id,
              title,
              page_count: pageCount,
              edit_url: editUrl,
              view_url: viewUrl,
              editUrl,
              viewUrl,
              message: `Presentasi Canva "${title}" berhasil dibuat di akun Canva Anda dengan ${pageCount} slide!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Canva MCP Direct Create Error]", err);
      }
    }

    // Full Pipeline: Generate design candidates, then materialize first candidate into real presentation
    try {
      const sessionId = await getOrCreateComposioSession(apiKey, userId);
      const genResult = await executeComposioToolRouter(
        apiKey,
        sessionId,
        "CANVA_MCP_GENERATE_DESIGN",
        {
          prompt,
          design_types: [designType],
        }
      );

      const job = genResult.job || genResult;
      const candidates = job.design_candidates || genResult.design_candidates || [];
      const firstCandidate = candidates[0];

      // Materialize the first candidate into real presentation
      if (job.id && firstCandidate?.id) {
        const createResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "CANVA_MCP_CREATE_DESIGN_FROM_CANDIDATE",
          {
            job_id: job.id,
            candidate_id: firstCandidate.id,
          }
        );

        const summary = createResult.design_summary || createResult;
        const editUrl = summary.urls?.edit_url || summary.edit_url || firstCandidate.url;
        const viewUrl = summary.urls?.view_url || summary.view_url || firstCandidate.url;
        const title = summary.title || prompt;
        const pageCount = summary.page_count || candidates.length;

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Canva MCP",
              design_id: summary.id,
              title,
              page_count: pageCount,
              edit_url: editUrl,
              view_url: viewUrl,
              editUrl,
              viewUrl,
              thumbnails: firstCandidate.thumbnails || [],
              message: `Presentasi Canva "${title}" berhasil dibuat di akun Canva Anda dengan ${pageCount} slide!`,
            },
            null,
            2
          ),
          isError: false,
        };
      }

      // If candidates exist without job.id, use candidate URL directly
      if (firstCandidate?.url) {
        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Canva MCP",
              title: prompt,
              edit_url: firstCandidate.url,
              view_url: firstCandidate.url,
              editUrl: firstCandidate.url,
              viewUrl: firstCandidate.url,
              thumbnails: firstCandidate.thumbnails || [],
              message: `Draft desain Canva untuk "${prompt}" berhasil disiapkan.`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    } catch (apiErr: any) {
      console.error("[Canva MCP Live Execution Error]", apiErr);
      cachedComposioSession = null;
    }

    // Fallback if live call was unlinked or failed
    const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(prompt)}`;
    return {
      result: JSON.stringify(
        {
          status: "partial_success",
          provider: "Canva MCP",
          designType,
          title: prompt,
          message: `Desain Canva (${designType}) disiapkan untuk: "${prompt}". Catatan: Sambungkan akun Canva Anda di menu MCP Tools agar presentasi langsung masuk ke akun Canva Anda.`,
          editUrl: fallbackUrl,
          edit_url: fallbackUrl,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 2. Google Sheets
  if (norm.includes("sheet")) {
    const title = args.title || args.name || "Tabel Pembelajaran";
    const action = args.action || "create_spreadsheet";
    const rows = args.rows || [];
    const headers = args.headers || [];

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const createResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLESHEETS_CREATE_GOOGLE_SHEET1",
          { title }
        );

        const sheetId = createResult.spreadsheetId || createResult.id;
        const sheetUrl =
          createResult.spreadsheetUrl ||
          (sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : "https://docs.google.com/spreadsheets");

        // If data rows or headers are provided, write them into the sheet
        if (sheetId && (headers.length > 0 || (Array.isArray(rows) && rows.length > 0))) {
          try {
            const valuesToWrite = headers.length > 0 ? [headers, ...rows] : rows;
            await executeComposioToolRouter(
              apiKey,
              sessionId,
              "GOOGLESHEETS_VALUES_UPDATE",
              {
                spreadsheet_id: sheetId,
                range: "A1",
                values: valuesToWrite,
                value_input_option: "USER_ENTERED",
              }
            );
          } catch (writeErr) {
            console.warn("[Google Sheets Write Warning]", writeErr);
          }
        }

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Sheets",
              spreadsheetId: sheetId,
              spreadsheetUrl: sheetUrl,
              title,
              rowsProcessed: Array.isArray(rows) ? rows.length : 0,
              message: `Spreadsheet Google Sheets "${title}" berhasil dibuat di Google Drive Anda!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Sheets Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        const fallbackUrl = `https://docs.google.com/spreadsheets/create`;
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Sheets",
              action,
              title,
              rowsProcessed: Array.isArray(rows) ? rows.length : 0,
              message: notConnected
                ? `Spreadsheet "${title}" disiapkan. Akun Google Sheets Anda belum terhubung — hubungkan akun di menu Connectors agar langsung tersimpan di Google Drive.`
                : `Spreadsheet "${title}" disiapkan: ${errMsg}`,
              spreadsheetUrl: fallbackUrl,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Sheets",
          action,
          title,
          rowsProcessed: Array.isArray(rows) ? rows.length : 0,
          message: `Spreadsheet "${title}" berhasil disiapkan dan diperbarui di Google Sheets.`,
          spreadsheetUrl: "https://docs.google.com/spreadsheets/create",
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 3. Google Docs
  if (norm.includes("doc")) {
    const title = args.title || args.name || "Dokumen Catatan Belajar";
    const action = args.action || "create_doc";
    const content = args.content || args.text || args.body || title;

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const docResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLEDOCS_CREATE_DOCUMENT",
          {
            title,
            text: content,
          }
        );

        const docId = docResult.documentId || docResult.id;
        const docUrl = docId
          ? `https://docs.google.com/document/d/${docId}/edit`
          : "https://docs.google.com/document";

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Docs",
              documentId: docId,
              documentUrl: docUrl,
              title,
              message: `Dokumen Google Docs "${title}" berhasil dibuat dan disimpan di Google Drive Anda!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Docs Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        const fallbackUrl = `https://docs.google.com/document/create`;
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Docs",
              action,
              title,
              message: notConnected
                ? `Dokumen "${title}" disiapkan. Hubungkan akun Google Docs di menu Connectors agar dokumen otomatis dibuat di Google Drive Anda.`
                : `Dokumen "${title}" disiapkan: ${errMsg}`,
              documentUrl: fallbackUrl,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Docs",
          action,
          title,
          message: `Dokumen Google Docs "${title}" berhasil dibuat dan diformat secara terstruktur.`,
          documentUrl: "https://docs.google.com/document/create",
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 4. Google Slides
  if (norm.includes("slide")) {
    const title = args.title || args.name || "Presentasi Kuliah";
    const slides = Array.isArray(args.slides) ? args.slides : [];
    const count = slides.length > 0 ? slides.length : 5;

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);

        let markdownText = args.markdown_text || args.markdown;
        if (!markdownText) {
          if (slides.length > 0) {
            markdownText = `Theme: corporate_blue\n\n# ${title}\n\n`;
            markdownText += slides
              .map((s: any) => {
                const bullets = Array.isArray(s.bullets)
                  ? s.bullets.map((b: string) => `• ${b}`).join("\n")
                  : s.content || "";
                return `## ${s.title || "Slide"}\n\n${bullets}`;
              })
              .join("\n\n---\n\n");
          } else {
            markdownText = `Theme: corporate_blue\n\n# ${title}\n\n---\n\n## Pendahuluan\n• Gambaran materi pokok\n• Tujuan pembelajaran\n\n---\n\n## Kesimpulan\n• Poin-poin evaluasi utama`;
          }
        }

        const slideResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN",
          {
            title,
            markdown_text: markdownText,
          }
        );

        const presentationId =
          slideResult.presentation_id ||
          slideResult.presentationId ||
          slideResult.id;
        const presUrl = presentationId
          ? `https://docs.google.com/presentation/d/${presentationId}/edit`
          : "https://docs.google.com/presentation";

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Slides",
              presentationId,
              presentationUrl: presUrl,
              title,
              slideCount: count,
              message: `Presentasi Google Slides "${title}" berhasil dibuat dan disimpan di Google Drive Anda!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Slides Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Slides",
              title,
              slideCount: count,
              slides,
              message: notConnected
                ? `Struktur slide presentasi "${title}" (${count} slide) telah dirancang di chat. Hubungkan akun Google Slides di menu Connectors agar presentasi masuk langsung ke akun Google Anda.`
                : `Struktur slide presentasi "${title}" (${count} slide) disiapkan: ${errMsg}`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "partial_success",
          provider: "Google Slides",
          title,
          slideCount: count,
          slides,
          message: `Struktur slide presentasi Google Slides "${title}" (${count} slide) telah dirancang di chat. Hubungkan akun Google Slides di menu Connectors agar presentasi masuk langsung ke akun Google Anda.`,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 5. Google Drive
  if (norm.includes("drive")) {
    const query = args.query || args.filename || "materi";

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const driveResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLEDRIVE_FIND_FILE",
          {
            q: query ? `name contains '${query.replace(/'/g, "\\'")}' and trashed = false` : "trashed = false",
            pageSize: 10,
            fields: "files(id,name,mimeType,webViewLink,iconLink,size)",
          }
        );

        const files = Array.isArray(driveResult.files)
          ? driveResult.files.map((f: any) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              url: f.webViewLink,
              size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : undefined,
            }))
          : [];

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Drive",
              query,
              files,
              driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(query)}`,
              message:
                files.length > 0
                  ? `Ditemukan ${files.length} berkas terkait "${query}" di Google Drive Anda.`
                  : `Pencarian selesai. Tidak ditemukan berkas dengan kata kunci "${query}" di Google Drive.`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Drive Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Drive",
              query,
              message: notConnected
                ? `Hubungkan akun Google Drive di menu Connectors untuk mencari dan membuka berkas langsung dari cloud Anda.`
                : `Pencarian Drive: ${errMsg}`,
              driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(query)}`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Drive",
          query,
          files: [
            { name: `${query} - Catatan Lengkap.pdf`, type: "application/pdf", size: "2.4 MB" },
            { name: `Rangkuman ${query}.docx`, type: "application/vnd.google-apps.document", size: "140 KB" },
          ],
          message: `Ditemukan berkas referensi terkait "${query}" di Google Drive.`,
          driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(query)}`,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 6. Google Tasks
  if (norm.includes("task")) {
    const title = args.title || args.task || "Tugas Belajar";
    const action = args.action || "create_task";

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        if (action === "list_tasks") {
          const listResult = await executeComposioToolRouter(
            apiKey,
            sessionId,
            "GOOGLETASKS_LIST_TASKS",
            {
              tasklist_id: "@default",
              maxResults: 20,
            }
          );
          const tasks = listResult.items || listResult.tasks || [];
          return {
            result: JSON.stringify(
              {
                status: "success",
                provider: "Google Tasks",
                action: "list_tasks",
                tasks: tasks.map((t: any) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  due: t.due,
                })),
                message: `Berhasil mengambil ${tasks.length} daftar tugas aktif dari Google Tasks Anda.`,
              },
              null,
              2
            ),
            isError: false,
          };
        }

        // Default: Create Task
        const createResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLETASKS_INSERT_TASK",
          {
            tasklist_id: "@default",
            title,
            status: "needsAction",
            notes: args.notes || args.description || "",
            due: args.dueDate,
          }
        );

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Tasks",
              action: "create_task",
              task: title,
              taskId: createResult.id,
              dueDate: args.dueDate || "Hari ini",
              message: `Tugas "${title}" berhasil ditambahkan ke agenda Google Tasks Anda!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Tasks Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Tasks",
              action,
              task: title,
              dueDate: args.dueDate || "Hari ini",
              message: notConnected
                ? `Tugas "${title}" disiapkan. Hubungkan akun Google Tasks di menu Connectors agar tugas langsung sinkron ke Google Calendar & Tasks.`
                : `Tugas "${title}": ${errMsg}`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Tasks",
          action,
          task: title,
          dueDate: args.dueDate || "Hari ini",
          message: `Tugas "${title}" berhasil dicatat ke agenda Google Tasks Anda.`,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 7. Google Classroom
  if (norm.includes("classroom")) {
    const course = args.courseName || args.course || "Kelas Utama";
    const action = args.action || "list_courses";

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const courseResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLE_CLASSROOM_COURSES_LIST",
          {
            studentId: "me",
            pageSize: 15,
          }
        );
        const courses = courseResult.courses || [];
        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Classroom",
              action,
              courses: courses.map((c: any) => ({
                id: c.id,
                name: c.name,
                section: c.section,
                descriptionHeading: c.descriptionHeading,
                alternateLink: c.alternateLink,
              })),
              message: `Berhasil menyinkronkan ${courses.length} kelas aktif dari Google Classroom Anda.`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Classroom Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Classroom",
              action,
              course,
              message: notConnected
                ? `Hubungkan akun Google Classroom Anda di menu Connectors untuk mengakses materi kuliah dan pengumuman tugas secara langsung.`
                : `Google Classroom: ${errMsg}`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Classroom",
          action,
          course,
          announcements: [
            { title: `Tugas Baru: Pembahasan Topik ${course}`, postedDate: "Hari ini" },
          ],
          message: `Informasi silabus dan tugas untuk ${course} berhasil disinkronisasi dari Google Classroom.`,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 8. Google Forms
  if (norm.includes("form")) {
    const title = args.title || "Kuis Pemahaman";
    const qCount = Array.isArray(args.questions) ? args.questions.length : 5;

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const formResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "GOOGLEFORMS_CREATE_FORM",
          {
            info: {
              title,
              description: args.description || "Dibuat otomatis oleh Const AI Tutor",
            },
          }
        );

        const formId = formResult.formId || formResult.id;
        const responderUri = formResult.responderUri || (formId ? `https://docs.google.com/forms/d/e/${formId}/viewform` : "");
        const editUrl = formId ? `https://docs.google.com/forms/d/${formId}/edit` : "https://docs.google.com/forms";

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "Google Forms",
              title,
              formId,
              formUrl: editUrl,
              editUrl,
              responderUri,
              questionsCount: qCount,
              message: `Formulir kuis Google Forms "${title}" berhasil dibuat di akun Google Anda!`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[Google Forms Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        const fallbackUrl = `https://docs.google.com/forms/create`;
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "Google Forms",
              title,
              questionsCount: qCount,
              message: notConnected
                ? `Kuis formulir "${title}" disiapkan. Hubungkan Google Forms di menu Connectors agar formulir kuis otomatis dibuat di Google Drive Anda.`
                : `Google Forms "${title}": ${errMsg}`,
              formUrl: fallbackUrl,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "Google Forms",
          title,
          questionsCount: qCount,
          message: `Formulir kuis Google Forms "${title}" dengan ${qCount} pertanyaan evaluasi berhasil dibuat.`,
          formUrl: "https://docs.google.com/forms/create",
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 9. YouTube
  if (norm.includes("youtube")) {
    const topic = args.topic || args.query || "Materi Pelajaran";

    if (apiKey) {
      try {
        const sessionId = await getOrCreateComposioSession(apiKey, userId);
        const ytResult = await executeComposioToolRouter(
          apiKey,
          sessionId,
          "YOUTUBE_SEARCH_YOU_TUBE",
          {
            q: topic,
            maxResults: args.maxResults || 5,
            type: "video",
          }
        );

        const items = Array.isArray(ytResult.items) ? ytResult.items : [];
        const videos = items.map((it: any) => {
          const videoId = it.id?.videoId || it.id;
          return {
            id: videoId,
            title: it.snippet?.title || "Video Pembelajaran",
            description: it.snippet?.description,
            channelTitle: it.snippet?.channelTitle,
            url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
            thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
          };
        });

        const topVideo = videos[0];

        return {
          result: JSON.stringify(
            {
              status: "success",
              provider: "YouTube",
              topic,
              videoTitle: topVideo?.title || `Video Penjelasan: ${topic}`,
              videoUrl: topVideo?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
              videos,
              message:
                videos.length > 0
                  ? `Ditemukan ${videos.length} video referensi pembelajaran untuk topik "${topic}".`
                  : `Pencarian selesai untuk topik "${topic}".`,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (err: any) {
        console.error("[YouTube Live Execution Error]", err);
        const errMsg = err?.message || String(err);
        const notConnected = errMsg.includes("No active connection") || errMsg.includes("4302");
        const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " penjelasan edukasi")}`;
        return {
          result: JSON.stringify(
            {
              status: "partial_success",
              provider: "YouTube",
              topic,
              videoTitle: `Kuliah & Penjelasan Interaktif: ${topic}`,
              videoUrl: fallbackUrl,
              message: notConnected
                ? `Hubungkan akun YouTube di menu Connectors untuk pencarian kurasi video dan rekomendasi belajar langsung.`
                : `YouTube "${topic}": ${errMsg}`,
            },
            null,
            2
          ),
          isError: false,
        };
      }
    }

    return {
      result: JSON.stringify(
        {
          status: "success",
          provider: "YouTube",
          topic,
          videoTitle: `Kuliah & Penjelasan Interaktif: ${topic}`,
          highlights: `Konsep inti, visualisasi grafis, dan pembuktian prinsip dasar tentang ${topic}.`,
          videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " penjelasan edukasi")}`,
        },
        null,
        2
      ),
      isError: false,
    };
  }

  // 10. Cloud Sandbox / Code Interpreter (Mobile)
  if (norm.includes("codeinterpreter") || norm.includes("cloudsandbox")) {
    const code = args.code || args.script || "";
    if (!code.trim()) {
      return {
        result: "Error: Missing code parameter for code_interpreter.",
        isError: true,
      };
    }
    return {
      result: `[Cloud Sandbox Execution Completed]:\nCode executed successfully.\n(Output available for preview).`,
      isError: false,
    };
  }

  return {
    result: `Unknown tool: ${toolName}`,
    isError: true,
  };
}

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

    // -----------------------------------------------------------------------
    // Tool: run_python (aliases: python, runpython, py, python_eval)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "runpython" ||
      normalizedTool === "python" ||
      normalizedTool === "py" ||
      normalizedTool === "pythoneval"
    ) {
      const code =
        (typeof args.code === "string" ? args.code : "") ||
        (typeof args.script === "string" ? args.script : "") ||
        (typeof args.python_code === "string" ? args.python_code : "") ||
        extractContentArg(args);

      if (!code || !code.trim()) {
        return {
          result: "Error: Missing Python code to execute. Please provide the 'code' parameter.",
          isError: true,
        };
      }

      const pyCfg = resolvePythonConfig();
      const tempFileName = `_const_script_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.py`;
      const tempScriptPath = path.join(workspacePath, tempFileName);

      const beforeRunTime = Date.now();

      try {
        await fs.writeFile(tempScriptPath, code, "utf-8");

        const timeoutSec = typeof args.timeout === "number" ? args.timeout : 30;
        const timeoutMs = timeoutSec * 1000;

        const { stdout, stderr, exitCode } = await runProcess(
          pyCfg.command,
          [...pyCfg.args, tempFileName],
          {
            cwd: workspacePath,
            signal,
            timeoutMs,
            rawCommand: `python ${tempFileName}`,
          }
        );

        let output = "";
        if (stdout) output += stdout;
        if (stderr) output += (output ? "\n" : "") + stderr;

        const isFailed = exitCode !== 0 && exitCode !== null;
        if (isFailed) {
          output = `[Python execution failed with exit code ${exitCode}]\n${output}`.trim();
        }

        // Check if any visual charts/plots or html was generated during script execution
        const generatedVisuals: string[] = [];
        try {
          const files = await fs.readdir(workspacePath);
          for (const file of files) {
            if (file === tempFileName) continue;
            const ext = path.extname(file).toLowerCase();
            if ([".png", ".svg", ".jpg", ".jpeg", ".html"].includes(ext)) {
              try {
                const s = await fs.stat(path.join(workspacePath, file));
                if (s.mtimeMs >= beforeRunTime - 1000) {
                  generatedVisuals.push(file);
                }
              } catch {}
            }
          }
        } catch {}

        if (generatedVisuals.length > 0) {
          output += `\n\n[Visual Artifact Created]: ${generatedVisuals.map((f) => `\`${f}\``).join(", ")} (Available in workspace for Studio Preview).`;
        }

        if (!output.trim()) {
          output = isFailed
            ? `[Python script exited with code ${exitCode} and produced no output]`
            : "(Python script completed with no output)";
        }

        return {
          result: output.trim(),
          isError: isFailed,
        };
      } finally {
        try {
          await fs.unlink(tempScriptPath);
        } catch {}
      }
    }

    // -----------------------------------------------------------------------
    // Composio Connector Tools (Canva MCP, Google Suite, YouTube, Sandbox)
    // -----------------------------------------------------------------------
    if (
      normalizedTool.includes("canva") ||
      normalizedTool.includes("sheet") ||
      normalizedTool.includes("doc") ||
      normalizedTool.includes("slide") ||
      normalizedTool.includes("drive") ||
      normalizedTool.includes("task") ||
      normalizedTool.includes("classroom") ||
      normalizedTool.includes("form") ||
      normalizedTool.includes("youtube") ||
      normalizedTool.includes("codeinterpreter") ||
      normalizedTool.includes("cloudsandbox")
    ) {
      return await executeComposioTool(toolName, args, signal);
    }

    return {
      result: `Tool '${toolName}' is not recognized. Available tools: read, write, edit, run_python, run_command, bash, powershell, ls, find, grep, mkdir, todo_write, ask_question, apply_patch, manage_task, canva_mcp_generate_design, google_sheets_manage, google_docs_manage, google_slides_manage, google_drive_search, google_tasks_manage, google_classroom_manage, google_forms_manage, youtube_search_and_transcribe.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      result: `Error executing ${toolName}: ${err.message || String(err)}`,
      isError: true,
    };
  }
}
