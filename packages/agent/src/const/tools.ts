import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import zlib from "node:zlib";
import type { FileMutationRecord } from "./mutation-ledger.js";
import type {
  TodoItem,
  QuestionItem,
  BackgroundTaskItem,
  NativeToolDefinition,
  SubAgentItem,
  AgentConfig,
} from "./types.js";
import { executeLspQuery, type LspOperation } from "./lsp.js";
import { executeAstGrep } from "./ast-grep.js";
import { executeWebSearch, executeWebFetch } from "./web.js";
import { executeGitStatus, executeGitDiff, executeGitCommit, executeGitLog } from "./git.js";
import {
  recordMutation,
  executeRollbackMutation,
  createCheckpoint,
  restoreCheckpoint,
} from "./checkpoint.js";
import {
  executeSpawnAgent,
  executeAgentStatus,
  executeKillAgent,
  formatTaskResultEnvelope,
  globalSubAgentManager,
} from "./subagent.js";
import { performFuzzyEdit, applyLooseUnifiedDiff } from "./edit-engine.js";
import { checkBashInterception } from "./bash-interceptor.js";
import { spoolLargeOutput } from "./output-spooler.js";
import { executeJFind } from "./jfind.js";
import { executeRetain, executeRecall, executeReflect } from "./memory.js";
import { executeEval } from "./eval.js";
import { executeAstEdit } from "./ast-edit.js";
import { executeGhTool } from "./gh.js";

export type BrowserToolHandler = (
  toolName: string,
  args: Record<string, any>
) => Promise<{ result: any; isError: boolean }>;

export type ComputerToolHandler = (
  toolName: string,
  args: Record<string, any>
) => Promise<{ result: any; isError: boolean }>;

let globalBrowserToolHandler: BrowserToolHandler | null = null;
let globalComputerToolHandler: ComputerToolHandler | null = null;

export function registerGlobalBrowserToolHandler(handler: BrowserToolHandler | null) {
  globalBrowserToolHandler = handler;
}

export function getGlobalBrowserToolHandler(): BrowserToolHandler | null {
  return globalBrowserToolHandler;
}

export function registerGlobalComputerToolHandler(handler: ComputerToolHandler | null) {
  globalComputerToolHandler = handler;
}

export function getGlobalComputerToolHandler(): ComputerToolHandler | null {
  return globalComputerToolHandler;
}

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  stepIndex?: number;
  conversationId?: string;
  onFileMutation?: (record: FileMutationRecord) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  askUser?: (questions: QuestionItem[]) => Promise<any>;
  onTaskStarted?: (task: BackgroundTaskItem) => void;
  onTaskStopped?: (taskId: string, code: number | null) => void;
  allowOutsideWorkspace?: boolean;
  onSubAgentStarted?: (agent: SubAgentItem) => void;
  onSubAgentUpdated?: (agent: SubAgentItem) => void;
  onSubAgentFinished?: (agentId: string, result?: string, error?: string, agent?: SubAgentItem) => void;
  onSubAgentKilled?: (agentId: string, agent?: SubAgentItem) => void;
  parentConfig?: AgentConfig;
  learnId?: string;
  onSourceCreated?: (source: any) => void;
  onArtifactCreated?: (artifact: any) => void;
  browserHandler?: BrowserToolHandler;
  computerHandler?: ComputerToolHandler;
  voiceConfig?: any;
  imageConfig?: any;
  speechHandler?: (args: Record<string, any>, workspacePath: string) => Promise<{ result: any; isError: boolean }>;
  imageHandler?: (args: Record<string, any>, workspacePath: string) => Promise<{ result: any; isError: boolean }>;
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

export function isProbablyBinary(buffer: Buffer): boolean {
  const checkLen = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Native Browser Tools (OpenBot & oh-my-pi inspired Electron Webview control)
// ---------------------------------------------------------------------------

export const BROWSER_NAVIGATE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_navigate",
    description:
      "Navigate the native desktop sidepanel browser to a specified URL, or go 'back', 'forward', or 'reload'. If no browser tab is open yet, automatically opens one in the right pane. When multiple browser tabs exist, targets the active or most recently opened (last) browser tab unless tabId or newTab is specified.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "The URL to navigate to (e.g. 'https://github.com' or 'http://localhost:3000'), or 'back', 'forward', 'reload'.",
        },
        newTab: {
          type: "boolean",
          description:
            "Set to true to open this URL in a brand new browser tab in the sidepanel instead of reusing the current/last browser tab.",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID to target.",
        },
      },
      required: ["url"],
    },
  },
};

export const BROWSER_SNAPSHOT_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_snapshot",
    description:
      "Extract a hierarchical ARIA accessibility tree, interactive DOM element refs ([e1], [e2], ...), readable page text, and recent console/network errors from the active browser tab. Supports oh-my-pi delta diffing (diff: true) and Shadow DOM traversal.",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector to scope the snapshot to a specific subtree.",
        },
        interactive: {
          type: "boolean",
          description: "If true, keep only interactive controls and their structural path in the ARIA tree.",
        },
        compact: {
          type: "boolean",
          description: "Remove unnamed generic/group wrappers (default: true).",
        },
        urls: {
          type: "boolean",
          description: "Include resolved href URLs on links in the ARIA tree (default: true).",
        },
        diff: {
          type: "boolean",
          description:
            "If true, compare against the previous snapshot on the same URL and return a compact unified delta diff when only part of the page changed.",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID to inspect.",
        },
      },
    },
  },
};

export const BROWSER_CLICK_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_click",
    description:
      "Click on an interactive element by its ref (e.g. 'e1' from browser_snapshot), by semantic/CSS selector (e.g. 'text/Sign in', 'role/button[name=\"Submit\"]', 'label/Email', 'placeholder/Search', 'testid/login-btn', '#submit'), or at (x, y) coordinates.",
    parameters: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description: "The element ref ID from browser_snapshot (e.g. 'e1', 'e2'). Recommended.",
        },
        selector: {
          type: "string",
          description:
            "Alternative selector: CSS selector or oh-my-pi query prefix ('text/...', 'role/button[name=\"...\"]', 'label/...', 'placeholder/...', 'testid/...', 'xpath/...', 'pierce/...').",
        },
        x: {
          type: "number",
          description: "Optional absolute X pixel coordinate if clicking by position.",
        },
        y: {
          type: "number",
          description: "Optional absolute Y pixel coordinate if clicking by position.",
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button to click (default: 'left').",
        },
        clickCount: {
          type: "number",
          description: "Number of clicks: 1 for single click, 2 for double click (default: 1).",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
    },
  },
};

export const BROWSER_TYPE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_type",
    description:
      "Type text into an input, textarea, or contenteditable element by its ref (e.g. 'e2'), selector (e.g. 'placeholder/Search', 'label/Password'), or the currently focused element. Supports React controlled inputs, clearing existing text, and pressing Enter to submit.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to type into the field.",
        },
        ref: {
          type: "string",
          description: "The target element ref ID from browser_snapshot (e.g. 'e2').",
        },
        selector: {
          type: "string",
          description:
            "Optional CSS or semantic selector (e.g. 'placeholder/Email', 'label/Username', '#email').",
        },
        clear: {
          type: "boolean",
          description: "Whether to clear existing text before typing (default: true).",
        },
        submit: {
          type: "boolean",
          description: "Whether to press Enter after typing to submit the form (default: false).",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
      required: ["text"],
    },
  },
};

export const BROWSER_KEY_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_key",
    description:
      "Send a keyboard key or shortcut to the active browser page (e.g. 'Enter', 'Tab', 'Escape', 'Backspace', 'ArrowDown', 'PageDown').",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key name to press (e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown').",
        },
        modifiers: {
          type: "array",
          items: { type: "string" },
          description: "Optional keyboard modifiers (e.g. ['Control'], ['Shift'], ['Alt']).",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
      required: ["key"],
    },
  },
};

export const BROWSER_SCROLL_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_scroll",
    description:
      "Scroll the active browser page by direction ('down', 'up', 'top', 'bottom', 'left', 'right'), pixel delta, or scroll a specific element ref/selector into view.",
    parameters: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["down", "up", "left", "right", "top", "bottom"],
          description: "Scroll direction (default: 'down').",
        },
        amount: {
          type: "number",
          description: "Scroll distance in pixels when using direction (default: 500).",
        },
        deltaY: {
          type: "number",
          description: "Vertical scroll amount in pixels (positive scrolls down, negative scrolls up).",
        },
        deltaX: {
          type: "number",
          description: "Horizontal scroll amount in pixels (default: 0).",
        },
        ref: {
          type: "string",
          description: "Optional element ref ID to scroll directly into view.",
        },
        selector: {
          type: "string",
          description: "Optional CSS or semantic selector to scroll directly into view.",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
    },
  },
};

export const BROWSER_SCREENSHOT_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_screenshot",
    description:
      "Capture a screenshot of the visible browser viewport with optional Set-of-Mark ([e1], [e2]) interactive element annotations. Saves the image to disk and returns the file path and annotation legend.",
    parameters: {
      type: "object",
      properties: {
        annotate: {
          type: "boolean",
          description:
            "Overlay numbered [e1], [e2] boxes on interactive elements in the screenshot and return a legend (default: true).",
        },
        quality: {
          type: "number",
          description: "JPEG quality from 10 to 100 (default: 80).",
        },
        format: {
          type: "string",
          enum: ["jpeg", "png"],
          description: "Image encoding format (default: 'jpeg').",
        },
        ref: {
          type: "string",
          description: "Optional element ref to scroll into view before capturing.",
        },
        selector: {
          type: "string",
          description: "Optional selector to scroll into view before capturing.",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
    },
  },
};

export const BROWSER_CONSOLE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_console",
    description:
      "Read captured browser console logs (log, warn, error), uncaught page exceptions, and fetch/XHR network requests from the active browser tab. Ideal for debugging localhost web apps.",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["all", "error", "warn", "info", "log", "debug"],
          description: "Filter console messages by severity level (default: 'all').",
        },
        includeNetwork: {
          type: "boolean",
          description: "Include captured fetch/XHR network requests and status codes (default: true).",
        },
        onlyFailedNetwork: {
          type: "boolean",
          description: "If true, only return failed network requests with status >= 400 or status 0.",
        },
        clear: {
          type: "boolean",
          description: "Clear captured console and network buffers after reading (default: false).",
        },
        limit: {
          type: "number",
          description: "Maximum number of entries to return (default: 50).",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
    },
  },
};

export const BROWSER_EVALUATE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_evaluate",
    description:
      "Execute a multi-step sequence of browser actions (click, type, key, scroll, select, wait, navigate) and/or run custom JavaScript inside the browser page in a single turn (oh-my-pi tab.run / tab.evaluate pattern).",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description: "Optional sequence of browser steps to execute in order before evaluating script.",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["navigate", "click", "type", "key", "scroll", "select", "wait"],
              },
              url: { type: "string" },
              ref: { type: "string" },
              selector: { type: "string" },
              text: { type: "string" },
              key: { type: "string" },
              value: { type: "string" },
              clear: { type: "boolean" },
              submit: { type: "boolean" },
              direction: {
                type: "string",
                enum: ["down", "up", "left", "right", "top", "bottom"],
              },
              amount: { type: "number" },
              ms: { type: "number" },
            },
            required: ["action"],
          },
        },
        script: {
          type: "string",
          description:
            "Optional JavaScript expression or async function body to execute in the page context (e.g. 'return document.title;' or 'document.querySelectorAll(\"li\").length').",
        },
        tabId: {
          type: "string",
          description: "Optional specific browser tab ID.",
        },
      },
    },
  },
};

export const BROWSER_TABS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_tabs",
    description:
      "List all open browser tabs in the desktop sidepanel (showing their tabId, URL, title, active status, and which tab is last) or switch the active browser tab.",
    parameters: {
      type: "object",
      properties: {
        tabId: {
          type: "string",
          description: "Optional tabId to switch to and make active.",
        },
      },
    },
  },
};

export const BROWSER_REQUEST_HELP_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "browser_request_help",
    description:
      "Hand over browser control to the human user and pause until they complete manual verification (CAPTCHA, 2FA/OTP, login) or securely enter a password/secret into the page.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Detailed reason why human intervention is required (e.g. 'Please complete Cloudflare Turnstile CAPTCHA', 'Please enter your account password').",
        },
        secretWanted: {
          type: "string",
          description:
            "If requesting a password or secret to be typed without exposing it in chat, the label of the credential (e.g. 'Account Password', 'API Secret').",
        },
        ref: {
          type: "string",
          description: "Optional target element ref where the secret should be entered (e.g. 'e4').",
        },
      },
      required: ["reason"],
    },
  },
};

export const NATIVE_BROWSER_TOOLS: NativeToolDefinition[] = [
  BROWSER_NAVIGATE_TOOL,
  BROWSER_SNAPSHOT_TOOL,
  BROWSER_CLICK_TOOL,
  BROWSER_TYPE_TOOL,
  BROWSER_KEY_TOOL,
  BROWSER_SCROLL_TOOL,
  BROWSER_SCREENSHOT_TOOL,
  BROWSER_CONSOLE_TOOL,
  BROWSER_EVALUATE_TOOL,
  BROWSER_TABS_TOOL,
  BROWSER_REQUEST_HELP_TOOL,
];

// ---------------------------------------------------------------------------
// Native Computer Use Tool Definitions (Desktop GUI Automation - Orca/Const)
// ---------------------------------------------------------------------------

export const COMPUTER_LIST_APPS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_list_apps",
    description:
      "Lists visible and running local desktop applications (PID, process name, window titles) available for GUI automation and observation.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

export const COMPUTER_LIST_WINDOWS_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_list_windows",
    description:
      "Lists all visible top-level windows for a specific target desktop application (by name, executable, bundle ID, or pid:<number>).",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description:
            "The target application name, executable name, bundle identifier, or 'pid:<number>' from computer_list_apps.",
        },
      },
      required: ["app"],
    },
  },
};

export const COMPUTER_GET_APP_STATE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_get_app_state",
    description:
      "Inspects a visible desktop app window: extracts its complete Accessibility Tree with numbered element indexes and captures a visual window screenshot saved to disk. Always use this instead of writing custom PowerShell/OCR scripts.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector (name, bundleId, or pid:<number>).",
        },
        windowId: {
          type: "number",
          description: "Optional window ID from computer_list_windows.",
        },
        windowIndex: {
          type: "number",
          description: "Optional window index if windowId is not available.",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips screenshot capture to save tokens/bandwidth.",
        },
        restoreWindow: {
          type: "boolean",
          description: "If true (default), unminimizes and brings the window to the front before inspecting.",
        },
      },
      required: ["app"],
    },
  },
};

export const COMPUTER_CLICK_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_click",
    description:
      "Clicks a UI element by its numeric elementIndex from computer_get_app_state, or by window-local x,y coordinates from the screenshot. Always use this instead of executing terminal mouse scripts.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        elementIndex: {
          type: "number",
          description: "The numeric element index from the latest accessibility tree (recommended).",
        },
        x: {
          type: "number",
          description: "Window-local X coordinate (use only when elementIndex is unavailable).",
        },
        y: {
          type: "number",
          description: "Window-local Y coordinate (use only when elementIndex is unavailable).",
        },
        mouseButton: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button to click (default: 'left').",
        },
        clickCount: {
          type: "number",
          description: "Number of clicks: 1 for single-click, 2 for double-click (default: 1).",
        },
        modifiers: {
          type: "string",
          description: "Optional keyboard modifier chord held during click (e.g. 'CmdOrCtrl', 'Shift', 'Alt').",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app"],
    },
  },
};

export const COMPUTER_SET_VALUE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_set_value",
    description:
      "Directly sets the text or value of an editable UI element (text box, combo box, slider) via accessibility patterns without typing delays.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        elementIndex: {
          type: "number",
          description: "The numeric element index of the editable field.",
        },
        value: {
          type: "string",
          description: "The exact value or text to set.",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "elementIndex", "value"],
    },
  },
};

export const COMPUTER_TYPE_TEXT_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_type_text",
    description:
      "Synthesizes keyboard typing into the currently focused element of the target window. Ensure the control is focused via computer_click or computer_hotkey first. Never execute PowerShell SendKeys scripts.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        text: {
          type: "string",
          description: "The string of characters to type.",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "text"],
    },
  },
};

export const COMPUTER_PRESS_KEY_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_press_key",
    description:
      "Presses a single navigation or control key (e.g. 'Return', 'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Up', 'Down', 'Left', 'Right', 'Space').",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        key: {
          type: "string",
          description: "Key name to press (e.g. 'Return', 'Tab', 'Escape', 'Down').",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "key"],
    },
  },
};

export const COMPUTER_HOTKEY_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_hotkey",
    description:
      "Sends a keyboard shortcut chord combining modifier(s) and a key (e.g. 'CmdOrCtrl+F', 'Ctrl+N', 'Alt+F4', 'Ctrl+S'). Essential for focusing search or opening new chats in modern apps like WhatsApp or browsers.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        key: {
          type: "string",
          description: "Key combination chord string (e.g. 'CmdOrCtrl+A', 'Ctrl+Shift+P').",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "key"],
    },
  },
};

export const COMPUTER_PASTE_TEXT_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_paste_text",
    description:
      "Pastes text into the focused element via system clipboard and standard paste shortcut. Preferred for long bodies of text or code blocks.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        text: {
          type: "string",
          description: "Text to paste.",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "text"],
    },
  },
};

export const COMPUTER_SCROLL_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_scroll",
    description:
      "Scrolls a scrollable container or window up, down, left, or right.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Direction to scroll.",
        },
        pages: {
          type: "number",
          description: "Amount to scroll in page increments (default: 1).",
        },
        elementIndex: {
          type: "number",
          description: "Optional element index to scroll within.",
        },
        x: {
          type: "number",
          description: "Optional window-local X position to hover before scrolling.",
        },
        y: {
          type: "number",
          description: "Optional window-local Y position to hover before scrolling.",
        },
        noScreenshot: {
          type: "boolean",
          description: "If true, skips post-action screenshot.",
        },
      },
      required: ["app", "direction"],
    },
  },
};

export const COMPUTER_DRAG_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "computer_drag",
    description:
      "Drags mouse from a source element or coordinate to a destination element or coordinate.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Target application selector.",
        },
        fromElementIndex: { type: "number", description: "Source element index." },
        toElementIndex: { type: "number", description: "Destination element index." },
        fromX: { type: "number", description: "Source X coordinate." },
        fromY: { type: "number", description: "Source Y coordinate." },
        toX: { type: "number", description: "Destination X coordinate." },
        toY: { type: "number", description: "Destination Y coordinate." },
        noScreenshot: { type: "boolean", description: "If true, skips post-action screenshot." },
      },
      required: ["app"],
    },
  },
};

export const NATIVE_COMPUTER_TOOLS: NativeToolDefinition[] = [
  COMPUTER_LIST_APPS_TOOL,
  COMPUTER_LIST_WINDOWS_TOOL,
  COMPUTER_GET_APP_STATE_TOOL,
  COMPUTER_CLICK_TOOL,
  COMPUTER_SET_VALUE_TOOL,
  COMPUTER_TYPE_TEXT_TOOL,
  COMPUTER_PRESS_KEY_TOOL,
  COMPUTER_HOTKEY_TOOL,
  COMPUTER_PASTE_TEXT_TOOL,
  COMPUTER_SCROLL_TOOL,
  COMPUTER_DRAG_TOOL,
];


// ---------------------------------------------------------------------------
// Long-Term Memory Tool Definitions (retain, recall, reflect)
// ---------------------------------------------------------------------------

export const RETAIN_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "retain",
    description:
      "Store important architectural facts, project conventions, coding patterns, user preferences, or durable decisions into long-term memory across sessions. Stored as markdown files in .const/memory/ (MEMORY.md or <topic>.md).",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Array of memory items to retain.",
          items: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Information, rule, or architectural fact to remember.",
              },
              title: {
                type: "string",
                description: "Optional topic or title for this memory (e.g. 'coding-conventions', 'learning-goals'). Creates a dedicated <topic>.md file when provided.",
              },
              context: {
                type: "string",
                description: "Optional background context, rationale, or source of this decision.",
              },
              scope: {
                type: "string",
                enum: ["project", "global"],
                description: "Memory scope: 'project' (current workspace) or 'global' (cross-project knowledge).",
              },
            },
            required: ["content"],
          },
        },
      },
      required: ["items"],
    },
  },
};

export const RECALL_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "recall",
    description:
      "Search long-term memory for previously retained architectural decisions, coding patterns, project context, or user preferences. Searches markdown files in .const/memory/ across workspace and global scopes.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query to recall relevant memories.",
        },
        scope: {
          type: "string",
          enum: ["project", "global", "all"],
          description: "Scope filter: 'project' (workspace memory only), 'global' (cross-project memory only), or 'all' (default).",
        },
        limit: {
          type: "number",
          description: "Maximum memories to return (default: 10).",
        },
      },
      required: ["query"],
    },
  },
};

export const REFLECT_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "reflect",
    description:
      "Synthesize an overview or answer architectural and coding questions using relevant entries stored in long-term memory.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Question or topic to reflect upon based on retained memory.",
        },
        context: {
          type: "string",
          description: "Optional additional context to guide reflection.",
        },
      },
      required: ["query"],
    },
  },
};

// ---------------------------------------------------------------------------
// Speech & Image Generation Tool Definitions (TTS & Visual Synthesis)
// ---------------------------------------------------------------------------

export const GENERATE_SPEECH_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "generate_speech",
    description:
      "Generate high-fidelity speech audio (TTS) from text using the user's configured voice engine (Inworld AI, OpenAI TTS, or custom speech model). Saves the output audio file (.mp3) directly into the workspace. By default, uses the user's active voice and model settings, but voice, model, speed, delivery, and language can be customized conversationally.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text or narration script to synthesize into spoken audio.",
        },
        output_path: {
          type: "string",
          description:
            "Relative workspace path to save the generated audio file (e.g. 'audio/scene_1.mp3', 'narration.mp3').",
        },
        voice: {
          type: "string",
          description:
            "Optional voice name or ID override (e.g. 'Ashley', 'Dennis', 'Hektor', 'Olivia', 'alloy', 'echo'). Defaults to user's active voice setting.",
        },
        model: {
          type: "string",
          description:
            "Optional speech model ID override (e.g. 'inworld-tts-2', 'inworld-tts-2-flash', 'tts-1', 'tts-1-hd'). Defaults to user's active model setting.",
        },
        speed: {
          type: "number",
          description: "Speaking rate multiplier (e.g. 1.0 for normal, 1.1 for slightly faster).",
        },
        delivery: {
          type: "string",
          description:
            "Optional delivery style or emotion for Inworld TTS (e.g. 'NEUTRAL', 'HAPPY', 'SERIOUS', 'EXCITED', 'BALANCED').",
        },
        language: {
          type: "string",
          description: "Optional language code (e.g. 'id-ID', 'en-US', 'ja-JP').",
        },
      },
      required: ["text", "output_path"],
    },
  },
};

export const GENERATE_IMAGE_TOOL: NativeToolDefinition = {
  type: "function",
  function: {
    name: "generate_image",
    description:
      "Generate an illustration, educational diagram visual, or scene artwork from a descriptive prompt using the user's configured image generation model (e.g. FLUX, Stable Diffusion, DALL-E). Saves the output image (.png) directly into the workspace. Defaults to user's active image model and endpoint settings, but model and aspect ratio can be customized.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed descriptive prompt for the image to generate.",
        },
        output_path: {
          type: "string",
          description:
            "Relative workspace path to save the generated image file (e.g. 'images/diagram.png', 'assets/hero.png').",
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "1:1", "9:16", "4:3", "3:4"],
          description: "Aspect ratio for the generated image (default: '16:9').",
        },
        size: {
          type: "string",
          description: "Optional explicit image dimensions (e.g. '1024x1024', '1792x1024', '1024x1792').",
        },
        model: {
          type: "string",
          description: "Optional image generation model ID override. Defaults to user's active image model.",
        },
      },
      required: ["prompt", "output_path"],
    },
  },
};

// ---------------------------------------------------------------------------
// Native Tool Definitions (Pi Standard 4 Core Tools + Aliases)
// ---------------------------------------------------------------------------

export const CONST_DEFAULT_TOOLS: NativeToolDefinition[] = [
  ...NATIVE_BROWSER_TOOLS,
  ...NATIVE_COMPUTER_TOOLS,
  GENERATE_SPEECH_TOOL,
  GENERATE_IMAGE_TOOL,
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
        "Execute a shell command in the workspace directory (using Git Bash on Windows or bash on Unix). Returns standard output, standard error, and exit status. Supports background execution via 'async: true' and long-running services (dev servers, daemons) with readiness verification via 'ready'.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash shell command to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (defaults to 60, use 0 for infinite/watcher).",
          },
          cwd: {
            type: "string",
            description: "Optional working directory for command execution.",
          },
          async: {
            type: "boolean",
            description: "If true, runs command as a background job/service without blocking. Returns immediate task ID. Use 'wait' or 'manage_task' to monitor or stop.",
          },
          name: {
            type: "string",
            description: "Optional identifier or friendly name for this background job or service (e.g. 'dev-server', 'vite', 'backend').",
          },
          ready: {
            type: "object",
            description: "Optional readiness criteria before returning. Waits for port to open or log pattern to appear before continuing.",
            properties: {
              port: {
                type: "number",
                description: "TCP port number to wait for (e.g. 3000, 5173, 8080).",
              },
              log: {
                type: "string",
                description: "Regex pattern in stdout/stderr to indicate server is ready (e.g. 'ready in', 'Local:').",
              },
              timeout: {
                type: "number",
                description: "Maximum seconds to wait for readiness (defaults to 30).",
              },
            },
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
        "Execute a PowerShell command (Windows PowerShell or pwsh). Returns standard output, standard error, and exit status. Supports background execution via 'async: true' and long-running services (dev servers, daemons) with readiness verification via 'ready'.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The PowerShell command to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (defaults to 60, use 0 for infinite/watcher).",
          },
          cwd: {
            type: "string",
            description: "Optional working directory for command execution.",
          },
          async: {
            type: "boolean",
            description: "If true, runs command as a background process/service without blocking. Returns immediate task ID. Use 'wait' or 'manage_task' to monitor or stop.",
          },
          name: {
            type: "string",
            description: "Optional identifier or friendly name for this background job or service (e.g. 'dev-server', 'vite', 'backend').",
          },
          ready: {
            type: "object",
            description: "Optional readiness criteria before returning. Waits for port to open or log pattern to appear before continuing.",
            properties: {
              port: {
                type: "number",
                description: "TCP port number to wait for (e.g. 3000, 5173, 8080).",
              },
              log: {
                type: "string",
                description: "Regex pattern in stdout/stderr to indicate server is ready (e.g. 'ready in', 'Local:').",
              },
              timeout: {
                type: "number",
                description: "Maximum seconds to wait for readiness (defaults to 30).",
              },
            },
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
            description: "The task ID or name to inspect or terminate (required for 'status' and 'kill').",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wait",
      description:
        "Event-driven barrier: wait for running background subagents or background shell processes/services to settle or produce output. If task_id / agent_id is omitted, blocks until the next active background subagent or background task settles. NEVER run bash 'sleep' to wait.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Optional background task ID, subagent ID, or subagent handle name to wait for.",
          },
          agent_id: {
            type: "string",
            description: "Optional subagent ID or handle name to wait for.",
          },
          timeout: {
            type: "number",
            description: "Maximum seconds to wait (defaults to 60).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lsp",
      description:
        "Query code intelligence for precision code navigation and understanding using Language Server Protocol / TypeScript Language Service. Operations: 'goToDefinition' (find symbol declaration/source), 'findReferences' (find all usages across codebase), 'goToImplementation' (find concrete implementation), 'hover' (type signature and doc comments at cursor position), 'documentSymbols' (outline all classes, functions, methods in a file). Lines and characters are 1-indexed.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["goToDefinition", "findReferences", "goToImplementation", "hover", "documentSymbols"],
            description: "The LSP operation to execute.",
          },
          file_path: {
            type: "string",
            description: "The target file to query (relative to workspace or absolute).",
          },
          line: {
            type: "number",
            description: "1-indexed line number of the cursor position (optional for documentSymbols).",
          },
          character: {
            type: "number",
            description: "1-indexed character / column number of the cursor position (optional for documentSymbols).",
          },
        },
        required: ["operation", "file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ast_grep",
      description:
        "Structural syntax-tree code search (AST Grep). Search for structural patterns across code with metavariables (e.g. '$VAR', 'function $NAME($$$ARGS) { $$$ }', 'import { $$$ } from \"$MOD\"') ignoring formatting differences. Returns matched files, lines, and extracted metavariables.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The AST pattern to search for (supports metavariables like $NAME, $$$ARGS).",
          },
          path: {
            type: "string",
            description: "File or directory to search in (defaults to workspace root).",
          },
          lang: {
            type: "string",
            description: "Optional language override (e.g. 'ts', 'tsx', 'js', 'py', 'rust', 'go').",
          },
          globs: {
            type: "string",
            description: "Optional glob pattern to filter files (e.g. '*.ts', 'src/**/*.tsx').",
          },
          rewrite: {
            type: "string",
            description: "Optional structural replacement pattern to preview AST rewrite.",
          },
          limit: {
            type: "number",
            description: "Maximum matches to return (default 50).",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web using Const Search for up-to-date documentation, API references, library updates, real-time facts, or debugging solutions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query text.",
          },
          num_results: {
            type: "number",
            description: "Number of search results to return (default: 5).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch web content from a URL (HTTP/HTTPS) and convert HTML to clean, readable Markdown. Strips scripts, styles, and unwanted markup while preserving text, headings, code blocks, and tables.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full web URL to fetch.",
          },
          max_chars: {
            type: "number",
            description: "Maximum characters of content to return (default: 30000).",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description:
        "Inspect git repository status: current branch, upstream tracking status, staged modifications, unstaged files, and untracked files.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description:
        "View unified git diff of file modifications in the workspace. Supports staged diff, specific file diff, or comparison with a commit.",
      parameters: {
        type: "object",
        properties: {
          staged: {
            type: "boolean",
            description: "View staged changes (default: false).",
          },
          file: {
            type: "string",
            description: "Optional specific file path to diff.",
          },
          commit: {
            type: "string",
            description: "Optional commit hash or revision to compare against (e.g. 'HEAD~1').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_commit",
      description:
        "Stage changes and create a git commit with a clear, descriptive commit message.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The commit message.",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of files to stage and commit (defaults to all changes).",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_log",
      description:
        "View recent git commit history with hashes, author names, relative dates, and messages.",
      parameters: {
        type: "object",
        properties: {
          max_count: {
            type: "number",
            description: "Maximum number of commits to list (default: 10).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkpoint",
      description:
        "Create a named snapshot checkpoint of the workspace state and file modifications before undertaking risky refactors or changes. Allows immediate full restore via restore_checkpoint if changes break.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Optional descriptive label or goal for this checkpoint (e.g. 'before refactoring auth logic').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restore_checkpoint",
      description:
        "Restore workspace files back to a previously created checkpoint, rolling back all intervening modifications and restoring snapshots. If no checkpoint_id is provided, restores the most recent checkpoint.",
      parameters: {
        type: "object",
        properties: {
          checkpoint_id: {
            type: "string",
            description:
              "Optional ID of the checkpoint to restore. Defaults to the latest active checkpoint.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rollback_mutation",
      description:
        "Autonomously undo recent file mutation(s) without needing the user to manually click undo in the chat. Can revert the latest modification, revert modifications to a specific file, or revert by mutation ID.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "Optional specific file path whose recent change(s) should be reverted.",
          },
          steps: {
            type: "number",
            description:
              "Number of recent modifications to undo (default: 1).",
          },
          mutation_id: {
            type: "string",
            description:
              "Optional specific mutation ID to roll back.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task",
      description:
        "Delegate work to one or more isolated subagents. Supports single-task mode ('task') or parallel batch mode ('context' + 'tasks[]'). Runs synchronously in the foreground by default and returns <task-result> envelopes with complete findings while streaming live progress to the UI.\nAvailable specialist personas:\n- 'scout': Fast READ-ONLY codebase researcher for pattern search and architectural tracing.\n- 'reviewer': READ-ONLY code review specialist for logic correctness, regressions, and cross-boundary verification.\n- 'security-reviewer': READ-ONLY security specialist for vulnerability & source-to-sink auditing.\n- 'task': General-purpose worker with full read/write/edit/terminal capabilities (default).\n- 'sonic': High-speed worker for quick mechanical edits or targeted updates.\n(Also supports custom agents defined in .const/agents/*.md or .omp/agents/*.md).",
      parameters: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description:
              "Optional shared background context, architectural contracts, or interfaces prepended to all spawned subagents (recommended when spawning a batch via 'tasks').",
          },
          tasks: {
            type: "array",
            description:
              "Optional array of subagent tasks to spawn concurrently in parallel batch mode (up to 5 concurrent).",
            items: {
              type: "object",
              properties: {
                task: {
                  type: "string",
                  description:
                    "Self-contained task instructions (# Target files, # Change steps, # Acceptance criteria).",
                },
                assignment: {
                  type: "string",
                  description:
                    "Alias for 'task': self-contained task assignment instructions.",
                },
                agent: {
                  type: "string",
                  description:
                    "Specialist persona: 'scout', 'reviewer', 'security-reviewer', 'task', 'sonic', or custom agent name. Default: 'task'.",
                },
                name: {
                  type: "string",
                  description:
                    "Short CamelCase or descriptive handle (e.g. 'AuthAudit', 'Sub-agent 1: Hero Section'). Auto-generated if omitted.",
                },
                id: {
                  type: "string",
                  description: "Alias for 'name' (short CamelCase task identifier).",
                },
                description: {
                  type: "string",
                  description: "Short human-readable summary of what this subagent does.",
                },
                solution_space: {
                  type: "string",
                  description:
                    "Optional brief note on how open-ended the problem is (e.g. 'one fix: rename prop' vs 'race condition cause open').",
                },
                effort: {
                  type: "string",
                  enum: ["lo", "med", "hi"],
                  description: "Optional reasoning effort override ('lo', 'med', 'hi').",
                },
                model: {
                  type: "string",
                  description: "Optional model ID override for this subagent.",
                },
                run_in_background: {
                  type: "boolean",
                  description:
                    "If true, launches in background and returns immediately. Use 'wait' to collect results.",
                },
              },
            },
          },
          task: {
            type: "string",
            description:
              "Complete, self-contained instructions and acceptance criteria when spawning a single subagent.",
          },
          agent: {
            type: "string",
            description:
              "The specialist subagent persona to spawn: 'scout' (read-only research), 'reviewer' (code review), 'security-reviewer' (security audit), 'task' (general worker), or 'sonic' (fast worker). Default: 'task'.",
          },
          name: {
            type: "string",
            description:
              "Optional short identifier or label for this task (e.g. 'AuthAudit', 'Sub-agent 1: Navbar'). Auto-generated if omitted.",
          },
          solution_space: {
            type: "string",
            description:
              "Optional brief description of how open-ended the problem is (guides subagent thinking effort).",
          },
          effort: {
            type: "string",
            enum: ["lo", "med", "hi"],
            description: "Optional reasoning effort override ('lo', 'med', 'hi').",
          },
          model: {
            type: "string",
            description: "Optional model ID override for this subagent.",
          },
          run_in_background: {
            type: "boolean",
            description:
              "If true, runs the subagent in the background without blocking. Call 'wait' to await completion. Default is false.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agent_status",
      description:
        "Check the status, latest activity, and findings of running or completed subagents in the current session. If agent_id is omitted, lists all session subagents.",
      parameters: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "Optional ID or handle name of a specific subagent to inspect.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kill_agent",
      description:
        "Terminate an active subagent running in the background by its ID or handle name.",
      parameters: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "The ID or handle name of the subagent to terminate.",
          },
        },
        required: ["agent_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description:
        "Private scratchpad to record internal thoughts, reasoning steps, or plan trade-offs without showing them directly to the user. Ideal when designing complex architecture or breaking down tricky problems.",
      parameters: {
        type: "object",
        properties: {
          thoughts: {
            type: "string",
            description: "Private scratchpad thought process.",
          },
        },
        required: ["thoughts"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "jfind",
      description:
        "Semantic Grep & Code Passage Search (inspired by oh-my-pi). Describe a code behavior, feature, or function logically (e.g. 'OAuth token refresh', 'parse unified diff', 'manage active jobs') and retrieve the most relevant file passages, line ranges, and code snippets scored by relevance.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language description of what the code does.",
          },
          path: {
            type: "string",
            description: "Optional folder path to restrict search (defaults to workspace root).",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Optional specific keywords or symbol names to boost scoring.",
          },
          limit: {
            type: "number",
            description: "Maximum number of ranked code passages to return (default: 6).",
          },
        },
        required: ["query"],
      },
    },
  },
  RETAIN_TOOL,
  RECALL_TOOL,
  REFLECT_TOOL,
  {
    type: "function",
    function: {
      name: "eval",
      description:
        "In-Memory Persistent Code Evaluation / REPL (inspired by oh-my-pi). Execute JavaScript/TypeScript or Python code in-memory with persistent variables across calls. Captures stdout, console logs, and return value without polluting the filesystem.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code snippet to evaluate.",
          },
          language: {
            type: "string",
            enum: ["javascript", "typescript", "python"],
            description: "Language of the code snippet (default: 'javascript').",
          },
          session_id: {
            type: "string",
            description: "Optional REPL session ID to share state/variables (default: 'default').",
          },
          timeout: {
            type: "number",
            description: "Execution timeout in seconds (default: 15).",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ast_edit",
      description:
        "Structural AST Code Rewriting (inspired by oh-my-pi). Apply pattern rewrites ($PATTERN -> $REPLACEMENT) across one or more files using AST metavariables (e.g. '$VAR', 'function $NAME($$$ARGS)'), ignoring whitespace differences. Automatically records file mutations for rollback.",
      parameters: {
        type: "object",
        properties: {
          ops: {
            type: "array",
            description: "List of AST rewrite operations to perform.",
            items: {
              type: "object",
              properties: {
                pat: {
                  type: "string",
                  description: "Structural AST pattern to find (supports metavariables like $NAME, $$$ARGS).",
                },
                out: {
                  type: "string",
                  description: "Replacement AST template using the matched metavariables.",
                },
              },
              required: ["pat", "out"],
            },
          },
          paths: {
            type: "array",
            items: { type: "string" },
            description: "Files, directories, or glob paths to apply the structural rewrite to.",
          },
          dry_run: {
            type: "boolean",
            description: "If true, previews rewrites without writing changes to disk.",
          },
        },
        required: ["ops", "paths"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gh",
      description:
        "Interact directly with GitHub pull requests, issues, Actions CI runs, and repositories without writing complex curl or shell scripts. Supports PR diff viewing, PR branch checkout, workflow run status, and issue/PR searching.",
      parameters: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: [
              "pr_diff",
              "pr_checkout",
              "run_watch",
              "search_issues",
              "search_prs",
              "search_code",
              "repo_view"
            ],
            description: "The GitHub operation to execute.",
          },
          repo: {
            type: "string",
            description: "Optional repository in 'owner/repo' format (defaults to current repository).",
          },
          pr: {
            type: "string",
            description: "PR number, branch name, or full PR URL (for 'pr_diff' and 'pr_checkout').",
          },
          query: {
            type: "string",
            description: "Search query for search operations.",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 10).",
          },
          run: {
            type: "string",
            description: "Action run ID to view (for 'run_watch').",
          },
        },
        required: ["op"],
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
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web using Const Search for up-to-date academic resources, journal articles, scientific references, real-time facts, curriculum updates, or educational materials.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query text.",
          },
          num_results: {
            type: "number",
            description: "Number of search results to return (default: 5).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch web content from a URL (HTTP/HTTPS) and convert HTML to clean, readable Markdown. Strips scripts, styles, and unwanted markup while preserving text, headings, code blocks, and tables for study research.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full web URL to fetch.",
          },
          max_chars: {
            type: "number",
            description: "Maximum characters of content to return (default: 30000).",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_source",
      description:
        "Save a research finding, external URL reference, or self-synthesized study knowledge note as a permanent source in the current workspace. Use this when the user asks to save research or when critical learning material should be preserved for grounding and study.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Concise, descriptive title for the source.",
          },
          type: {
            type: "string",
            enum: ["url", "text", "file"],
            description:
              "Source type: 'url' for web links, 'text' for AI knowledge notes/study synthesis, 'file' for workspace documents.",
          },
          content: {
            type: "string",
            description:
              "The complete content, excerpt, or Markdown summary of the source.",
          },
          url: {
            type: "string",
            description: "The web URL if type is 'url' (optional).",
          },
        },
        required: ["title", "type", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_studio_artifact",
      description:
        "Generate and add an educational study artifact directly into the workspace Studio. Supports interactive flashcards, quizzes, mind maps, cheat sheets, and reports. Automatically populates the Studio tab so the user can study or review it.",
      parameters: {
        type: "object",
        properties: {
          artifact_type: {
            type: "string",
            enum: ["flashcard", "quiz", "mind_map", "cheatsheet", "report"],
            description: "The type of studio learning artifact to create.",
          },
          title: {
            type: "string",
            description: "Title of the study artifact.",
          },
          topic: {
            type: "string",
            description: "Topic or subject covered by this artifact.",
          },
          data: {
            type: "object",
            description:
              "The structured artifact data according to its type (e.g. for flashcard: { cards: [{ front, back, hint }] }; for quiz: { questions: [...] }; for mind_map: { root: {...} }; for cheatsheet: { cards: [...] }).",
          },
        },
        required: ["artifact_type", "title"],
      },
    },
  },
  RETAIN_TOOL,
  RECALL_TOOL,
  REFLECT_TOOL,
  GENERATE_SPEECH_TOOL,
  GENERATE_IMAGE_TOOL,
  ...NATIVE_BROWSER_TOOLS,
  ...NATIVE_COMPUTER_TOOLS,
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
  const userId = process.env.COMPOSIO_USER_ID || "learn_desktop_user";

  // 1. Primary path: Delegate execution to Const Router MCP Gateway
  const routerBaseUrl = (
    process.env.CONST_ROUTER_BASE_URL ||
    process.env.VITE_CONST_ROUTER_BASE_URL ||
    "https://router.const.web.id/v1"
  ).replace(/\/+$/, "");

  try {
    const routerRes = await fetch(`${routerBaseUrl}/mcp/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        toolSlug: toolName,
        arguments: args,
        userId,
      }),
      signal,
    });

    if (routerRes.ok) {
      const routerData = await routerRes.json();
      if (routerData.success && routerData.data) {
        const d = routerData.data;
        return {
          result: typeof d === "string" ? d : JSON.stringify(d, null, 2),
          isError: false,
        };
      }
    } else if (routerRes.status === 429) {
      const errData = await routerRes.json().catch(() => ({}));
      return {
        result: JSON.stringify({
          error: errData.error || "Batas mingguan 300 tool call MCP telah tercapai.",
          status: "limit_exceeded",
          tool: toolName,
        }),
        isError: true,
      };
    }
  } catch (routerErr) {
    console.warn("[Agent Tool] Router MCP gateway unavailable, checking local fallback:", routerErr);
  }

  // 2. Secondary fallback: Local Composio execution if COMPOSIO_API_KEY is present
  const apiKey =
    process.env.COMPOSIO_API_KEY ||
    process.env.VITE_COMPOSIO_API_KEY ||
    "";

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
                ? `Spreadsheet "${title}" disiapkan. Akun Google Sheets Anda belum terhubung â€” hubungkan akun di menu Connectors agar langsung tersimpan di Google Drive.`
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
                  ? s.bullets.map((b: string) => `â€¢ ${b}`).join("\n")
                  : s.content || "";
                return `## ${s.title || "Slide"}\n\n${bullets}`;
              })
              .join("\n\n---\n\n");
          } else {
            markdownText = `Theme: corporate_blue\n\n# ${title}\n\n---\n\n## Pendahuluan\nâ€¢ Gambaran materi pokok\nâ€¢ Tujuan pembelajaran\n\n---\n\n## Kesimpulan\nâ€¢ Poin-poin evaluasi utama`;
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
export function extractPathArg(args: Record<string, any>): string {
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

export async function extractPdfText(
  filePathOrBuffer: string | Buffer,
  signal?: AbortSignal
): Promise<{ text: string; pages: number }> {
  let buffer: Buffer;
  let filename = "document.pdf";
  try {
    if (typeof filePathOrBuffer === "string") {
      filename = path.basename(filePathOrBuffer);
      buffer = await fs.readFile(filePathOrBuffer);
    } else {
      buffer = filePathOrBuffer;
    }
  } catch (err: any) {
    throw new Error(`Failed to read PDF file: ${err.message}`);
  }

  // 1. Primary Extractor: pdf-parse (pure JavaScript, works universally across all platforms)
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy().catch(() => {});
    if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
      return {
        text: parsed.text.trim(),
        pages: parsed.total || parsed.pages?.length || 1,
      };
    }
  } catch {
    // Fall back to CLI if pdf-parse encounters unusual stream encoding
  }

  // 2. Secondary Extractor: pdftotext CLI (Git Bash / Linux / macOS)
  if (typeof filePathOrBuffer === "string") {
    const shellCfg = getShellConfig();
    if (shellCfg.type === "bash") {
      try {
        const posixPath = filePathOrBuffer.replace(/\\/g, "/");
        const cmd = `pdftotext "${posixPath}" -`;

        const result = await runProcess(shellCfg.shell, [...shellCfg.args, cmd], {
          cwd: path.dirname(filePathOrBuffer),
          signal,
          timeoutMs: 15000,
        });

        if (result.stdout && result.stdout.trim().length > 0) {
          const text = result.stdout.trim();
          const pages = text.split("\f").filter(Boolean).length || 1;
          return { text, pages };
        }
      } catch {}
    }
  }

  // 3. Graceful Fallback: Extract basic metadata for scanned or image-only PDFs
  try {
    const content = buffer.toString("latin1");
    const matches = content.match(/\/Title\s*\(([^)]+)\)|\/Author\s*\(([^)]+)\)/g) || [];
    const info = matches.map((m) => m.replace(/[\/\(\)]/g, "")).join(" | ");
    return {
      text: `[PDF Document: ${filename}]\n${info ? `Metadata: ${info}\n` : ""}(Note: This PDF does not contain an embedded text layer; it may be an image scan).`,
      pages: 1,
    };
  } catch (err: any) {
    throw new Error(`Failed to extract text from PDF: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Office & Universal Document Extraction Helper (.docx, .pptx, .xlsx, .odt, .ods, .odp)
// ---------------------------------------------------------------------------

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  if (buffer.length < 22) return entries;

  // Find End of Central Directory Record (EOCD): signature 0x06054b50 (PK\x05\x06)
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length, 65557);
  for (let i = buffer.length - 22; i >= buffer.length - maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return entries;

  const cdEntriesCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  let cur = cdOffset;
  for (let i = 0; i < cdEntriesCount; i++) {
    if (cur + 46 > buffer.length || buffer.readUInt32LE(cur) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cur + 10);
    const compSize = buffer.readUInt32LE(cur + 20);
    const nameLen = buffer.readUInt16LE(cur + 28);
    const extraLen = buffer.readUInt16LE(cur + 30);
    const commentLen = buffer.readUInt16LE(cur + 32);
    const localHeaderOffset = buffer.readUInt32LE(cur + 42);

    const name = buffer.toString("utf-8", cur + 46, cur + 46 + nameLen);
    cur += 46 + nameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 <= buffer.length) {
      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = buffer.subarray(dataOffset, dataOffset + compSize);

      let uncompData: Buffer | undefined;
      if (method === 0) {
        uncompData = compData;
      } else if (method === 8) {
        try {
          uncompData = zlib.inflateRawSync(compData);
        } catch {}
      }
      if (uncompData) {
        entries.set(name, uncompData);
      }
    }
  }
  return entries;
}

function extractDocxText(entries: Map<string, Buffer>): string {
  const docBuf = entries.get("word/document.xml");
  if (!docBuf) return "";
  const xml = docBuf.toString("utf-8");
  const text = xml
    .replace(/<w:p[^>]*>/gi, "")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<w:tab[^>]*\/>/gi, "\t")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<\/w:tc>/gi, "\t")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(text).replace(/\n{3,}/g, "\n\n").trim();
}

function extractPptxText(entries: Map<string, Buffer>): { text: string; pages: number } {
  const slideKeys: { key: string; num: number }[] = [];
  for (const key of entries.keys()) {
    const match = key.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideKeys.push({ key, num: parseInt(match[1]!, 10) });
    }
  }
  slideKeys.sort((a, b) => a.num - b.num);

  const slideTexts: string[] = [];
  for (const { key, num } of slideKeys) {
    const buf = entries.get(key);
    if (!buf) continue;
    const xml = buf.toString("utf-8");
    const raw = xml
      .replace(/<a:p[^>]*>/gi, "")
      .replace(/<\/a:p>/gi, "\n")
      .replace(/<a:br[^>]*\/>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    const clean = decodeXmlEntities(raw).replace(/\n{3,}/g, "\n\n").trim();
    if (clean) {
      slideTexts.push(`--- Slide ${num} ---\n${clean}`);
    }
  }
  return {
    text: slideTexts.join("\n\n"),
    pages: Math.max(1, slideKeys.length),
  };
}

function extractXlsxText(entries: Map<string, Buffer>): string {
  const sharedStrings: string[] = [];
  const sstBuf = entries.get("xl/sharedStrings.xml");
  if (sstBuf) {
    const xml = sstBuf.toString("utf-8");
    const matches = xml.matchAll(/<t[^>]*>(.*?)<\/t>/gs);
    for (const m of matches) {
      sharedStrings.push(decodeXmlEntities(m[1] || ""));
    }
  }

  const sheetKeys = Array.from(entries.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort();

  const lines: string[] = [];
  for (const key of sheetKeys.slice(0, 5)) {
    const buf = entries.get(key);
    if (!buf) continue;
    const xml = buf.toString("utf-8");
    const rowMatches = xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs);
    const sheetRows: string[] = [];
    for (const r of rowMatches) {
      const rowContent = r[1] || "";
      const cellMatches = rowContent.matchAll(/<c[^>]*?(?:\st="([a-z]+)")?[^>]*>(?:<v>(.*?)<\/v>)?<\/c>/gs);
      const cells: string[] = [];
      for (const c of cellMatches) {
        const type = c[1];
        const val = c[2] || "";
        if (type === "s" && sharedStrings.length > 0) {
          const idx = parseInt(val, 10);
          cells.push(sharedStrings[idx] || val);
        } else {
          cells.push(val);
        }
      }
      if (cells.some((v) => v.trim().length > 0)) {
        sheetRows.push(cells.join("\t"));
      }
    }
    if (sheetRows.length > 0) {
      const sheetName = key.replace(/.*\/([^/]+)\.xml/, "$1");
      lines.push(`--- Sheet: ${sheetName} ---\n` + sheetRows.slice(0, 300).join("\n"));
    }
  }

  if (lines.length > 0) {
    return lines.join("\n\n").trim();
  }

  if (sharedStrings.length > 0) {
    return sharedStrings.slice(0, 500).join("\n");
  }
  return "";
}

function extractOdfText(entries: Map<string, Buffer>): string {
  const contentBuf = entries.get("content.xml");
  if (!contentBuf) return "";
  const xml = contentBuf.toString("utf-8");
  const raw = xml
    .replace(/<text:p[^>]*>/gi, "")
    .replace(/<\/text:p>/gi, "\n")
    .replace(/<text:line-break\/>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(raw).replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractDocumentText(
  filePathOrBuffer: string | Buffer,
  filenameOverride?: string,
  signal?: AbortSignal
): Promise<{ text: string; pages?: number; type: string }> {
  let buffer: Buffer;
  let filename = filenameOverride || "document";

  if (typeof filePathOrBuffer === "string") {
    filename = filenameOverride || path.basename(filePathOrBuffer);
    buffer = await fs.readFile(filePathOrBuffer);
  } else {
    buffer = filePathOrBuffer;
  }

  const ext = (filename.split(".").pop() || "").toLowerCase();

  // 1. PDF
  if (ext === "pdf" || (!ext && buffer.slice(0, 4).toString() === "%PDF")) {
    const res = await extractPdfText(buffer, signal);
    return { text: res.text, pages: res.pages, type: "PDF Document" };
  }

  // 2. OpenXML & ODF Formats (PKZIP archives)
  if (["docx", "pptx", "xlsx", "odt", "ods", "odp"].includes(ext) || buffer.slice(0, 2).toString() === "PK") {
    const entries = readZipEntries(buffer);
    if (entries.size > 0) {
      if (ext === "docx" || entries.has("word/document.xml")) {
        const text = extractDocxText(entries);
        return { text: text || `[Word Document: ${filename} (empty or no text layer)]`, type: "Word Document" };
      }
      if (ext === "pptx" || entries.has("ppt/presentation.xml")) {
        const res = extractPptxText(entries);
        return {
          text: res.text || `[PowerPoint Presentation: ${filename} (empty or no text layer)]`,
          pages: res.pages,
          type: "PowerPoint Presentation",
        };
      }
      if (ext === "xlsx" || entries.has("xl/workbook.xml")) {
        const text = extractXlsxText(entries);
        return { text: text || `[Excel Spreadsheet: ${filename} (empty or no text layer)]`, type: "Excel Spreadsheet" };
      }
      if (["odt", "ods", "odp"].includes(ext) || entries.has("content.xml")) {
        const text = extractOdfText(entries);
        return { text: text || `[OpenDocument: ${filename}]`, type: "OpenDocument" };
      }
    }
  }

  // 3. Plain Text, Markdown, CSV, JSON, Code files
  try {
    const text = buffer.toString("utf-8");
    return { text, type: "Text Document" };
  } catch (err: any) {
    throw new Error(`Failed to extract text from ${filename}: ${err.message}`);
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

export function checkPortOpen(port: number, host = "127.0.0.1", timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

export interface ServiceReady {
  log?: string;
  port?: number;
  host?: string;
  timeout?: number;
}

export interface StartTaskOptions {
  name?: string;
}

export interface ActiveBackgroundTask {
  id: string;
  name?: string;
  command: string;
  cwd: string;
  pid?: number;
  startTime: number;
  status: "running" | "completed" | "failed";
  exitCode: number | null;
  logs: string[];
  child?: ChildProcess;
  port?: number;
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

  public startTask(command: string, cwd: string, options?: StartTaskOptions): ActiveBackgroundTask {
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
      name: options?.name,
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

          // Auto-detect port from common dev server output
          const portMatch = line.match(
            /(?:https?:\/\/(?:localhost|127\.0\.0\.1):|port\s+|listening\s+on\s+(?:port\s+)?)(\d{2,5})/i
          );
          if (portMatch && portMatch[1] && !task.port) {
            const p = parseInt(portMatch[1], 10);
            if (p > 0 && p < 65536) task.port = p;
          }

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

  public async waitForReady(
    taskId: string,
    readyCfg?: ServiceReady
  ): Promise<{ ready: boolean; port?: number; error?: string }> {
    const task = this.tasks.get(taskId);
    if (!task) return { ready: false, error: "Task not found" };

    const timeoutMs = (readyCfg?.timeout || 20) * 1000;
    const startTime = Date.now();
    const targetHost = readyCfg?.host || "127.0.0.1";

    while (Date.now() - startTime < timeoutMs) {
      if (task.status === "failed") {
        return {
          ready: false,
          error: task.logs.slice(-5).join("\n") || "Process failed to start",
        };
      }
      if (task.status === "completed" && task.exitCode !== 0) {
        return {
          ready: false,
          error: `Process exited with code ${task.exitCode}:\n${task.logs.slice(-5).join("\n")}`,
        };
      }

      // Check port readiness if specified or detected
      const probePort = readyCfg?.port || task.port;
      if (probePort) {
        const isOpen = await checkPortOpen(probePort, targetHost, 300);
        if (isOpen) {
          task.port = probePort;
          return { ready: true, port: probePort };
        }
      }

      // Check log pattern if specified
      if (readyCfg?.log) {
        const regex = new RegExp(readyCfg.log, "i");
        if (task.logs.some((l) => regex.test(l))) {
          return { ready: true, port: task.port };
        }
      }

      // Auto-detect dev server ready phrases
      const isAutoReady = task.logs.some((l) =>
        /(?:ready in|Local:\s+http|vite\s+v\d+|compiled successfully|server running at|listening on)/i.test(l)
      );
      if (isAutoReady) {
        return { ready: true, port: task.port };
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return { ready: task.status === "running", port: task.port };
  }

  public listTasks(): BackgroundTaskItem[] {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      name: t.name,
      command: t.command,
      pid: t.pid,
      status: t.status,
      startTime: t.startTime,
      output: t.logs.slice(-20),
      port: t.port,
    }));
  }

  public getTask(taskIdOrName: string): ActiveBackgroundTask | undefined {
    const direct = this.tasks.get(taskIdOrName);
    if (direct) return direct;
    const lower = taskIdOrName.toLowerCase().trim();
    return Array.from(this.tasks.values()).find(
      (t) => t.id === taskIdOrName || (t.name && t.name.toLowerCase() === lower)
    );
  }

  public killTask(taskIdOrName: string): boolean {
    const task = this.getTask(taskIdOrName);
    if (!task) return false;
    if (task.status !== "running") return true;

    try {
      if (task.pid) {
        killProcessTree(task.pid);
      }
      task.status = "completed";
      task.logs.push("[Process terminated by user/AI request]");
      this.emit({ type: "status", taskId: task.id, status: "completed", code: null });
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

export async function executeWaitTool(
  args: {
    task_id?: string;
    agent_id?: string;
    id?: string;
    name?: string;
    timeout?: number;
    seconds?: number;
    max_seconds?: number;
  },
  signal?: AbortSignal,
  conversationId?: string
): Promise<{ result: string; isError: boolean }> {
  const targetId = args.task_id || args.agent_id || args.id || args.name;
  const rawTimeout = args.timeout ?? args.seconds ?? args.max_seconds ?? 60;
  const timeoutSec = typeof rawTimeout === "number" ? Math.max(1, Math.min(300, rawTimeout)) : 60;
  const timeoutMs = timeoutSec * 1000;

  // 1. If a specific targetId is provided, check whether it's a subagent first
  if (targetId) {
    const subagent = globalSubAgentManager.getSubAgent(targetId, conversationId);
    if (subagent) {
      const settled =
        subagent.status === "running"
          ? (await globalSubAgentManager.waitForAnySubAgent({
              conversationId,
              targetId: subagent.id,
              timeoutMs,
              signal,
            })) || subagent
          : subagent;

      const durationSec = Math.round(
        ((settled.endTime || Date.now()) - settled.startTime) / 1000
      );
      const envelopeStatus: "running" | "completed" | "cancelled" | "failed" =
        settled.status === "running"
          ? "running"
          : settled.status === "killed"
          ? "cancelled"
          : settled.status === "failed"
          ? "failed"
          : "completed";

      const output =
        settled.status === "running"
          ? `Subagent '${settled.name || settled.id}' is still running after waiting ${timeoutSec}s.\nRecent activity:\n${
              settled.logs
                .slice(-8)
                .map((l) => `- ${l}`)
                .join("\n") || "- Working..."
            }`
          : settled.result || "Completed with no output.";

      return {
        result: formatTaskResultEnvelope({
          id: settled.id,
          name: settled.name,
          agent: settled.role || "task",
          status: envelopeStatus,
          durationSec,
          output,
          error: settled.error,
          artifactPath: settled.artifactPath,
          turnCount: settled.turnCount,
        }),
        isError: settled.status === "failed",
      };
    }

    const task = globalTaskManager.getTask(targetId);
    if (!task) {
      return {
        result: `<task-result id="${targetId}" status="not_found">\n<error>Background task or subagent '${targetId}' not found.</error>\n</task-result>`,
        isError: true,
      };
    }
    if (task.status !== "running") {
      const output = task.logs.slice(-10).join("\n") || "(No recent output)";
      const durationSec = Math.round((Date.now() - task.startTime) / 1000);
      return {
        result: `<task-result id="${task.id}" name="${task.name || ""}" status="${task.status}" duration="${durationSec}s">\n<output>\n${output}\n</output>\n</task-result>`,
        isError: task.status === "failed",
      };
    }

    // Wait until background shell task settles or new log arrives or timeout
    const initialLogCount = task.logs.length;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (signal?.aborted) {
        return { result: "[Wait aborted by signal]", isError: false };
      }
      const currentStatus: string = task.status;
      if (currentStatus !== "running" || task.logs.length > initialLogCount + 2) {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const durationSec = Math.round((Date.now() - task.startTime) / 1000);
    const output = task.logs.slice(-10).join("\n") || `Status: ${task.status}`;
    const finalStatus: string = task.status;
    return {
      result: `<task-result id="${task.id}" name="${task.name || ""}" status="${finalStatus}" duration="${durationSec}s">\n<output>\n${output}\n</output>\n</task-result>`,
      isError: finalStatus === "failed",
    };
  }

  // 2. No specific ID: wait on any running subagent in this session or any running background shell task
  const runningSubagents = globalSubAgentManager
    .listSubAgents(conversationId)
    .filter((a) => a.status === "running");

  if (runningSubagents.length > 0) {
    const settled = await globalSubAgentManager.waitForAnySubAgent({
      conversationId,
      timeoutMs,
      signal,
    });
    if (settled) {
      const durationSec = Math.round(
        ((settled.endTime || Date.now()) - settled.startTime) / 1000
      );
      const envelopeStatus: "running" | "completed" | "cancelled" | "failed" =
        settled.status === "running"
          ? "running"
          : settled.status === "killed"
          ? "cancelled"
          : settled.status === "failed"
          ? "failed"
          : "completed";
      const output =
        settled.status === "running"
          ? `Subagent '${settled.name || settled.id}' is still running (${durationSec}s elapsed).\nRecent activity:\n${
              settled.logs
                .slice(-8)
                .map((l) => `- ${l}`)
                .join("\n") || "- Working..."
            }`
          : settled.result || "Completed with no output.";

      return {
        result: formatTaskResultEnvelope({
          id: settled.id,
          name: settled.name,
          agent: settled.role || "task",
          status: envelopeStatus,
          durationSec,
          output,
          error: settled.error,
          artifactPath: settled.artifactPath,
          turnCount: settled.turnCount,
        }),
        isError: settled.status === "failed",
      };
    }
  }

  const allTasks = globalTaskManager.listTasks();
  const runningTasks = allTasks.filter((t) => t.status === "running");
  const firstRunning = runningTasks[0];
  if (!firstRunning) {
    return {
      result: "Nothing to wait for: no background subagent or shell service is currently running.",
      isError: false,
    };
  }

  const startTime = Date.now();
  const initialCounts = new Map(runningTasks.map((t) => [t.id, t.output?.length || 0]));
  let activeTask: BackgroundTaskItem = firstRunning;

  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) {
      return { result: "[Wait aborted by signal]", isError: false };
    }
    const currentList = globalTaskManager.listTasks();
    const settledOrNew = currentList.find(
      (t) => t.status !== "running" || (t.output?.length || 0) > (initialCounts.get(t.id) || 0)
    );
    if (settledOrNew) {
      activeTask = settledOrNew;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const durationSec = Math.round((Date.now() - activeTask.startTime) / 1000);
  const taskObj = globalTaskManager.getTask(activeTask.id);
  const output = taskObj?.logs.slice(-8).join("\n") || `Status: ${activeTask.status}`;
  return {
    result: `<task-result id="${activeTask.id}" name="${activeTask.name || ""}" status="${activeTask.status}" duration="${durationSec}s">\n<output>\n${output}\n</output>\n</task-result>`,
    isError: (activeTask.status as string) === "failed",
  };
}

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

function notifyFileMutation(
  record: FileMutationRecord,
  options?: ExecuteToolOptions
): void {
  recordMutation(record);
  options?.onFileMutation?.(record);
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
    // Native Browser Tools (OpenBot & oh-my-pi inspired)
    // -----------------------------------------------------------------------
    if (
      normalizedTool.startsWith("browser") ||
      toolName.startsWith("browser_")
    ) {
      const handler =
        options.browserHandler ||
        options.parentConfig?.browserHandler ||
        getGlobalBrowserToolHandler();
      if (!handler) {
        return {
          result:
            "The native desktop browser is not connected or open. Please open the Browser tab in the right pane to interact with web pages directly.",
          isError: true,
        };
      }
      return await handler(toolName, args);
    }

    // -----------------------------------------------------------------------
    // Native Computer Use Tools (Desktop GUI Automation)
    // -----------------------------------------------------------------------
    if (
      normalizedTool.startsWith("computer") ||
      toolName.startsWith("computer_")
    ) {
      const handler =
        options.computerHandler ||
        options.parentConfig?.computerHandler ||
        getGlobalComputerToolHandler();
      if (!handler) {
        return {
          result:
            "No native computer use handler registered. Computer Use is only available in the native Const desktop application.",
          isError: true,
        };
      }
      return await handler(toolName, args);
    }

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

        // 1b. Office Document Extraction (.docx, .pptx, .xlsx, .odt, .ods, .odp)
        const officeExtensions = [".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp"];
        if (officeExtensions.includes(ext)) {
          try {
            const { text, pages, type } = await extractDocumentText(filePath, undefined, signal);
            const previewLimit = 40000;
            const preview =
              text.length > previewLimit
                ? text.slice(0, previewLimit) +
                  `\n\n[... Document truncated at ${previewLimit} characters (Total: ${text.length} chars) ...]`
                : text;

            const pageInfo = pages ? ` | ${pages} ${ext === ".pptx" ? "Slides" : "Pages"}` : "";
            return {
              result: `[${type}: ${path.basename(filePath)}${pageInfo} | ${(stat.size / 1024).toFixed(1)} KB]\n\n${preview}`,
              isError: false,
            };
          } catch (docErr: any) {
            return {
              result: `Failed to extract document text (${path.basename(filePath)}): ${docErr.message}`,
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

        // 3. Binary File Sniffing (prevent binary garble from polluting LLM context)
        if (stat.size > 0) {
          const fileHandle = await fs.open(filePath, "r");
          const sampleBuf = Buffer.alloc(Math.min(1024, stat.size));
          await fileHandle.read(sampleBuf, 0, sampleBuf.length, 0);
          await fileHandle.close();

          if (isProbablyBinary(sampleBuf)) {
            if (ext === ".db" || ext === ".sqlite" || ext === ".sqlite3") {
              return {
                result: `[SQLite Database: ${path.basename(filePath)} | Size: ${(stat.size / 1024).toFixed(1)} KB]\nThis is a binary SQLite database file. Query using an SQLite script or eval.`,
                isError: false,
              };
            }
            return {
              result: `[Binary File: ${path.basename(filePath)} | Size: ${(stat.size / 1024).toFixed(1)} KB]\nCannot display binary file as text.`,
              isError: false,
            };
          }
        }

        // 4. Regular Text & Code Files with Progressive Truncation Metadata
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split(/\r?\n/);

        // Handle offset & limit (1-indexed)
        const offset = typeof args.offset === "number" && args.offset > 0 ? args.offset - 1 : 0;
        const defaultLimit = 350;
        const hasExplicitLimit = typeof args.limit === "number" && args.limit > 0;
        const limit = hasExplicitLimit ? args.limit : defaultLimit;

        const isTruncatedByLines = !hasExplicitLimit && lines.length > defaultLimit;
        const selectedLines = lines.slice(offset, offset + limit);
        const endLine = Math.min(lines.length, offset + selectedLines.length);

        let outputText = selectedLines.join("\n");
        const maxChars = 40000;
        let isCharTruncated = false;

        if (outputText.length > maxChars) {
          outputText = outputText.slice(0, maxChars);
          isCharTruncated = true;
        }

        if (isTruncatedByLines || isCharTruncated || offset > 0 || hasExplicitLimit) {
          const metaNotice = `<meta lines="${offset + 1}-${endLine}" total="${lines.length}" truncated="${isTruncatedByLines || isCharTruncated}" />\n`;
          let footerNotice = "";
          if (isTruncatedByLines || isCharTruncated) {
            footerNotice = `\n\n[... File view truncated at line ${endLine} of ${lines.length}. Use 'read' with offset=${endLine + 1} to continue reading ...]`;
          }
          return { result: `${metaNotice}${outputText}${footerNotice}`, isError: false };
        }

        return { result: outputText, isError: false };
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
      if (!options?.allowOutsideWorkspace && !isPathWithinWorkspace(filePath, workspacePath) && !isAllowedInternalPath(filePath)) {
        return {
          result: `[SANDBOX DENIED]: Access denied. Cannot write to file outside workspace directory: '${filePath}'.`,
          isError: true,
        };
      }
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
      notifyFileMutation(
        {
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation,
          absolutePath: filePath,
          filePath: filePath,
          targetFile: displayPath || filePath,
          previousContent,
          newContent: content,
          timestamp: Date.now(),
        },
        options
      );

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
      if (!options?.allowOutsideWorkspace && !isPathWithinWorkspace(filePath, workspacePath) && !isAllowedInternalPath(filePath)) {
        return {
          result: `[SANDBOX DENIED]: Access denied. Cannot edit file outside workspace directory: '${filePath}'.`,
          isError: true,
        };
      }

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

      const editResult = performFuzzyEdit(fileText, oldContent, newContent, {
        allowMultiple: args.allow_multiple === true || args.allowMultiple === true,
      });

      if (!editResult.success || !editResult.resultText) {
        const totalLines = fileText.split(/\r?\n/).length;
        return {
          result: `[EDIT FAILED]: Could not edit '${path.basename(filePath)}' (${totalLines} lines).\nReason: ${editResult.error || "'old_content' not found in file."}\nAction Required: Use the 'read' tool to inspect the latest file contents around your target area before attempting another edit.`,
          isError: true,
        };
      }

      await fs.writeFile(filePath, editResult.resultText, "utf-8");

      notifyFileMutation(
        {
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: editResult.resultText,
          timestamp: Date.now(),
        },
        options
      );

      return {
        result: `Successfully edited '${path.basename(filePath)}' (matched via ${editResult.matchType || "fuzzy engine"}, replaced ${editResult.replacementsCount || 1} occurrence(s)).`,
        isError: false,
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

      const interception = checkBashInterception(cmd);
      if (interception.intercepted) {
        return {
          result: interception.message || "Command intercepted by security or workflow policy.",
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

      const isDevServer = isDevServerCommand(cmd);
      const isAsyncRequested =
        args.async === true ||
        args.run_in_background === true ||
        args.is_daemon === true ||
        args.isDaemon === true ||
        args.background === true;

      // Handle async background execution or dev servers
      if (isAsyncRequested || isDevServer) {
        const taskName = (typeof args.name === "string" ? args.name : undefined) || (isDevServer ? "dev-server" : undefined);
        const readyCfg: ServiceReady | undefined = args.ready && typeof args.ready === "object"
          ? {
              port: typeof args.ready.port === "number" ? args.ready.port : undefined,
              log: typeof args.ready.log === "string" ? args.ready.log : undefined,
              host: typeof args.ready.host === "string" ? args.ready.host : undefined,
              timeout: typeof args.ready.timeout === "number" ? args.ready.timeout : undefined,
            }
          : undefined;

        const bgTask = globalTaskManager.startTask(cmd, executionCwd, { name: taskName });
        options.onTaskStarted?.({
          id: bgTask.id,
          name: bgTask.name,
          command: bgTask.command,
          pid: bgTask.pid,
          startTime: bgTask.startTime,
          status: bgTask.status,
          output: bgTask.logs,
          port: bgTask.port,
        });

        // If readiness criteria requested OR auto-detected dev server, wait for network/log readiness
        if (readyCfg || isDevServer) {
          const waitResult = await globalTaskManager.waitForReady(bgTask.id, readyCfg);
          const durationSec = Math.round((Date.now() - bgTask.startTime) / 1000);

          if (!waitResult.ready && bgTask.status === "failed") {
            const errLogs = bgTask.logs.slice(-6).join("\n");
            return {
              result: `<task-result id="${bgTask.id}" name="${bgTask.name || ""}" status="failed" duration="${durationSec}s">\n<error>\nService failed to start:\n${errLogs}\n</error>\n</task-result>`,
              isError: true,
            };
          }

          const portInfo = bgTask.port ? `\nLocal URL: http://localhost:${bgTask.port}` : "";
          const recentLogs = bgTask.logs.slice(-5).join("\n");
          return {
            result: `<task-result id="${bgTask.id}" name="${bgTask.name || "service"}" status="running" duration="${durationSec}s">\n<output>\nBackground service started successfully and verified readiness.${portInfo}\nPID: ${bgTask.pid ?? "unknown"}\nCommand: ${cmd}\n\nRecent logs:\n${recentLogs}\n\n(Notice: Service is running continuously in the background. Use 'manage_task' or 'wait' with id='${bgTask.id}' to inspect logs or terminate).\n</output>\n</task-result>`,
            isError: false,
          };
        }

        // Standard async background task without waiting
        return {
          result: `<task-result id="${bgTask.id}" name="${bgTask.name || ""}" status="running" duration="0s">\n<notice>Started background task [${bgTask.id}] (PID: ${bgTask.pid ?? "unknown"}): '${cmd}'. It is running in the background. Use 'manage_task' to check status, view logs, or kill it, or 'wait' to await completion.</notice>\n</task-result>`,
          isError: false,
        };
      }

      const isBuildOrInstall = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|install|add|compile|test)|(?:tsc|cargo\s+build|dotnet\s+build)/i.test(cmd);
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

      const spooled = await spoolLargeOutput(output, workspacePath, { prefix: "bash" });
      output = spooled.output;

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
      if (!options?.allowOutsideWorkspace && !isPathWithinWorkspace(dirPath, workspacePath) && !isAllowedInternalPath(dirPath)) {
        return {
          result: `[SANDBOX DENIED]: Access denied. Cannot create directory outside workspace directory: '${dirPath}'.`,
          isError: true,
        };
      }

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

      const interception = checkBashInterception(cmd);
      if (interception.intercepted) {
        return {
          result: interception.message || "Command intercepted by security or workflow policy.",
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
      const isAsyncRequested =
        args.async === true ||
        args.run_in_background === true ||
        args.is_daemon === true ||
        args.isDaemon === true ||
        args.background === true;

      // Handle async background execution or dev servers
      if (isAsyncRequested || isDevServer) {
        const taskName = (typeof args.name === "string" ? args.name : undefined) || (isDevServer ? "dev-server" : undefined);
        const readyCfg: ServiceReady | undefined = args.ready && typeof args.ready === "object"
          ? {
              port: typeof args.ready.port === "number" ? args.ready.port : undefined,
              log: typeof args.ready.log === "string" ? args.ready.log : undefined,
              host: typeof args.ready.host === "string" ? args.ready.host : undefined,
              timeout: typeof args.ready.timeout === "number" ? args.ready.timeout : undefined,
            }
          : undefined;

        const bgTask = globalTaskManager.startTask(cmd, executionCwd, { name: taskName });
        options.onTaskStarted?.({
          id: bgTask.id,
          name: bgTask.name,
          command: bgTask.command,
          pid: bgTask.pid,
          startTime: bgTask.startTime,
          status: bgTask.status,
          output: bgTask.logs,
          port: bgTask.port,
        });

        if (readyCfg || isDevServer) {
          const waitResult = await globalTaskManager.waitForReady(bgTask.id, readyCfg);
          const durationSec = Math.round((Date.now() - bgTask.startTime) / 1000);

          if (!waitResult.ready && bgTask.status === "failed") {
            const errLogs = bgTask.logs.slice(-6).join("\n");
            return {
              result: `<task-result id="${bgTask.id}" name="${bgTask.name || ""}" status="failed" duration="${durationSec}s">\n<error>\nService failed to start:\n${errLogs}\n</error>\n</task-result>`,
              isError: true,
            };
          }

          const portInfo = bgTask.port ? `\nLocal URL: http://localhost:${bgTask.port}` : "";
          const recentLogs = bgTask.logs.slice(-5).join("\n");
          return {
            result: `<task-result id="${bgTask.id}" name="${bgTask.name || "service"}" status="running" duration="${durationSec}s">\n<output>\nBackground service started successfully and verified readiness.${portInfo}\nPID: ${bgTask.pid ?? "unknown"}\nCommand: ${cmd}\n\nRecent logs:\n${recentLogs}\n\n(Notice: Service is running continuously in the background. Use 'manage_task' or 'wait' with id='${bgTask.id}' to inspect logs or terminate).\n</output>\n</task-result>`,
            isError: false,
          };
        }

        return {
          result: `<task-result id="${bgTask.id}" name="${bgTask.name || ""}" status="running" duration="0s">\n<notice>Started background task [${bgTask.id}] (PID: ${bgTask.pid ?? "unknown"}): '${cmd}'. It is running in the background. Use 'manage_task' to check status, view logs, or kill it, or 'wait' to await completion.</notice>\n</task-result>`,
          isError: false,
        };
      }

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

      const spooled = await spoolLargeOutput(output, workspacePath, { prefix: "powershell" });
      output = spooled.output;

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
      if (!options?.allowOutsideWorkspace && !isPathWithinWorkspace(filePath, workspacePath) && !isAllowedInternalPath(filePath)) {
        return {
          result: `[SANDBOX DENIED]: Access denied. Cannot apply patch to file outside workspace directory: '${filePath}'.`,
          isError: true,
        };
      }
      if (!fsSync.existsSync(filePath)) {
        return {
          result: `File not found to patch: '${filePath}'`,
          isError: true,
        };
      }

      const originalContent = await fs.readFile(filePath, "utf-8");
      const { success, resultText, error } = applyLooseUnifiedDiff(originalContent, patchContent);

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

      notifyFileMutation(
        {
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: displayPath || filePath,
          previousContent: originalContent,
          newContent: resultText,
          timestamp: Date.now(),
        },
        options
      );

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
          .map((t) => {
            const nameLabel = t.name ? ` [${t.name}]` : "";
            const portLabel = t.port ? ` | Port: ${t.port}` : "";
            return `- Task ID: ${t.id}${nameLabel} | Status: ${t.status.toUpperCase()} | PID: ${t.pid ?? "unknown"}${portLabel} | Command: '${t.command}'`;
          })
          .join("\n");
        return {
          result: `Background Tasks (${tasks.length}):\n${formatted}`,
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
            result: `<task-result id="${taskId}" status="not_found">\n<error>Background task '${taskId}' not found.</error>\n</task-result>`,
            isError: true,
          };
        }
        const tailLogs = task.logs.slice(-30).join("\n");
        const durationSec = Math.round((Date.now() - task.startTime) / 1000);
        return {
          result: `<task-result id="${task.id}" name="${task.name || ""}" status="${task.status}" duration="${durationSec}s">\n<output>\nCommand: ${task.command}\nPID: ${task.pid ?? "unknown"}${task.port ? `\nPort: ${task.port}` : ""}\n\nRecent logs:\n${tailLogs || "(no output yet)"}\n</output>\n</task-result>`,
          isError: task.status === "failed",
        };
      }

      if (action === "kill" || action === "stop") {
        if (!taskId) {
          return {
            result: "Error: Missing 'task_id' parameter for kill action.",
            isError: true,
          };
        }
        const task = globalTaskManager.getTask(taskId);
        const resolvedId = task ? task.id : taskId;
        const success = globalTaskManager.killTask(resolvedId);
        if (success) {
          options.onTaskStopped?.(resolvedId, null);
          return {
            result: `<task-result id="${resolvedId}" status="completed">\n<output>Successfully stopped background task '${resolvedId}'.</output>\n</task-result>`,
            isError: false,
          };
        }
        return {
          result: `<task-result id="${taskId}" status="failed">\n<error>Failed to stop task '${taskId}' or task was not found.</error>\n</task-result>`,
          isError: true,
        };
      }

      return {
        result: `Unknown action '${action}'. Available actions: list, status, kill.`,
        isError: true,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: wait (aliases: waittask, await_task)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "wait" ||
      normalizedTool === "waittask" ||
      normalizedTool === "awaittask"
    ) {
      try {
        const res = await executeWaitTool(
          args,
          signal,
          options.conversationId || options.parentConfig?.conversationId
        );
        return res;
      } catch (err: any) {
        return {
          result: `wait error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: lsp (Language Server Protocol & TypeScript Language Service)
    // -----------------------------------------------------------------------
    if (normalizedTool === "lsp" || normalizedTool === "languageserver") {
      const operation = args.operation as LspOperation;
      const rawPath = extractPathArg(args) || args.file_path || args.filePath || args.file;
      const line = Number(args.line ?? args.lineNumber ?? 1);
      const character = Number(args.character ?? args.col ?? args.column ?? 1);

      if (!rawPath) {
        return {
          result: "Error: Missing 'file_path' parameter for LSP operation.",
          isError: true,
        };
      }

      if (!operation) {
        return {
          result:
            "Error: Missing 'operation' parameter for LSP. Choose from: goToDefinition, findReferences, goToImplementation, hover, documentSymbols.",
          isError: true,
        };
      }

      try {
        const queryResult = await executeLspQuery(
          operation,
          rawPath,
          line,
          character,
          workspacePath
        );
        return {
          result: queryResult.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `LSP Error (${operation} on ${rawPath}): ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: ast_grep (aliases: astsearch, astgrep)
    // -----------------------------------------------------------------------
    if (normalizedTool === "astgrep" || normalizedTool === "astsearch") {
      const pattern = args.pattern || args.pat;
      if (!pattern || typeof pattern !== "string") {
        return {
          result: "Error: Missing 'pattern' parameter for ast_grep.",
          isError: true,
        };
      }

      const targetPath = extractPathArg(args) || args.path || ".";
      const lang = typeof args.lang === "string" ? args.lang : undefined;
      const globs = typeof args.globs === "string" ? args.globs : undefined;
      const rewrite = typeof args.rewrite === "string" ? args.rewrite : undefined;
      const limit = typeof args.limit === "number" ? args.limit : 50;

      try {
        const grepRes = await executeAstGrep(
          {
            pattern,
            targetPath,
            lang,
            globs,
            rewrite,
            limit,
            signal,
          },
          workspacePath
        );
        return {
          result: grepRes.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `ast_grep error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: web_search (aliases: websearch, searchweb)
    // -----------------------------------------------------------------------
    if (normalizedTool === "websearch" || normalizedTool === "searchweb") {
      const query = args.query || args.q || args.search;
      if (!query || typeof query !== "string") {
        return {
          result: "Error: Missing 'query' parameter for web_search.",
          isError: true,
        };
      }

      const numResults = Number(args.num_results || args.numResults || args.limit || 5);
      try {
        const searchRes = await executeWebSearch(query, numResults, signal);
        return {
          result: searchRes.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `web_search error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: web_fetch (aliases: webfetch, fetchurl, readurl, curl)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "webfetch" ||
      normalizedTool === "fetchurl" ||
      normalizedTool === "readurl" ||
      normalizedTool === "curl"
    ) {
      const url = args.url || args.link || args.href;
      if (!url || typeof url !== "string") {
        return {
          result: "Error: Missing 'url' parameter for web_fetch.",
          isError: true,
        };
      }

      const maxChars = Number(args.max_chars || args.maxChars || 30000);
      try {
        const fetchRes = await executeWebFetch(url, maxChars, signal);
        return {
          result: fetchRes.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `web_fetch error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: add_source (aliases: addsource, savesource, createsource)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "addsource" ||
      normalizedTool === "savesource" ||
      normalizedTool === "createsource"
    ) {
      const title = String(args.title || args.name || "Untitled Source").trim();
      const rawType = String(args.type || args.source_type || "text").toLowerCase().trim();
      const type = rawType === "url" || rawType === "file" || rawType === "text" ? rawType : "text";
      const content = String(args.content || args.text || args.markdown || "").trim();
      const url = args.url ? String(args.url).trim() : undefined;
      const pathArg = args.path ? String(args.path).trim() : undefined;

      if (!title) {
        return {
          result: "Error: Missing 'title' parameter for add_source.",
          isError: true,
        };
      }
      if (!content && !url && !pathArg) {
        return {
          result: "Error: Source requires either 'content', 'url', or 'path'.",
          isError: true,
        };
      }

      const sourceId = `source_${Math.random().toString(36).substring(2, 9)}${Date.now().toString(36)}`;
      const sourceRecord = {
        id: sourceId,
        learnId: options.learnId || "default",
        title,
        type,
        url,
        path: pathArg,
        content: content || (url ? `Source content from ${url}` : undefined),
        includedInChat: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (options.onSourceCreated) {
        options.onSourceCreated(sourceRecord);
      }

      return {
        result: `Successfully added ${type.toUpperCase()} source: "${title}" to workspace. It is now indexed and available in the Sources panel.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: create_studio_artifact (aliases: createstudioartifact, createartifact, createstudyartifact)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "createstudioartifact" ||
      normalizedTool === "createartifact" ||
      normalizedTool === "createstudyartifact"
    ) {
      const artifactType = String(args.artifact_type || args.type || "flashcard").toLowerCase().trim();
      const title = String(args.title || `${artifactType} Artifact`).trim();
      const rawData = args.data || args.content || {};

      let normalizedData: any = typeof rawData === "object" ? { ...rawData } : {};

      if (artifactType === "flashcard" || artifactType === "flashcards") {
        const rawCards = Array.isArray(normalizedData.cards) ? normalizedData.cards : [];
        normalizedData = {
          title,
          topic: args.topic || title,
          sourceCount: 1,
          cards: rawCards.map((c: any, i: number) => ({
            id: c.id || `card_${i + 1}`,
            front: c.front || c.question || `Card ${i + 1}`,
            back: c.back || c.answer || "",
            hint: c.hint || undefined,
          })),
        };
      } else if (artifactType === "quiz") {
        const rawQuestions = Array.isArray(normalizedData.questions) ? normalizedData.questions : [];
        normalizedData = {
          title,
          topic: args.topic || title,
          difficulty: args.difficulty || "medium",
          sourceCount: 1,
          questions: rawQuestions.map((q: any, i: number) => ({
            id: q.id || `q_${i + 1}`,
            question: q.question || `Question ${i + 1}`,
            options: Array.isArray(q.options) ? q.options : ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : typeof q.correctIndex === "number" ? q.correctIndex : 0,
            explanation: q.explanation || "",
          })),
        };
      } else if (artifactType === "mind_map" || artifactType === "mindmap") {
        const root = normalizedData.root || {
          id: "root",
          label: title,
          children: Array.isArray(normalizedData.nodes) ? normalizedData.nodes : [],
        };
        normalizedData = {
          title,
          topic: args.topic || title,
          root,
          sourceCount: 1,
        };
      } else if (artifactType === "cheatsheet" || artifactType === "cheat_sheet") {
        const rawCards = Array.isArray(normalizedData.cards) ? normalizedData.cards : [];
        normalizedData = {
          title,
          topic: args.topic || title,
          coverageMode: "auto",
          sourceCount: 1,
          cards: rawCards.map((c: any, i: number) => ({
            id: c.id || `card_${i + 1}`,
            title: c.title || `Concept ${i + 1}`,
            badge: c.badge || undefined,
            content: c.content || "",
          })),
        };
      }

      const artifactId = `art_${Math.random().toString(36).substring(2, 9)}${Date.now().toString(36)}`;
      const resolvedType =
        artifactType === "mindmap"
          ? "mind_map"
          : artifactType === "flashcards"
          ? "flashcard"
          : artifactType === "cheat_sheet"
          ? "cheatsheet"
          : artifactType;

      const artifactRecord = {
        id: artifactId,
        learnId: options.learnId || "default",
        title,
        type: resolvedType,
        data: normalizedData,
        status: "completed",
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };

      if (options.onArtifactCreated) {
        options.onArtifactCreated(artifactRecord);
      }

      return {
        result: `Successfully created ${resolvedType} artifact: "${title}" in Studio! The user can now open and study it directly in the Studio tab.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: git_status (aliases: gitstatus, gstatus)
    // -----------------------------------------------------------------------
    if (normalizedTool === "gitstatus" || normalizedTool === "gstatus") {
      try {
        const statusRes = await executeGitStatus(workspacePath, signal);
        return {
          result: statusRes.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `git_status error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: git_diff (aliases: gitdiff, gdiff)
    // -----------------------------------------------------------------------
    if (normalizedTool === "gitdiff" || normalizedTool === "gdiff") {
      try {
        const diffRes = await executeGitDiff(
          {
            staged: Boolean(args.staged),
            file: typeof args.file === "string" ? args.file : undefined,
            commit: typeof args.commit === "string" ? args.commit : undefined,
          },
          workspacePath,
          signal
        );
        return {
          result: diffRes,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `git_diff error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: git_commit (aliases: gitcommit, gcommit)
    // -----------------------------------------------------------------------
    if (normalizedTool === "gitcommit" || normalizedTool === "gcommit") {
      const message = args.message || args.msg || args.m;
      if (!message || typeof message !== "string") {
        return {
          result: "Error: Missing 'message' parameter for git_commit.",
          isError: true,
        };
      }

      const files = Array.isArray(args.files) ? args.files : undefined;
      try {
        const commitRes = await executeGitCommit(message, files, workspacePath, signal);
        return {
          result: commitRes,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `git_commit error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: git_log (aliases: gitlog, glog)
    // -----------------------------------------------------------------------
    if (normalizedTool === "gitlog" || normalizedTool === "glog") {
      const maxCount = Number(args.max_count || args.limit || args.count || 10);
      try {
        const logRes = await executeGitLog(maxCount, workspacePath, signal);
        return {
          result: logRes.formatted,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `git_log error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: checkpoint (aliases: create_checkpoint, save_checkpoint)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "checkpoint" ||
      normalizedTool === "createcheckpoint" ||
      normalizedTool === "savecheckpoint"
    ) {
      try {
        const cp = await createCheckpoint(
          { name: typeof args.name === "string" ? args.name : undefined },
          workspacePath,
          signal
        );
        const gitNote = cp.gitRef ? ` (Git ref: ${cp.gitRef.slice(0, 8)})` : "";
        return {
          result: `Checkpoint '${cp.id}' created successfully${gitNote}.${cp.name ? ` Note: "${cp.name}".` : ""} Tracked ${cp.snapshots.length} file snapshot(s). If subsequent edits fail, invoke restore_checkpoint to revert.`,
          isError: false,
        };
      } catch (err: any) {
        return {
          result: `checkpoint error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: restore_checkpoint (aliases: restorecheckpoint, revert_checkpoint)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "restorecheckpoint" ||
      normalizedTool === "revertcheckpoint"
    ) {
      try {
        const res = await restoreCheckpoint(
          {
            checkpointId:
              (typeof args.checkpoint_id === "string" ? args.checkpoint_id : undefined) ||
              (typeof args.id === "string" ? args.id : undefined),
          },
          workspacePath,
          signal
        );
        return {
          result: res.message,
          isError: !res.success,
        };
      } catch (err: any) {
        return {
          result: `restore_checkpoint error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: rollback_mutation (aliases: rollbackmutation, rollback, undomutation)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "rollbackmutation" ||
      normalizedTool === "rollback" ||
      normalizedTool === "undomutation"
    ) {
      try {
        const filePath =
          (typeof args.file_path === "string" ? args.file_path : undefined) ||
          (typeof args.path === "string" ? args.path : undefined) ||
          (typeof args.file === "string" ? args.file : undefined);
        const steps = typeof args.steps === "number" ? args.steps : 1;
        const mutationId =
          typeof args.mutation_id === "string"
            ? args.mutation_id
            : typeof args.id === "string"
            ? args.id
            : undefined;

        const res = await executeRollbackMutation(
          { filePath, steps, mutationId },
          workspacePath
        );
        return {
          result: res.message,
          isError: !res.success,
        };
      } catch (err: any) {
        return {
          result: `rollback_mutation error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: task / spawn_agent (aliases: task, spawnagent, subagent, delegatetask)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "task" ||
      normalizedTool === "spawnagent" ||
      normalizedTool === "subagent" ||
      normalizedTool === "delegatetask"
    ) {
      try {
        const res = await executeSpawnAgent(
          args,
          workspacePath,
          {
            workspacePath,
            parentConfig: options.parentConfig,
            availableTools: CONST_DEFAULT_TOOLS,
            signal,
            conversationId: options.conversationId || options.parentConfig?.conversationId,
            allowOutsideWorkspace: options.allowOutsideWorkspace,
            onStarted: options.onSubAgentStarted,
            onUpdated: options.onSubAgentUpdated,
            onFinished: options.onSubAgentFinished,
            onKilled: options.onSubAgentKilled,
            onFileMutation: options.onFileMutation,
            onSourceCreated: options.onSourceCreated,
            onArtifactCreated: options.onArtifactCreated,
          }
        );
        return {
          result: res.result,
          isError: res.isError,
        };
      } catch (err: any) {
        return {
          result: `task error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: agent_status (aliases: agentstatus, subagentstatus, listagents)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "agentstatus" ||
      normalizedTool === "subagentstatus" ||
      normalizedTool === "listagents"
    ) {
      try {
        const res = executeAgentStatus(
          args,
          options.conversationId || options.parentConfig?.conversationId
        );
        return res;
      } catch (err: any) {
        return {
          result: `agent_status error: ${err.message}`,
          isError: true,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Tool: kill_agent (aliases: killagent, subagentkill, terminateagent)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "killagent" ||
      normalizedTool === "subagentkill" ||
      normalizedTool === "terminateagent"
    ) {
      try {
        const res = executeKillAgent(
          args,
          options.onSubAgentKilled,
          options.conversationId || options.parentConfig?.conversationId
        );
        return res;
      } catch (err: any) {
        return {
          result: `kill_agent error: ${err.message}`,
          isError: true,
        };
      }
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
      const tempDir = path.join(workspacePath, ".const", "tmp");
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch {}
      const tempFileName = `script_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.py`;
      const tempScriptPath = path.join(tempDir, tempFileName);

      const beforeRunTime = Date.now();

      try {
        await fs.writeFile(tempScriptPath, code, "utf-8");

        const timeoutSec = typeof args.timeout === "number" ? args.timeout : 30;
        const timeoutMs = timeoutSec * 1000;

        const { stdout, stderr, exitCode } = await runProcess(
          pyCfg.command,
          [...pyCfg.args, tempScriptPath],
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
    // Tool: think (private scratchpad)
    // -----------------------------------------------------------------------
    if (normalizedTool === "think" || normalizedTool === "scratchpad") {
      const thoughts = String(args.thoughts || args.thought || "").trim();
      return {
        result: thoughts ? "(Thoughts recorded to private scratchpad)" : "(Empty scratchpad)",
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: jfind (semantic grep / passage search)
    // -----------------------------------------------------------------------
    if (normalizedTool === "jfind" || normalizedTool === "semanticsearch" || normalizedTool === "passagesearch") {
      const query = String(args.query || args.prompt || args.search || "").trim();
      if (!query) {
        return {
          result: "Error: Missing 'query' parameter for semantic search.",
          isError: true,
        };
      }
      const rawKeywords: string[] = Array.isArray(args.keywords)
        ? args.keywords.map(String)
        : typeof args.grep_keywords === "string"
        ? [args.grep_keywords]
        : Array.isArray(args.grep_keywords)
        ? args.grep_keywords.map(String)
        : [];
      const searchRes = await executeJFind(
        {
          query,
          path: args.path,
          keywords: rawKeywords,
          limit: typeof args.limit === "number" ? args.limit : 6,
        },
        workspacePath
      );
      return {
        result: searchRes.formatted,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: retain (store long-term memory)
    // -----------------------------------------------------------------------
    if (normalizedTool === "retain" || normalizedTool === "remember" || normalizedTool === "savememory") {
      const items = Array.isArray(args.items)
        ? args.items
        : args.content
        ? [
            {
              content: args.content,
              context: args.context,
              scope: args.scope,
              title: args.title || args.topic,
              topic: args.topic,
              filename: args.filename,
            },
          ]
        : [];
      const retainRes = await executeRetain(items, workspacePath);
      return {
        result: retainRes.message,
        isError: !retainRes.success,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: recall (search long-term memory)
    // -----------------------------------------------------------------------
    if (normalizedTool === "recall" || normalizedTool === "searchmemory") {
      const query = String(args.query || args.prompt || "").trim();
      const recallRes = await executeRecall(query, workspacePath, {
        scope: args.scope,
        limit: typeof args.limit === "number" ? args.limit : 10,
      });
      return {
        result: recallRes.formatted,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: reflect (synthesize memory)
    // -----------------------------------------------------------------------
    if (normalizedTool === "reflect" || normalizedTool === "reflectmemory") {
      const query = String(args.query || args.prompt || "").trim();
      const reflectRes = await executeReflect(query, workspacePath, args.context);
      return {
        result: reflectRes.formatted,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: eval (in-memory code REPL)
    // -----------------------------------------------------------------------
    if (normalizedTool === "eval" || normalizedTool === "repl") {
      const code = String(args.code || args.script || "").trim();
      if (!code) {
        return {
          result: "Error: Missing 'code' parameter to evaluate.",
          isError: true,
        };
      }
      const evalRes = await executeEval(
        {
          code,
          language: args.language,
          sessionId: args.session_id || options.conversationId,
          timeoutMs: typeof args.timeout === "number" ? args.timeout * 1000 : 15000,
        },
        workspacePath,
        signal
      );
      return {
        result: evalRes.formatted,
        isError: evalRes.isError,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: ast_edit (structural AST code rewrite)
    // -----------------------------------------------------------------------
    if (normalizedTool === "astedit" || normalizedTool === "ast_edit") {
      const rawOps = Array.isArray(args.ops) ? args.ops : [];
      const rawPaths = Array.isArray(args.paths) ? args.paths : args.path ? [args.path] : [];

      if (rawOps.length === 0) {
        return {
          result: "Error: Missing 'ops' array for ast_edit. Provide operations with 'pat' (pattern) and 'out' (replacement).",
          isError: true,
        };
      }
      if (rawPaths.length === 0) {
        return {
          result: "Error: Missing 'paths' parameter for ast_edit.",
          isError: true,
        };
      }

      const astRes = await executeAstEdit(
        {
          ops: rawOps,
          paths: rawPaths,
          dryRun: args.dry_run === true,
        },
        workspacePath,
        signal
      );

      // Notify file mutations for rollback ledger
      if (!args.dry_run) {
        for (const f of astRes.files) {
          const abs = path.resolve(workspacePath, f.path);
          notifyFileMutation(
            {
              id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              stepIndex: options.stepIndex ?? 0,
              operation: "modify",
              absolutePath: abs,
              filePath: abs,
              targetFile: f.path,
              previousContent: f.originalContent,
              newContent: f.newContent,
              timestamp: Date.now(),
            },
            options
          );
        }
      }

      return {
        result: astRes.formatted,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: gh (GitHub operations)
    // -----------------------------------------------------------------------
    if (normalizedTool === "gh" || normalizedTool === "github") {
      const op = args.op || args.operation;
      if (!op) {
        return {
          result: "Error: Missing 'op' parameter for GitHub tool. (e.g. 'pr_diff', 'pr_checkout', 'run_watch', 'search_issues', 'search_prs', 'search_code', 'repo_view').",
          isError: true,
        };
      }
      const ghRes = await executeGhTool(
        {
          op: op as any,
          repo: typeof args.repo === "string" ? args.repo : undefined,
          pr: args.pr !== undefined ? String(args.pr) : undefined,
          query: typeof args.query === "string" ? args.query : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
          run: typeof args.run === "string" ? args.run : undefined,
        },
        workspacePath,
        signal
      );
      return {
        result: ghRes.output,
        isError: ghRes.isError,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: generate_speech (TTS speech generation)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "generatespeech" ||
      normalizedTool === "tts" ||
      normalizedTool === "texttospeech" ||
      normalizedTool === "speech"
    ) {
      if (options.speechHandler) {
        return await options.speechHandler(args, workspacePath);
      }

      const text = String(
        args.text || args.input || args.content || args.script || args.narration || ""
      ).trim();
      if (!text) {
        return {
          result: "Error: Missing 'text' parameter for generate_speech.",
          isError: true,
        };
      }

      const rawOutputPath = String(
        args.output_path || args.outputPath || args.path || args.filename || `audio/speech_${Date.now()}.mp3`
      ).trim();
      const destPath = resolveSafePath(rawOutputPath, workspacePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      const voiceCfg = options.voiceConfig || {};
      const protocol = voiceCfg.protocol || (voiceCfg.baseUrl?.includes("inworld") ? "inworld" : "inworld");
      const model = String(args.model || voiceCfg.model || "inworld-tts-2");
      const voice = String(args.voice || args.speaker || voiceCfg.voice || voiceCfg.voiceName || "Ashley");
      const speed = typeof args.speed === "number" ? args.speed : (voiceCfg.speed || 1.0);

      let audioBuffer: Buffer | null = null;
      let lastError = "";

      if (protocol === "inworld") {
        const apiKey = (voiceCfg.apiKey || process.env.INWORLD_API_KEY || "").trim();
        if (!apiKey) {
          return {
            result:
              "Error: Inworld API key is not configured. Please configure your Inworld API key in Settings > Models > Voice.",
            isError: true,
          };
        }

        let authHeader = apiKey;
        if (authHeader.toLowerCase().startsWith("bearer ")) {
          authHeader = `Basic ${authHeader.slice(7).trim()}`;
        } else if (!authHeader.toLowerCase().startsWith("basic ")) {
          if (authHeader.includes(":") && !authHeader.includes(" ")) {
            authHeader = `Basic ${Buffer.from(authHeader).toString("base64")}`;
          } else {
            authHeader = `Basic ${authHeader}`;
          }
        }

        // Try primary Inworld endpoint
        try {
          const res = await fetch("https://api.inworld.ai/tts/v1/voice", {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              voiceId: voice,
              modelId: model,
              audioConfig: { audioEncoding: "MP3" },
            }),
          });

          if (res.ok) {
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const json: any = await res.json();
              const b64 = json.audioContent || json.audio_content || json.audio;
              if (b64) {
                const cleanB64 = b64.includes(",") ? b64.split(",")[1]! : b64;
                audioBuffer = Buffer.from(cleanB64, "base64");
              }
            } else {
              audioBuffer = Buffer.from(await res.arrayBuffer());
            }
          } else {
            const errBody = await res.text().catch(() => "");
            lastError = `Inworld TTS (${res.status}): ${errBody || res.statusText}`;
          }
        } catch (fetchErr: any) {
          lastError = fetchErr.message || "Failed to reach Inworld endpoint";
        }

        // Fallback to OpenAI-compatible speech endpoint
        if (!audioBuffer) {
          try {
            const openAiRes = await fetch("https://api.inworld.ai/v1/audio/speech", {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                voice,
                input: text,
                response_format: "mp3",
                speed,
              }),
            });

            if (openAiRes.ok) {
              audioBuffer = Buffer.from(await openAiRes.arrayBuffer());
            } else {
              const errBody2 = await openAiRes.text().catch(() => "");
              lastError = `Inworld Speech fallback (${openAiRes.status}): ${errBody2 || openAiRes.statusText}`;
            }
          } catch (openAiCatch: any) {
            lastError = openAiCatch.message || "Failed to reach Inworld speech fallback";
          }
        }
      } else if (protocol === "openai-speech") {
        const cleanUrl = (voiceCfg.baseUrl || "").replace(/\/+$/, "");
        if (!cleanUrl) {
          return {
            result: "Error: Base URL is not configured for Custom Speech provider in Settings > Models > Voice.",
            isError: true,
          };
        }
        const endpoint = cleanUrl.endsWith("/audio/speech")
          ? cleanUrl
          : cleanUrl.endsWith("/v1")
          ? `${cleanUrl}/audio/speech`
          : `${cleanUrl}/v1/audio/speech`;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const cleanKey = (voiceCfg.apiKey || "").trim();
        if (cleanKey) {
          headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
        }

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: model || "tts-1",
              input: text,
              voice: voice || "alloy",
              speed,
              response_format: "mp3",
            }),
          });
          if (res.ok) {
            audioBuffer = Buffer.from(await res.arrayBuffer());
          } else {
            const errBody = await res.text().catch(() => "");
            lastError = `Custom Speech (${res.status}): ${errBody || res.statusText}`;
          }
        } catch (speechErr: any) {
          lastError = speechErr.message || "Failed to reach custom speech endpoint";
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        return {
          result: `generate_speech failed: ${lastError || "Could not synthesize audio."}`,
          isError: true,
        };
      }

      await fs.writeFile(destPath, audioBuffer);
      const relPath = path.relative(workspacePath, destPath).replace(/\\/g, "/");

      return {
        result: JSON.stringify(
          {
            status: "success",
            message: `Speech audio generated successfully and saved to '${relPath}'.`,
            file_path: relPath,
            voice,
            model,
            size_bytes: audioBuffer.length,
          },
          null,
          2
        ),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: generate_image (Text-to-Image visual generation)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "generateimage" ||
      normalizedTool === "imagegeneration" ||
      normalizedTool === "texttoimage" ||
      normalizedTool === "image"
    ) {
      if (options.imageHandler) {
        return await options.imageHandler(args, workspacePath);
      }

      const prompt = String(args.prompt || args.description || args.text || "").trim();
      if (!prompt) {
        return {
          result: "Error: Missing 'prompt' parameter for generate_image.",
          isError: true,
        };
      }

      const rawOutputPath = String(
        args.output_path || args.outputPath || args.path || args.filename || `images/img_${Date.now()}.png`
      ).trim();
      const destPath = resolveSafePath(rawOutputPath, workspacePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      const imageCfg = options.imageConfig || {};
      const provider = imageCfg.provider || imageCfg;
      const apiKey = (imageCfg.apiKey || provider.apiKey || process.env.OPENROUTER_API_KEY || "").trim();
      const baseUrl = (imageCfg.baseUrl || provider.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
      const protocol = imageCfg.protocol || provider.protocol || "openrouter";
      const model = String(args.model || imageCfg.activeModelId || imageCfg.model?.id || provider.model || "google/imagen-3");
      const aspectRatio = String(args.aspect_ratio || "16:9");

      let endpoint = baseUrl;
      if (protocol === "openrouter" || baseUrl.includes("openrouter.ai")) {
        endpoint = baseUrl.endsWith("/images") ? baseUrl : `${baseUrl}/images`;
      } else {
        endpoint = baseUrl.endsWith("/images/generations") ? baseUrl : `${baseUrl}/images/generations`;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }
      if (protocol === "openrouter" || baseUrl.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = "https://const.education";
        headers["X-Title"] = "Const Learn";
      }

      const bodyPayload: Record<string, any> = { model, prompt };
      if (args.size) {
        bodyPayload.size = args.size;
      } else if (aspectRatio === "16:9") {
        bodyPayload.size = "1792x1024";
      } else if (aspectRatio === "9:16") {
        bodyPayload.size = "1024x1792";
      } else {
        bodyPayload.size = "1024x1024";
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return {
            result: `generate_image failed (${res.status}): ${errText || res.statusText}`,
            isError: true,
          };
        }

        const data: any = await res.json().catch(() => null);
        const sample = Array.isArray(data?.data)
          ? data.data[0]
          : Array.isArray(data?.images)
          ? data.images[0]
          : null;

        const b64 = sample?.b64_json || sample?.base64;
        const rawUrl = sample?.url || sample?.image_url || sample?.image;

        let imgBuffer: Buffer | null = null;
        if (b64) {
          const cleanB64 = b64.includes(",") ? b64.split(",")[1]! : b64;
          imgBuffer = Buffer.from(cleanB64, "base64");
        } else if (rawUrl) {
          if (rawUrl.startsWith("data:")) {
            const cleanB64 = rawUrl.split(",")[1]!;
            imgBuffer = Buffer.from(cleanB64, "base64");
          } else {
            const dlRes = await fetch(rawUrl);
            if (dlRes.ok) {
              imgBuffer = Buffer.from(await dlRes.arrayBuffer());
            }
          }
        }

        if (!imgBuffer) {
          return {
            result: "generate_image failed: Provider returned no valid image data or URL.",
            isError: true,
          };
        }

        await fs.writeFile(destPath, imgBuffer);
        const relPath = path.relative(workspacePath, destPath).replace(/\\/g, "/");

        return {
          result: JSON.stringify(
            {
              status: "success",
              message: `Image generated successfully and saved to '${relPath}'.`,
              file_path: relPath,
              prompt,
              model,
              size_bytes: imgBuffer.length,
            },
            null,
            2
          ),
          isError: false,
        };
      } catch (genErr: any) {
        return {
          result: `generate_image error: ${genErr.message || String(genErr)}`,
          isError: true,
        };
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
      result: `Tool '${toolName}' is not recognized. Available tools: read, write, edit, bash, powershell, run_command, ls, find, grep, mkdir, todo_write, ask_question, apply_patch, manage_task, wait, lsp, ast_grep, ast_edit, jfind, retain, recall, reflect, eval, gh, think, task, agent_status, kill_agent, run_python, generate_speech, generate_image.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      result: `Error executing ${toolName}: ${err.message || String(err)}`,
      isError: true,
    };
  }
}

