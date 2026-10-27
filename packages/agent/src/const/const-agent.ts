
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveSkillRegistry, pluginInvocationInstructions } from "./skill-registry.js";
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  ToolCall,
  ApprovalDecision,
  ApprovalRequestData,
  ApprovalResponseData,
} from "./types.js";
import {
  CONST_DEFAULT_TOOLS,
  CONST_LEARN_TOOLS,
  executeNativeTool,
  extractCommandArg,
  extractPathArg,
  resolveSafePath,
  isPathWithinWorkspace,
} from "./tools.js";
import { globalSubAgentManager, formatTaskResultEnvelope } from "./subagent.js";
import {
  calculateContextBreakdown,
  calculateContextOccupancy,
} from "./token-meter.js";
import { trackLlmRequest } from "./request-telemetry.js";
import { DEFAULT_MODELS } from "./models.js";
import { getToolActionKind, normalizeToolName } from "./tool-policy.js";
import { appendToolObservations, disableToolObservationImages, UNAVAILABLE_TOOL_VISION, type ToolObservation } from "./tool-observations.js";

function parseToolArguments(rawArgs: any): Record<string, any> {
  if (!rawArgs) return {};
  if (typeof rawArgs === "object") return rawArgs;
  if (typeof rawArgs !== "string") return {};
  let trimmed = rawArgs.trim();

  // Strip markdown code fences if model wrapped json in ```json ... ```
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Attempt fallback for common JSON syntax errors like trailing commas
    try {
      const sanitized = trimmed.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(sanitized);
    } catch {
      return { raw: rawArgs };
    }
  }
}

// ---------------------------------------------------------------------------
// Thinking Stream Filter (Eliminates <think>...</think> leaks in streaming)
// ---------------------------------------------------------------------------

export interface ThinkingFilterResult {
  content: string;
  thinking: string;
}

export class ThinkingStreamFilter {
  private inThink = false;
  private buffer = "";

  public push(chunk: string): ThinkingFilterResult {
    this.buffer += chunk;
    let content = "";
    let thinking = "";

    while (this.buffer.length > 0) {
      if (!this.inThink) {
        const openMatch = this.buffer.match(/<(think|thought|reasoning|thought_process|scratchpad|antthinking|plan|internal_thought)>/i);
        if (openMatch && openMatch.index !== undefined) {
          const index = openMatch.index;
          content += this.buffer.slice(0, index);
          this.buffer = this.buffer.slice(index + openMatch[0].length);
          this.inThink = true;
          continue;
        }

        // Catch orphan closing tags if open tag was missed or truncated
        const orphanCloseMatch = this.buffer.match(/<\/(think|thought|reasoning|thought_process|scratchpad|antthinking|plan|internal_thought)>/i);
        if (orphanCloseMatch && orphanCloseMatch.index !== undefined) {
          const index = orphanCloseMatch.index;
          thinking += this.buffer.slice(0, index);
          this.buffer = this.buffer.slice(index + orphanCloseMatch[0].length);
          this.inThink = false;
          continue;
        }

        const partialMatch = this.buffer.match(/<(?:\/?)(?:t(?:h(?:i(?:n(?:k)?)?)?|h(?:o(?:u(?:g(?:h(?:t)?)?)?)?)?)|r(?:e(?:a(?:s(?:o(?:n(?:i(?:n(?:g)?)?)?)?)?)?)?)?|s(?:c(?:r(?:a(?:t(?:c(?:h(?:p(?:a(?:d)?)?)?)?)?)?)?)?)?)$/i);
        if (partialMatch && partialMatch[0].startsWith("<") && !partialMatch[0].startsWith("</") && partialMatch.index !== undefined) {
          const partialIndex = partialMatch.index;
          content += this.buffer.slice(0, partialIndex);
          this.buffer = this.buffer.slice(partialIndex);
          break;
        }

        content += this.buffer;
        this.buffer = "";
      } else {
        const closeMatch = this.buffer.match(/<\/(think|thought|reasoning|thought_process|scratchpad|antthinking|plan|internal_thought)>/i);
        if (closeMatch && closeMatch.index !== undefined) {
          const index = closeMatch.index;
          thinking += this.buffer.slice(0, index);
          this.buffer = this.buffer.slice(index + closeMatch[0].length);
          this.inThink = false;
          continue;
        }

        const partialClose = this.buffer.match(/<\/(?:t(?:h(?:i(?:n(?:k)?)?)?|h(?:o(?:u(?:g(?:h(?:t)?)?)?)?)?)|r(?:e(?:a(?:s(?:o(?:n(?:i(?:n(?:g)?)?)?)?)?)?)?)?)$/i);
        if (partialClose && partialClose.index !== undefined) {
          const partialIndex = partialClose.index;
          thinking += this.buffer.slice(0, partialIndex);
          this.buffer = this.buffer.slice(partialIndex);
          break;
        }

        thinking += this.buffer;
        this.buffer = "";
      }
    }

    return { content, thinking };
  }

  public flush(): ThinkingFilterResult {
    let content = "";
    let thinking = "";
    if (this.buffer.length > 0) {
      if (this.inThink) {
        thinking += this.buffer;
      } else {
        content += this.buffer;
      }
      this.buffer = "";
    }
    return { content, thinking };
  }
}

// ---------------------------------------------------------------------------
// Fallback Tool Call Extractor (Catches text-embedded JSON or XML tool calls)
// ---------------------------------------------------------------------------

const VALID_FALLBACK_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "ls",
  "find",
  "grep",
  "mkdir",
  "todo_write",
  "ask_question",
  "apply_patch",
  "run_command",
  "manage_task",
  "wait",
  "task",
  "spawn_agent",
  "subagent",
  "delegate_task",
  "agent_status",
  "kill_agent",
  "lsp",
  "ast_grep",
  "web_search",
  "web_fetch",
  "git_status",
  "git_diff",
  "git_log",
  "run_python",
  "python",
  "canva_mcp_generate_design",
  "canva_generate_design",
  "canva_mcp_create_design_from_candidate",
  "canva_create_design_from_candidate",
  "google_sheets_manage",
  "google_docs_manage",
  "google_slides_manage",
  "google_drive_search",
  "google_tasks_manage",
  "google_classroom_manage",
  "google_forms_manage",
  "youtube_search_and_transcribe",
  "code_interpreter",
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_key",
  "browser_scroll",
  "browser_screenshot",
  "browser_console",
  "browser_evaluate",
  "browser_tabs",
  "browser_request_help",
  "browser_wait_for",
  "browser_verify_text",
  "browser_find",
  "browser_hover",
  "browser_paste",
]);

export function extractFallbackToolCalls(content: string, declaredTools?: ReadonlySet<string>): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const allowed = (name: string) => VALID_FALLBACK_TOOLS.has(name) || declaredTools?.has(name);
  if (!content || typeof content !== "string") return toolCalls;

  // Pattern 1: <tool_call>...</tool_call>
  const tagRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(content)) !== null) {
    if (!tagMatch[1]) continue;
    try {
      const parsed = JSON.parse(tagMatch[1].trim());
      const name = (parsed.name || parsed.tool || parsed.function?.name || "").toLowerCase();
      const args = parsed.arguments || parsed.parameters || parsed.args || parsed.function?.arguments || {};
      if (name && allowed(name)) {
        toolCalls.push({
          id: `fallback_${Date.now()}_${toolCalls.length}`,
          type: "function",
          function: {
            name,
            arguments: typeof args === "string" ? args : JSON.stringify(args),
          },
        });
      }
    } catch {}
  }
  if (toolCalls.length > 0) return toolCalls;

  // Pattern 2: ```json { "name" / "tool": "write", "arguments" / "parameters": { ... } } ```
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    if (!blockMatch[1]) continue;
    try {
      const parsed = JSON.parse(blockMatch[1].trim());
      const name = (parsed.name || parsed.tool || (parsed.action === "command" ? "bash" : "")).toLowerCase();
      if (name && allowed(name)) {
        const args = parsed.arguments || parsed.parameters || parsed.args || parsed.input || {};
        toolCalls.push({
          id: `fallback_${Date.now()}_${toolCalls.length}`,
          type: "function",
          function: {
            name,
            arguments: typeof args === "string" ? args : JSON.stringify(args),
          },
        });
      }
    } catch {}
  }
  if (toolCalls.length > 0) return toolCalls;

  // Pattern 3: Standalone JSON object containing tool name and arguments/path/command
  const standaloneMatch = content.match(/\{\s*"(?:name|tool)"\s*:\s*"([a-zA-Z0-9_-]+)"\s*,\s*"(?:arguments|parameters|path|command)"[\s\S]*?\}/);
  if (standaloneMatch) {
    try {
      const parsed = JSON.parse(standaloneMatch[0].trim());
      const name = (parsed.name || parsed.tool || "").toLowerCase();
      if (allowed(name)) {
        let args = parsed.arguments || parsed.parameters || parsed.args;
        if (!args) {
          const { name: _n, tool: _t, ...rest } = parsed;
          args = rest;
        }
        toolCalls.push({
          id: `fallback_${Date.now()}_${toolCalls.length}`,
          type: "function",
          function: {
            name,
            arguments: typeof args === "string" ? args : JSON.stringify(args),
          },
        });
      }
    } catch {}
  }

  return toolCalls;
}

// ---------------------------------------------------------------------------
// Context Compaction for Long Horizon Tasks
// ---------------------------------------------------------------------------

export function compactHistoryForContext(
  messages: AgentMessage[],
  preserveRecentCount = 4
): AgentMessage[] {
  if (!messages || messages.length <= preserveRecentCount) {
    return messages;
  }

  const cutoffIndex = messages.length - preserveRecentCount;

  // Identify the latest user message index
  let latestUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user" && !messages[i]?.toolObservationId) {
      latestUserIndex = i;
      break;
    }
  }

  return messages.map((m, index) => {
    if (index >= cutoffIndex) {
      return m;
    }

    const compacted: AgentMessage = { ...m };

    // 1. Compact older USER messages (e.g. from previous completed tasks in the same session)
    if (
      compacted.role === "user" &&
      index !== latestUserIndex
    ) {
      if (typeof compacted.content === "string" && compacted.content.length > 800) {
        const originalLen = compacted.content.length;
        const head = compacted.content.slice(0, 300);
        const tail = compacted.content.slice(-150);
        compacted.content = `${head}\n\n... [Prior task instructions: ${originalLen} characters compacted for context optimization] ...\n\n${tail}`;
      } else if (Array.isArray(compacted.content)) {
        compacted.content = compacted.content.map((part) => {
          if (part.type === "image_url" && typeof part.image_url?.url === "string" && part.image_url.url.startsWith("data:")) {
            return { type: "text", text: "[Attached image from earlier turn]" };
          }
          return part;
        });
      }
    }

    // 2. Compact older tool result messages with large text outputs (> 800 chars)
    if (compacted.role === "tool" && typeof compacted.content === "string" && compacted.content.length > 800) {
      const originalLen = compacted.content.length;
      const head = compacted.content.slice(0, 400);
      const tail = compacted.content.slice(-300);
      compacted.content = `${head}\n\n... [Tool output: ${originalLen} characters compacted for context optimization] ...\n\n${tail}`;
    }

    // 3. Prune older assistant reasoning (older turns don't need 10,000+ chars of old thinking)
    if (compacted.role === "assistant" && typeof compacted.thinking === "string") {
      if (compacted.thinking.length > 400) {
        const originalLen = compacted.thinking.length;
        const head = compacted.thinking.slice(0, 350);
        compacted.thinking = `${head}\n... [Prior reasoning: ${originalLen} chars compacted]`;
      }
    }

    // 4. Compact older assistant responses if very large (> 1000 chars)
    if (compacted.role === "assistant" && typeof compacted.content === "string" && compacted.content.length > 1000) {
      const originalLen = compacted.content.length;
      const head = compacted.content.slice(0, 400);
      const tail = compacted.content.slice(-200);
      compacted.content = `${head}\n\n... [Prior assistant response: ${originalLen} chars compacted] ...\n\n${tail}`;
    }

    return compacted;
  });
}

export interface Skill {
  name: string;
  description: string;
  content: string;
  filePath: string;
  disableModelInvocation?: boolean;
}

export function formatSkillsForSystemPrompt(skills: Skill[]): string {
  const visibleSkills = skills.filter((skill) => !skill.disableModelInvocation);
  if (visibleSkills.length === 0) return "";

  const lines = [
    "The following skills provide specialized instructions for specific tasks.",
    "Read the full skill file with the 'read' tool when the user task matches its description.",
    "When a skill file references a relative path, resolve it against the skill directory (parent folder of SKILL.md) and use that absolute path in tool commands.",
    "",
    "<available_skills>",
  ];

  for (const skill of visibleSkills) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeSkillXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeSkillXml(skill.description)}</description>`);
    lines.push(`    <location>${escapeSkillXml(skill.filePath)}</location>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");
  return lines.join("\n");
}

function escapeSkillXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function scanInstalledSkills(workspacePath?: string): Skill[] {
  return resolveSkillRegistry(workspacePath).skills.filter((skill) => skill.isEnabled);
}

export function buildConstSystemPrompt(workspacePath: string, customPrompt?: string): string {
  const normalizedCwd = workspacePath.replace(/\\/g, "/");

  // Check for project context files
  let projectContext = "";
  const contextCandidates = [
    path.join(workspacePath, "AGENTS.md"),
    path.join(workspacePath, ".const", "instructions.md"),
    path.join(workspacePath, "README.md"),
  ];

  for (const candidate of contextCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, "utf-8").trim();
        if (content) {
          projectContext += `\n<project_instructions path="${path.basename(candidate)}">\n${content.slice(0, 5000)}\n</project_instructions>\n`;
          break; // Use the first matching instructions file
        }
      }
    } catch {
      // ignore read error
    }
  }

  // Check for workspace memory (MEMORY.md)
  let workspaceMemory = "";
  try {
    const memoryFile = path.join(workspacePath, ".const", "memory", "MEMORY.md");
    if (fs.existsSync(memoryFile)) {
      const memRaw = fs.readFileSync(memoryFile, "utf-8").trim();
      if (memRaw) {
        workspaceMemory = `\n<workspace_memory path=".const/memory/MEMORY.md">\n${memRaw.slice(0, 3000)}\n</workspace_memory>\n`;
      }
    }
  } catch {
    // ignore memory read error
  }

  // Check for installed skills (workspace and global)
  let skillsPrompt = "";
  try {
    const installedSkills = scanInstalledSkills(workspacePath);
    if (installedSkills.length > 0) {
      skillsPrompt = `\n\n${formatSkillsForSystemPrompt(installedSkills)}`;
    }
  } catch {
    // ignore skills scan error
  }

  const basePrompt = `You are Const Agent, an expert autonomous coding and software engineering assistant operating inside Const Harness. You help users by reading files, executing commands, editing code, creating folders, and developing complete software applications.

Current working directory: ${normalizedCwd}

Available tools:
- read: Read file contents (supports source code, text, JSON, markdown, images, and PDF documents with automated text extraction).
- write: Create or overwrite files with specified content. Parent directories are created automatically if needed.
- edit: Make surgical edits to existing files by exact string replacement (old_content -> new_content).
- bash: Execute terminal shell commands (Git Bash on Windows, bash on Unix). Supports background jobs and continuous services (e.g. dev servers, API servers) via 'async: true', custom labels ('name'), and readiness verification ('ready').
- powershell: Execute PowerShell commands (Windows PowerShell or pwsh). Supports background jobs and services via 'async: true'.
- ls: List files and directories in a directory with file types and sizes. Essential for discovering workspace layout.
- find: Search for files and directories matching a glob pattern or filename (e.g. '*.ts', '**/*.json', 'src/**/*.tsx').
- grep: Search file contents for regex or text patterns across files in the workspace.
- mkdir: Explicitly create a new directory or folder structure recursively.
- retain: Store important architectural facts, project conventions, coding patterns, user preferences, or durable decisions into long-term memory across sessions (.const/memory/MEMORY.md or <topic>.md).
- recall: Search long-term memory for previously retained architectural decisions, coding patterns, project context, or user preferences across workspace and global scopes.
- reflect: Synthesize an overview or answer architectural and coding questions using relevant entries stored in long-term memory.
- manage_task: Inspect status, view real-time logs, list, or terminate running background processes and services started by the agent.
- wait: Event-driven wait for background subagents or background shell tasks to complete, produce output, or become ready. NEVER execute terminal 'sleep' commands to wait for tasks.
- task: Delegate work to one or more isolated subagents. Supports single-task mode ('{ agent, name, description, assignment }') or parallel batch mode ('{ agent, context, tasks: [{ id, description, assignment }, ...] }'). Specialist roles: 'scout' (strictly read-only codebase reconnaissance), 'reviewer' (read-only code quality & logic audit), 'security-reviewer' (read-only vulnerability audit), 'task' (focused implementation worker with full write/edit/terminal tools), or 'sonic' (ultra-fast worker for rapid mechanical changes). Also loads custom '.const/agents/*.md' and '.omp/agents/*.md' personas.
- agent_status: Check status, live activity trace, or '<task-result>' findings of running or completed subagents (by ID or 'AdjectiveNoun' handle).
- kill_agent: Terminate an active running subagent by ID or handle (or '"all"').
- browser_navigate: Navigate the native desktop sidepanel browser to a URL (e.g. 'http://localhost:3000'), or 'back', 'forward', 'reload'. Automatically opens the Browser tab if not open yet, and targets the active/last browser tab (or opens a new tab with 'newTab: true').
- browser_snapshot: Capture a hierarchical ARIA accessibility tree, interactive element refs ([e1], [e2], ...), readable page text, and recent console/network errors. Supports 'diff: true' for compact unified deltas.
- browser_click: Click an interactive element by its ref (e.g. 'e1'), semantic selector ('text/...', 'role/button[name="..."]', 'label/...', 'placeholder/...', 'testid/...', '#id'), or (x, y) coordinates.
- browser_type: Type text into an input or textarea by its ref (e.g. 'e2') or selector. Supports clearing text and pressing Enter ('submit: true').
- browser_key: Send keyboard keys or shortcuts ('Enter', 'Tab', 'Escape', 'ArrowDown').
- browser_scroll: Scroll the page by direction ('down', 'up', 'top', 'bottom') or scroll an element ref/selector into view.
- browser_screenshot: Capture an annotated Set-of-Mark screenshot ([e1], [e2] overlays) of the active browser viewport and save to disk.
- browser_console: Read captured browser console logs, uncaught page exceptions, and fetch/XHR network requests.
- browser_evaluate: Execute multi-step browser action sequences ('steps') and/or evaluate custom JavaScript ('script') in a single turn.
- browser_wait_for: Wait until a condition holds (element visible/hidden/attached/detached, text present, URL matched, or a fixed delay) instead of guessing with sleeps. Use it after any action that triggers a re-render or a redirect.
- browser_verify_text: Assert that specific text is present ('state: visible', default) or absent ('state: absent') on the page. The call fails when the expectation does not hold, so use it to confirm a result instead of re-reading snapshots.
- browser_find: Search the page for visible text and return the matching elements with their snapshot refs and coordinates. Use it to locate a control by wording when you do not know its ref.
- browser_hover: Hover an element by ref or selector. Required for dropdown menus, tooltips and hover-revealed actions.
- browser_paste: Paste a long string into an input by ref or selector without simulating keystrokes.
- browser_tabs: List all open browser tabs in the sidepanel or switch the active browser tab.
- browser_request_help: Hand over control to the human user for CAPTCHAs, 2FA/OTP verification, or masked password/secret entry, pausing until the user hands control back.
Computer actions report input delivery separately from verified outcomes. Never claim a message was sent or a task completed from a successful input call alone. Inspect the returned screenshot/tree for evidence. For messaging, verify the intended recipient in the open chat header (including the self-chat label when requested) before submitting. If vision is unavailable and the tree is insufficient, report the outcome as unverified. After a timeout, input may already have occurred: inspect before retrying to avoid duplicate actions.
- computer_list_apps: List visible running desktop applications (e.g. WhatsApp, Spotify, Chrome, Notepad).
- computer_list_windows: List all open windows for a given application.
- computer_get_app_state: Capture the accessible UI tree and a screenshot attached as a visual tool observation.
- computer_click: Click a UI element by elementIndex (recommended) or window-local (x, y) coordinates.
- computer_set_value: Directly set text or value in an editable input element without keystroke lag.
- computer_type_text: Type text into the focused control in the active app window.
- computer_press_key: Press single keys ('Return', 'Tab', 'Escape', etc.).
- computer_hotkey: Send keyboard shortcuts (e.g. 'CmdOrCtrl+F', 'Ctrl+N', 'Alt+F4').
- computer_paste_text: Paste text via system clipboard into the active app window.
- computer_scroll: Scroll the app window up, down, left, or right.
- computer_drag: Drag and drop between elements or coordinates.

NATIVE COMPUTER USE (DESKTOP AUTOMATION) PROTOCOL:
- You have native computer-use capabilities to control desktop applications (e.g. WhatsApp, Spotify, Chrome, Edge, Slack, IDEs, system dialogs).
- CRITICAL NEGATIVE CONSTRAINT: NEVER write or execute PowerShell, CMD, Bash, C#, or Python scripts in the terminal to simulate mouse clicks, keyboard strokes, window activation, OCR, or capture screenshots (e.g. 'Add-Type -AssemblyName System.Windows.Forms', 'SendKeys', 'Windows.Media.Ocr', 'UIAutomationClient'). ALWAYS invoke the native 'computer_*' tools!
- WORKFLOW FOR DESKTOP APPS:
  1. Discover running app with 'computer_list_apps' (or 'computer_list_windows').
  2. Inspect state with 'computer_get_app_state(app: "<app>", restoreWindow: true)'. The screenshot is automatically saved to disk and its path returned.
  3. For UWP/WinUI apps (e.g. WhatsApp) or web views where elements may lack specific tree indices:
     - Use keyboard shortcuts to navigate: 'computer_hotkey(app: "<app>", key: "Ctrl+F")' to focus search/chat, 'Ctrl+N' for new chat.
     - Or use window-local coordinate click: 'computer_click(app: "<app>", x: <x>, y: <y>)' based on the screenshot image.
  4. Type messages with 'computer_type_text' or 'computer_paste_text', then press Return with 'computer_press_key(app: "<app>", key: "Return")'.
- STRICT SEPARATION FROM BROWSER TOOLS:
  * NEVER invoke browser tools ('browser_navigate', 'browser_evaluate', 'browser_snapshot', 'browser_click', 'browser_console') when automating desktop applications!
  * NEVER use 'browser_navigate' to open screenshot files or local image files ('file:///...'). Browser tools are strictly reserved for web pages.
- COMPLETE CHAT / MESSAGING APP WORKFLOW (WhatsApp, Telegram, Slack, Teams):
  1. Focus search: computer_hotkey(app: "<app>", key: "Ctrl+F") (or 'Ctrl+N')
  2. Type contact: computer_type_text(app: "<app>", text: "<name or self>")
  3. Select & open chat: computer_press_key(app: "<app>", key: "Down") then computer_press_key(app: "<app>", key: "Return")
  4. Type message: computer_type_text(app: "<app>", text: "<message text>")
  5. Send: computer_press_key(app: "<app>", key: "Return")
  Execute this standard sequence directly without looping into canvas pixel inspections!

NATIVE BROWSER AUTOMATION PROTOCOL:
- You have direct, live control over the native browser in the desktop sidepanel.
- If no browser tab is open yet, calling 'browser_navigate' (or any browser tool) will automatically open the right sidebar and mount a Browser tab. When multiple browser tabs are open, actions target the currently active or most recently opened (last) browser tab unless 'tabId' or 'newTab: true' is specified.
- When asked to test, debug, view, or interact with web applications (e.g. localhost servers, documentation, or websites):
  1. Use 'browser_navigate' to load the URL.
  2. Use 'browser_snapshot' to inspect the ARIA tree, interactive element refs ([e1], [e2], ...), and any page/network errors. Use 'diff: true' on subsequent snapshots on the same URL to save context.
  3. Use 'browser_click', 'browser_type', or 'browser_evaluate' (for multi-step sequences in a single turn) referencing element refs ('e1') or semantic selectors ('text/Sign in', 'placeholder/Search').
  4. Use 'browser_console' to inspect full console logs and network requests when debugging web apps, and 'browser_screenshot' (with Set-of-Mark annotations) when visual layout inspection is needed ('read' can inspect the saved screenshot file).
  5. If a human check (CAPTCHA, 2FA, OTP, or secret password) appears, call 'browser_request_help' (setting 'secretWanted' and 'ref' for passwords) so the user can complete it and hand control back.
- SEQUENTIAL & DEDUPLICATED ACTIONS:
  1. Browser operations mutate live DOM state and are strictly sequential. Never call redundant clicks, multiple snapshots, or repeated help requests in the same step.
  2. Once 'browser_request_help' is resolved by the user, immediately proceed with your task or take a 'browser_snapshot' to observe the updated page state instead of repeatedly requesting help.

CONTINUATION & MULTI-TURN PROTOCOL:
- When the user sends "continue", "lanjutkan", "next", or asks to proceed:
  1. Carefully inspect the entire conversation history, including prior tool calls, their results, snapshots, and previous responses.
  2. DO NOT restart from scratch or re-execute navigations, clicks, or searches that have already succeeded in prior turns.
  3. Resume immediately from the exact state reached in the prior turn.
  4. If all actions and data gathering are already complete, synthesize your findings into a clear, structured response for the user.

SUB-AGENT DELEGATION PROTOCOL:
- You can spawn up to 5 concurrent subagents to divide modular tasks cleanly.
- Subagents start with a fresh, empty context window — they have ZERO memory of this conversation. Put shared background, architecture decisions, and constraints in 'context' (applied once to every task in a batch) and keep each task's 'assignment' scoped to its specific files and acceptance criteria.
- Assign the appropriate specialist role ('scout', 'reviewer', 'security-reviewer', 'task', or 'sonic') and set 'solutionSpace' ('narrow' | 'constrained' | 'open') and 'effort' ('trivial' | 'standard' | 'complex') when appropriate to calibrate subagent reasoning depth.
- STRICT FILE PARTITIONING: Each concurrent 'task' subagent MUST work on disjoint files or directories (e.g. Sub-agent 1 creates 'sections/1-hero.html', Sub-agent 2 creates 'sections/2-about.html'). NEVER assign two concurrent subagents to modify the same file!
- PARALLEL VS SEQUENTIAL DELEGATION:
  * BATCH / PARALLEL (Recommended for independent tasks): Pass a single 'task' call with 'context' + 'tasks: [...]' array (or invoke multiple 'task' calls in one turn) to execute up to 5 subagents concurrently in parallel.
  * SEQUENTIAL (For dependent pipeline tasks): When a subsequent task depends on a previous subagent's findings (e.g. 'scout' investigates -> 'task' implements -> 'reviewer' audits), invoke them sequentially across turns.
  * BACKGROUND + WAIT: When 'run_in_background: true' is set, 'task' returns immediately with a handle ('id' / 'name'). Call 'wait({ id })' to block until completion without polling.
- Subagents report their completed deliverables inside a '<task-result>' envelope (with full transcript persisted to disk if truncated).


CRITICAL CODE GENERATION & TOOL CALLING PROTOCOL:
- When the user asks you to create or modify code, files, or applications (e.g. "buat web", "buat index.html", "create file"):
  You MUST call the 'write' tool (or 'edit' for changes) to write the code directly to disk.
- NEVER output large code files, HTML, CSS, JavaScript, SVG paths, or implementation pseudocode directly into conversational chat text tokens.
- Conversational chat text is strictly reserved for brief explanations or final summaries AFTER files have been written with tools.
- Outputting file code in conversational text will cause token truncation and task failure. Always invoke 'write' with the complete code!

GENERAL WORKFLOW & TOOL GUIDELINES:
- When asked to create new folders or directories (e.g. "buat folder", "mkdir", "create directory"):
  Use 'mkdir' to create the directory directly, or use 'write' to create files inside the intended directory path.
- Use 'ls', 'find', and 'grep' for file exploration, project discovery, and locating relevant code inside the workspace.
- Use 'read' to inspect existing files before editing them.
- Use 'edit' for surgical modifications to existing files. Provide exact matching old_content.
- Use 'write' for creating new files or complete rewrites.
- Use 'bash' or 'powershell' when command execution is needed (e.g. running tests, building, starting dev servers).
- Be concise, decisive, and direct. Commit code and changes directly with appropriate tools rather than merely describing them.

CRITICAL LOOP PREVENTION & ERROR RECOVERY PROTOCOL:
- Pay close attention to all tool outputs and exit codes.
- If a tool call fails or returns an error:
  1. DO NOT repeat the exact same tool call with the same arguments.
  2. If 'edit' fails because 'old_content' was not found, call 'read' immediately to inspect the latest file content and exact lines before attempting another edit.
  3. If 'bash' fails with exit code != 0, examine stderr/stdout carefully to understand why it failed before trying an alternative fix.
  4. If an operation is blocked or impossible, explain the blocker clearly to the user rather than repeating failing tool calls.
  5. NEVER execute terminal 'sleep' commands (e.g. 'sleep 5', 'sleep 10') in bash or powershell to wait or poll for background tasks or subagents. Subagents run in the foreground by default and return their complete findings directly.${workspaceMemory ? `\n\n${workspaceMemory}` : ""}${projectContext ? `\n\n<project_context>${projectContext}</project_context>` : ""}${skillsPrompt}`;

  if (customPrompt) {
    return `${customPrompt}\n\n---\n# WORKSPACE TOOLS & EXECUTION ENVIRONMENT\n${basePrompt}`;
  }

  return basePrompt;
}

export function buildLearnSystemPrompt(workspacePath: string, customPrompt?: string): string {
  const normalizedCwd = workspacePath.replace(/\\/g, "/");

  // Check for learning context files
  let projectContext = "";
  const contextCandidates = [
    path.join(workspacePath, "AGENTS.md"),
    path.join(workspacePath, ".const", "instructions.md"),
    path.join(workspacePath, "SYLLABUS.md"),
    path.join(workspacePath, "README.md"),
  ];

  for (const candidate of contextCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, "utf-8").trim();
        if (content) {
          projectContext += `\n<learning_context path="${path.basename(candidate)}">\n${content.slice(0, 5000)}\n</learning_context>\n`;
          break;
        }
      }
    } catch {
      // ignore read error
    }
  }

  // Check for installed skills (workspace and global)
  let skillsPrompt = "";
  try {
    const installedSkills = scanInstalledSkills(workspacePath);
    if (installedSkills.length > 0) {
      skillsPrompt = `\n\n${formatSkillsForSystemPrompt(installedSkills)}`;
    }
  } catch {
    // ignore skills scan error
  }

  const basePrompt = `You are Const Learn Agent, an expert adaptive educational research tutor, academic mentor, and interactive learning producer operating inside Const Learn.

Current learning workspace directory: ${normalizedCwd}

Available tools:
- read: Read source materials, textbooks, PDFs (with automated high-speed text extraction), markdown notes, and research data.
- write: Create new study files, slide presentations (e.g. slides.html for Hyperframe Canvas), interactive HTML/JS simulators, markdown summaries, quizzes, and scripts. Parent folders are auto-created.
- edit: Surgically modify or refine specific sections of existing notes, slides, or files.
- run_python: Execute Python code locally for scientific calculation, mathematics (calculus, algebra), physics simulations, data analysis (pandas, numpy), and plotting charts (matplotlib, seaborn).
- run_command: Execute safe terminal commands (PowerShell/Bash) in the workspace directory.
- ls: List files and folders in the workspace.
- find: Search for files by pattern or glob (e.g. '*.pdf', '*.py', '*.md').
- grep: Search for key terms, theories, definitions, or equations across documents.
- ask_question: Ask the student a clarifying question or Socratic inquiry with interactive structured choices (active recall).
- todo_write: Track learning path milestones and study goals.
- retain: Store important facts, user preferences, target exam goals, key strengths, misconceptions, or learning milestones in durable long-term memory across sessions.
- recall: Search durable long-term memory for previously retained concepts, past learning history, or user preferences.
- reflect: Synthesize an overview or answer a question using relevant entries stored in long-term memory.
- browser_navigate: Navigate the native desktop sidepanel browser to a URL (e.g. articles, Wikipedia, arXiv, interactive web labs, or local HTML simulators), or 'back', 'forward', 'reload'. Automatically switches the right pane to Preview mode and opens a Browser tab if not open yet, and targets the active/last browser tab (or opens a new tab with 'newTab: true').
- browser_snapshot: Capture a hierarchical ARIA accessibility tree, interactive element refs ([e1], [e2], ...), readable page text, and recent console/network errors. Supports 'diff: true' for compact unified deltas.
- browser_click: Click an interactive element by its ref (e.g. 'e1'), semantic selector ('text/...', 'role/button[name="..."]', 'label/...', 'placeholder/...', 'testid/...', '#id'), or (x, y) coordinates.
- browser_type: Type text into an input or search box by its ref (e.g. 'e2') or selector. Supports clearing text and pressing Enter ('submit: true').
- browser_key: Send keyboard keys or shortcuts ('Enter', 'Tab', 'Escape', 'ArrowDown').
- browser_scroll: Scroll the page by direction ('down', 'up', 'top', 'bottom') or scroll an element ref/selector into view.
- browser_screenshot: Capture an annotated Set-of-Mark screenshot ([e1], [e2] overlays) of the active browser viewport and save to disk.
- browser_console: Read captured browser console logs, uncaught page exceptions, and fetch/XHR network requests.
- browser_evaluate: Execute multi-step browser action sequences ('steps') and/or evaluate custom JavaScript ('script') in a single turn.
- browser_wait_for: Wait until a condition holds (element visible/hidden/attached/detached, text present, URL matched, or a fixed delay) instead of guessing with sleeps. Use it after any action that triggers a re-render or a redirect.
- browser_verify_text: Assert that specific text is present ('state: visible', default) or absent ('state: absent') on the page. The call fails when the expectation does not hold, so use it to confirm a result instead of re-reading snapshots.
- browser_find: Search the page for visible text and return the matching elements with their snapshot refs and coordinates. Use it to locate a control by wording when you do not know its ref.
- browser_hover: Hover an element by ref or selector. Required for dropdown menus, tooltips and hover-revealed actions.
- browser_paste: Paste a long string into an input by ref or selector without simulating keystrokes.
- browser_tabs: List all open browser tabs in the sidepanel or switch the active browser tab.
- browser_request_help: Hand over control to the student/user for CAPTCHAs, login/2FA, or masked password/secret entry, pausing until the student hands control back.

PEDAGOGICAL & INTERACTION PRINCIPLES (SOCRATIC METHOD):
1. Guided Discovery & Active Recall:
   - When a student asks to learn a complex concept, do not simply dump an overwhelming encyclopedia entry.
   - Break down difficult concepts into intuitive analogies, first principles, and guided steps.
   - Use 'ask_question' periodically to check understanding, challenge misconceptions, or let the student choose which subtopic to dive into next.
2. Actionable Learning & Artifact Creation (Hyperframe Studio):
   - When asked to generate slides, summaries, or simulations (e.g. "buatkan slide", "buat simulator", "rangkum bab ini"):
     You MUST invoke the 'write' tool to produce the actual, complete files (e.g., 'slides.html', 'simulator.html', 'summary.md') in the workspace.
   - For slides, generate modern, self-contained HTML presentations using clean typography, smooth transitions, and responsive layout.
   - For simulators, generate clean HTML5 Canvas or SVG/JS mini-apps that allow the student to tweak variables and see real-time visual feedback.
   - Never output massive multi-page HTML or raw code dumps in chat text tokens. Write them directly to files with 'write'!
3. Empirical Science & Calculation (run_python):
   - When the student asks to solve math, plot graphs, or analyze data, write Python code with 'run_python' to calculate exact numbers and generate visual plots (using matplotlib/seaborn).
   - Explain the output clearly to the student in conversation.
4. Native Sidepanel Browser Research & Interactive Web Exploration:
   - You have direct, live control over the native browser in the right sidepanel ('browser_*' tools).
   - If no browser tab is open yet, calling 'browser_navigate' (or any browser tool) will automatically expand the right pane, switch it to Preview mode, and open a Browser tab. When multiple browser tabs are open, actions target the currently active or most recently opened (last) browser tab unless 'tabId' or 'newTab: true' is specified.
   - Use 'browser_navigate' + 'browser_snapshot' when the student asks to open a website, search online documentation/papers, read an article together, or inspect an interactive web simulation.
   - Use 'browser_click', 'browser_type', or 'browser_evaluate' (for multi-step sequences) referencing element refs ('e1') or semantic selectors ('text/...', 'placeholder/...').
   - If a human check (CAPTCHA, login, 2FA, or secret password) appears, call 'browser_request_help' so the student can complete it and resume.
   - SEQUENTIAL & DEDUPLICATED ACTIONS: Browser operations mutate live DOM and are strictly sequential. Never call duplicate clicks, multiple snapshots, or repeated help requests in the same step.
   - CONTINUATION & MULTI-TURN PROTOCOL: When the student sends "continue", "lanjutkan", or asks to proceed, inspect the entire conversation history including prior tool outputs and build upon existing findings without restarting from scratch.
5. Error Recovery:
   - If a tool call fails, read error details and adjust. Do not blindly repeat failing arguments.${projectContext ? `\n\n<learning_context>${projectContext}</learning_context>` : ""}${skillsPrompt}`;

  if (customPrompt) {
    return `${customPrompt}\n\n---\n# WORKSPACE TOOLS & EXECUTION ENVIRONMENT\n${basePrompt}`;
  }

  return basePrompt;
}

// ---------------------------------------------------------------------------
// Resilient Fetch with Exponential Backoff & Keep-Alive Recovery
// ---------------------------------------------------------------------------

interface FetchRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, maxRetries: number, reason: string) => void;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 6000;
  const signal = options.signal;

  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal,
      });

      // Transient HTTP errors: 429 (Rate limit) or 5xx server errors
      const isTransientHttp =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504 ||
        response.status === 529;

      if (isTransientHttp && attempt < maxRetries) {
        attempt++;
        let delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 15) {
            delayMs = parsed * 1000;
          }
        }
        delayMs += Math.floor(Math.random() * 300);

        const reason = `Server returned HTTP ${response.status} (${response.statusText || "Transient error"})`;
        options.onRetry?.(attempt, maxRetries, reason);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return response;
    } catch (err: any) {
      if (signal?.aborted || err.name === "AbortError") {
        throw err;
      }

      const causeMsg = err.cause?.message || err.cause?.code || "";
      const rawReason = err.message || "Network connection failed";
      const reason = causeMsg && !rawReason.includes(causeMsg)
        ? `${rawReason} (${causeMsg})`
        : rawReason;

      if (attempt < maxRetries) {
        attempt++;
        const delayMs =
          Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs) +
          Math.floor(Math.random() * 300);
        options.onRetry?.(attempt, maxRetries, reason);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      const finalError = new Error(reason);
      (finalError as any).cause = err.cause || err;
      throw finalError;
    }
  }
}

export class ConstAgent {
  private config: AgentConfig;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private _isCancelled = false;
  private pendingApprovals = new Map<string, (response: ApprovalResponseData) => void>();
  private sessionAllowedTools = new Set<string>();

  constructor(config: AgentConfig) {
    this.config = {
      maxTurns: 200,
      workspacePath: process.cwd(),
      ...config,
    };
    if (config.initialAllowedTools) {
      for (const item of config.initialAllowedTools) {
        if (item) this.sessionAllowedTools.add(item.includes(":") || item === "file_mutations" ? item : normalizeToolName(item));
      }
    }
  }

  public get sessionAllowedToolsSet(): Set<string> {
    return new Set(this.sessionAllowedTools);
  }

  public get mode(): "request_review" | "ask_before_changes" | "full_access" {
    return this.config.mode || "ask_before_changes";
  }

  public updateMode(newMode: "request_review" | "ask_before_changes" | "full_access"): void {
    this.config.mode = newMode;
    if (newMode === "full_access") {
      // Auto-resolve any pending approvals immediately so execution proceeds
      for (const [id, resolver] of this.pendingApprovals.entries()) {
        try {
          resolver({
            approvalId: id,
            decision: "allow_once",
          });
        } catch {}
      }
      this.pendingApprovals.clear();
    }
  }

  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  public resolveApproval(approvalId: string, response: ApprovalResponseData): boolean {
    if (response.approvalId !== approvalId) return false;
    const resolver = this.pendingApprovals.get(approvalId);
    if (resolver) {
      this.pendingApprovals.delete(approvalId);
      resolver(response);
      return true;
    }
    return false;
  }

  public get maxTurns(): number {
    return this.config.maxTurns || 200;
  }

  private steeringQueue: Array<{ content: string; attachments?: any[]; timestamp: number; instructionId?: string; sourceSideChatId?: string }> = [];

  public steer(content: string, attachments?: any[], metadata?: { instructionId: string; sourceSideChatId: string }): boolean {
    if (!this.isRunning || this._isCancelled) return false;
    this.steeringQueue.push({
      content,
      attachments,
      timestamp: Date.now(),
      ...metadata,
    });
    if (metadata) {
      for (const [approvalId, resolve] of this.pendingApprovals) {
        resolve({ approvalId, decision: "deny", feedback: "A new instruction arrived; reconsider this action before proceeding." });
      }
    }
    return true;
  }

  public abort(): void {
    this._isCancelled = true;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
    }
    // Child cancellation propagates through its signal; conversation-wide cleanup belongs to the root.
    try {
      if (!this.config.parentAgentId) {
        globalSubAgentManager.killAllRunningSubAgents(undefined, this.config.conversationId);
      }
    } catch {}
    for (const [id, resolver] of this.pendingApprovals.entries()) {
      try {
        resolver({
          approvalId: id,
          decision: "deny",
          feedback: "Agent execution was cancelled by user.",
        });
      } catch {}
    }
    this.pendingApprovals.clear();
    this.isRunning = false;
  }

  public async run(
    messages: AgentMessage[],
    onEvent: (event: AgentEvent) => void
  ): Promise<AgentMessage[]> {
    if (this.isRunning) {
      throw new Error("Agent is already running a session");
    }

    this.isRunning = true;
    this._isCancelled = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    let deadlineReached = false;
    const timeoutMs = this.config.sessionTimeoutMs ?? (this.config.sessionKind === "companion" ? 120_000 : 0);
    const deadline = timeoutMs > 0 ? setTimeout(() => { deadlineReached = true; this.abortController?.abort(); }, timeoutMs) : undefined;

    const conversationHistory: AgentMessage[] = [...messages];
    let toolVisionUnavailable = false;
    let currentTurn = 0;
    const runId = `llm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let requestSequence = 0;
    let activeRequest: ReturnType<typeof trackLlmRequest> | undefined;
    let contextSystemPrompt = "";
    let contextTools: any[] = [];
    const emitContext = () => {
      const breakdown = calculateContextBreakdown({
        systemPrompt: contextSystemPrompt, tools: contextTools,
        messages: compactHistoryForContext(conversationHistory),
      });
      onEvent({ type: "context_update", model: this.config.model, updatedAt: Date.now(), systemPromptTokens: breakdown.systemTokens,
        toolsTokens: breakdown.toolsTokens, messagesTokens: breakdown.messageTokens,
        usedTokens: breakdown.totalHeuristicTokens,
        totalTokens: this.config.contextWindow ?? DEFAULT_MODELS.find(m => m.id === this.config.model)?.contextWindow ?? 1_000_000 });
    };
    let consecutiveStreamRetries = 0;
    let consecutivePlanningTurns = 0;
    let consecutiveDraftCutoffs = 0;
    let consecutiveEmptyRetries = 0;
    const MAX_EMPTY_RETRIES = this.config.sessionKind === "companion" ? 1 : 5;
    const STREAM_STALL_TIMEOUT_MS = 35_000;
    const maxTurns = this.config.maxTurns || 200;
    const workspacePath = this.config.workspacePath || process.cwd();
    const toolCallHistory: Array<{ name: string; argsHash: string; isError: boolean }> = [];
    const DOOM_LOOP_THRESHOLD = 3;

    const endpoint = this.config.baseUrl.endsWith("/chat/completions")
      ? this.config.baseUrl
      : `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    try {
      while (currentTurn < maxTurns) {
        if (signal.aborted || this._isCancelled) {
          throw new Error("User cancelled agent execution.");
        }
        currentTurn++;

        // Drain any pending steering messages into conversationHistory before next LLM turn
        if (this.steeringQueue.length > 0) {
          while (this.steeringQueue.length > 0) {
            const steer = this.steeringQueue.shift()!;
            let steerContent = steer.content || "";
            const imageParts: any[] = [];
            const docSections: string[] = [];

            if (steer.attachments && steer.attachments.length > 0) {
              const attLines = steer.attachments.map((att: any) => {
                const pathInfo = att.path ? ` [Path: ${att.path}]` : "";
                const sizeStr = att.size ? ` (${Math.round(att.size / 1024)} KB)` : "";
                const pagesInfo = att.pages ? ` [${att.pages} Pages]` : "";
                return `- ${(att.type || "file").toUpperCase()}: "${att.name}"${sizeStr}${pagesInfo}${pathInfo}`;
              });
              const baseText = steerContent.trim() ? steerContent : "Please analyze the attached media/file(s).";
              steerContent = `${baseText}\n\n[Attached media / Lampiran media:\n${attLines.join("\n")}]`;

              for (const att of steer.attachments) {
                if (att.textContent && att.textContent.trim().length > 0) {
                  docSections.push(
                    `--- DOCUMENT ATTACHMENT: "${att.name}" (${(att.type || "file").toUpperCase()}) ---\n${att.textContent}\n--- END ATTACHMENT ---`
                  );
                }
                if (att.type === "image" && (att.base64 || att.url)) {
                  const imgUrl = att.base64 || att.url;
                  if (imgUrl && (imgUrl.startsWith("data:") || imgUrl.startsWith("http"))) {
                    imageParts.push({
                      type: "image_url",
                      image_url: { url: imgUrl },
                    });
                  }
                }
              }
            }

            if (docSections.length > 0) {
              steerContent += `\n\n${docSections.join("\n\n")}`;
            }

            const steerMsgContent = imageParts.length > 0
              ? [{ type: "text", text: steerContent }, ...imageParts]
              : steerContent;

            const steerMsg: AgentMessage = {
              role: "user",
              content: steerMsgContent,
              timestamp: steer.timestamp,
              instructionId: steer.instructionId,
              sourceSideChatId: steer.sourceSideChatId,
            };
            conversationHistory.push(steerMsg);
            onEvent({
              type: "steer_message",
              conversationId: this.config.conversationId,
              message: steerMsg,
            });
          }
        }

        onEvent({ type: "status", status: "thinking" });

        const isCompanion = this.config.sessionKind === "companion";
        const baseTools = isCompanion ? [] : this.config.tools ?? (this.config.preset === "learn" ? CONST_LEARN_TOOLS : CONST_DEFAULT_TOOLS);
        const activeTools = [...baseTools.filter((tool) => {
          const capability = tool.function.name.startsWith("browser_") ? "browser-use"
            : tool.function.name.startsWith("computer_") ? "computer-use" : undefined;
          return !capability || this.config.nativeCapabilityEnabled?.(capability) !== false;
        }), ...(isCompanion ? [] : await this.config.externalTools?.(signal) ?? [])];
        // Approval metadata is local policy, not part of a model provider's function schema.
        const requestTools = activeTools.map(({ requiresApproval: _approval, ...definition }) => definition);

        const systemPrompt = isCompanion
          ? `You are the user's side chat companion. Answer questions directly using the supplied parent task snapshot and side chat history. The parent task may still be running. State when information is unavailable or may have changed. Do not claim to have changed files, sent instructions, or updated the parent task. The user can explicitly send an instruction to the main task through the interface.\n\n${this.config.systemPrompt || ""}`
          : this.config.preset === "learn"
            ? buildLearnSystemPrompt(workspacePath, this.config.systemPrompt)
            : buildConstSystemPrompt(workspacePath, this.config.systemPrompt);

        let effectiveSystemPrompt = systemPrompt;
        const latestUserMessage = [...conversationHistory].reverse().find((message) => message.role === "user");
        const latestUserText = typeof latestUserMessage?.content === "string"
          ? latestUserMessage.content
          : Array.isArray(latestUserMessage?.content)
            ? latestUserMessage.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n")
            : "";
        const pluginInstructions = isCompanion ? "" : pluginInvocationInstructions(latestUserText, resolveSkillRegistry(workspacePath).plugins);
        if (pluginInstructions) effectiveSystemPrompt += "\n\n" + pluginInstructions;
        const hasWriteTools = activeTools.some(
          (t) => t.function.name === "write" || t.function.name === "edit"
        );
        if (consecutivePlanningTurns >= 2 && hasWriteTools) {
          effectiveSystemPrompt +=
            "\n\n[CRITICAL DIRECTIVE: You have completed all initial planning and analysis. You are REQUIRED to invoke tools now ('write', 'edit', 'bash', etc.) to make concrete file modifications. Do not output conversational planning without tool calls.]";
        }
        if (this.config.softTurnBudget && currentTurn >= this.config.softTurnBudget) {
          effectiveSystemPrompt += `\n\n[TURN BUDGET WARNING: You have reached turn ${currentTurn} (soft budget: ${this.config.softTurnBudget} turns, hard limit: ${maxTurns} turns). Stop starting new lines of inquiry immediately. Synthesize your findings from the work already completed and return your final structured report now.]`;
        }

        contextSystemPrompt = effectiveSystemPrompt;
        contextTools = requestTools;
        const historyForContext = compactHistoryForContext(conversationHistory);

        const formattedMessages = [
          {
            role: "system",
            content: effectiveSystemPrompt,
          },
          ...historyForContext.map((m, mIdx) => {
            const item: Record<string, any> = {
              role: m.role,
              content: m.content ?? "",
            };
            if (m.role === "assistant" && m.thinking) {
              item.reasoning_content = m.thinking;
            }
            if (m.name) item.name = m.name;
            if (m.role === "tool") {
              item.tool_call_id = m.tool_call_id || `call_tool_${mIdx}`;
            } else if (m.tool_call_id) {
              item.tool_call_id = m.tool_call_id;
            }
            if (m.tool_calls && m.tool_calls.length > 0) {
              item.tool_calls = m.tool_calls;
              // If assistant made tool calls and content is empty, pass null for OpenAPI compatibility
              if (!m.content) {
                item.content = null;
              }
            }
            return item;
          }),
        ];

        // Token meter (DeepSeek Harness adaptation): Compute accurate context breakdown across system prompt, active tools, and message history
        const breakdown = calculateContextBreakdown({
          systemPrompt: effectiveSystemPrompt,
          tools: requestTools,
          messages: historyForContext,
        });

        const activeModelInfo = DEFAULT_MODELS.find((m) => m.id === this.config.model);
        const resolvedContextWindow =
          this.config.contextWindow ??
          activeModelInfo?.contextWindow ??
          1_000_000;

        const occupancy = calculateContextOccupancy(
          {
            projectedTokens: breakdown.totalHeuristicTokens,
            contextWindow: resolvedContextWindow,
          },
          breakdown.totalHeuristicTokens,
          resolvedContextWindow
        );

        onEvent({
          type: "context_update", model: this.config.model, updatedAt: Date.now(),
          systemPromptTokens: breakdown.systemTokens,
          toolsTokens: breakdown.toolsTokens,
          messagesTokens: breakdown.messageTokens,
          usedTokens: occupancy.usedTokens,
          totalTokens: occupancy.contextWindow,
          percent: occupancy.percent,
        });

        // Dynamic Max Output Tokens:
        // - Built-in Gemini / Const models have 128K max output (128,000)
        // - Custom endpoints or unspecified models default to 64K (65,536)
        const DEFAULT_MAX_OUTPUT_TOKENS = 65536; // 64K
        const modelLower = (this.config.model || "").toLowerCase();
        const is128kModel =
          modelLower.includes("gemini") ||
          modelLower.startsWith("const") ||
          modelLower.includes("combo/");
        const resolvedMaxTokens =
          this.config.maxOutputTokens ??
          this.config.maxTokens ??
          (is128kModel ? 128000 : DEFAULT_MAX_OUTPUT_TOKENS);

        if (signal.aborted || this._isCancelled) {
          throw new Error("User cancelled agent execution.");
        }

        const request = trackLlmRequest(`${runId}_${++requestSequence}`, this.config.model, onEvent);
        activeRequest = request;
        const response = await fetchWithRetry(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: this.config.model,
              messages: formattedMessages,
              ...(requestTools.length ? { tools: requestTools } : {}),
              ...(activeTools && activeTools.length > 0 ? { parallel_tool_calls: false } : {}),
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: resolvedMaxTokens,
              max_completion_tokens: resolvedMaxTokens,
              ...(this.config.thinkingLevel && this.config.thinkingLevel !== "off"
                ? {
                    reasoning: this.config.thinkingLevel,
                    reasoning_effort: this.config.thinkingLevel,
                  }
                : {}),
            }),
          },
          {
            signal,
            maxRetries: isCompanion ? 1 : 4,
            onRetry: (attempt, maxRetries, reason) => {
              onEvent({
                type: "status",
                status: "thinking",
                message: `Connection interrupted (${reason}). Reconnecting (attempt ${attempt}/${maxRetries})...`,
              });
            },
          }
        );

        if (!response.ok) {
          const rawErr = await response.text().catch(() => "Unknown error");
          let cleanMessage = rawErr;
          try {
            const parsed = JSON.parse(rawErr);
            if (parsed?.error?.message) {
              cleanMessage = parsed.error.message;
            } else if (parsed?.message) {
              cleanMessage = parsed.message;
            }
          } catch {}

          if (
            cleanMessage.includes("<!DOCTYPE") ||
            cleanMessage.includes("<html") ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            cleanMessage =
              `Const Engine server gateway error (${response.status}). Upstream connection timed out or is temporarily unreachable.`;
          }

          const msgWithImages = [...conversationHistory].reverse().find(
            (m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url")
          );
          if (
            msgWithImages &&
            Array.isArray(msgWithImages.content) &&
            (response.status === 502 || cleanMessage.includes("Playground") || cleanMessage.includes("502") || cleanMessage.includes("gateway") ||
              (msgWithImages.toolObservationId && /image|vision|multimodal|modality/i.test(cleanMessage)))
          ) {
            const textParts = msgWithImages.content
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("\n");
            const imgCount = msgWithImages.content.filter((p: any) => p.type === "image_url").length;

            if (msgWithImages.toolObservationId) {
              toolVisionUnavailable = true;
              disableToolObservationImages(conversationHistory);
            }
            msgWithImages.content = msgWithImages.toolObservationId ? UNAVAILABLE_TOOL_VISION : `${textParts}\n\n[PEMBERITAHUAN MEDIA: Pengguna melampirkan ${imgCount} berkas visual (gambar/media). Sistem/model saat ini tidak dapat membuka atau memuat berkas visual tersebut ke model secara langsung. Sampaikan kepada pengguna secara ramah bahwa Anda tidak dapat melihat atau membuka gambar/media tersebut secara langsung, lalu lanjutkan memberikan bantuan atau jawaban atas pertanyaan pengguna berdasarkan konteks teks di atas.]`;

            onEvent({
              type: "status",
              status: "thinking",
              message: "Input visual langsung tidak didukung provider. Mengalihkan ke mode referensi berkas dan melanjutkan respon...",
            });

            request.finish("failed");
            currentTurn--;
            consecutiveEmptyRetries = 0;
            continue;
          }

          throw new Error(`Const error (${response.status}): ${cleanMessage}`);
        }

        if (!response.body) {
          throw new Error("No response body from Const");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let turnContent = "";
        let turnThinking = "";
        let turnFinishReason: string | null = null;
        let hasReceivedAnyData = false;
        let hasCleanDone = false;
        const streamFilter = new ThinkingStreamFilter();
        const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

        const readWithTimeout = <T>(
          streamReader: ReadableStreamDefaultReader<T>,
          timeoutMs: number,
          abortSignal?: AbortSignal
        ): Promise<ReadableStreamReadResult<T>> => {
          return new Promise((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null;
            let finished = false;

            const onAbort = () => {
              if (finished) return;
              finished = true;
              if (timer) clearTimeout(timer);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            };

            if (abortSignal?.aborted) {
              return onAbort();
            }

            timer = setTimeout(() => {
              if (finished) return;
              finished = true;
              abortSignal?.removeEventListener("abort", onAbort);
              reject(new Error(`Stream stalled: no data received for ${Math.round(timeoutMs / 1000)}s`));
            }, timeoutMs);

            abortSignal?.addEventListener("abort", onAbort, { once: true });

            streamReader.read().then(
              (res) => {
                if (finished) return;
                finished = true;
                if (timer) clearTimeout(timer);
                abortSignal?.removeEventListener("abort", onAbort);
                resolve(res);
              },
              (err) => {
                if (finished) return;
                finished = true;
                if (timer) clearTimeout(timer);
                abortSignal?.removeEventListener("abort", onAbort);
                reject(err);
              }
            );
          });
        };

        try {
          while (true) {
            const { done, value } = await readWithTimeout(reader, STREAM_STALL_TIMEOUT_MS, signal);
            if (done) break;

            hasReceivedAnyData = true;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === "[DONE]") {
                hasCleanDone = true;
                continue;
              }

              let json: any;
              try {
                json = JSON.parse(dataStr);
              } catch {
                continue;
              }

              if (json?.error) {
                const errorMsg = json.error.message || json.error.msg || (typeof json.error === "string" ? json.error : JSON.stringify(json.error));
                try {
                  reader.cancel().catch(() => {});
                } catch {}
                throw new Error(`Const stream error: ${errorMsg}`);
              }

              try {
                if (json?.usage) request.observeUsage(json.usage);
                const choice = json.choices?.[0];
                if (choice?.finish_reason) {
                  turnFinishReason = choice.finish_reason;
                  hasCleanDone = true;
                }

                const delta = choice?.delta || choice?.message;
                if (!delta) continue;
                request.observeDelta(delta);

                const reasoningDelta =
                  delta.reasoning_content ||
                  delta.reasoning ||
                  delta.thought ||
                  (typeof delta.thinking === "string" ? delta.thinking : "");
                if (reasoningDelta) {
                  turnThinking += reasoningDelta;
                  onEvent({ type: "thinking", thinking: reasoningDelta });
                }

                if (delta.content) {
                  const filtered = streamFilter.push(delta.content);
                  if (filtered.thinking) {
                    turnThinking += filtered.thinking;
                    onEvent({ type: "thinking", thinking: filtered.thinking });
                  }
                  if (filtered.content) {
                    turnContent += filtered.content;
                    onEvent({ type: "token", token: filtered.content });
                  }
                }

                if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsMap.has(idx)) {
                      toolCallsMap.set(idx, {
                        id: tc.id || `call_${Date.now()}_${idx}`,
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                      });
                    } else {
                      const c = toolCallsMap.get(idx)!;
                      if (tc.id) c.id = tc.id;
                      if (tc.function?.name) c.name += tc.function.name;
                      if (tc.function?.arguments) c.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (streamErr: any) {
          request.finish(signal.aborted || this._isCancelled ? "cancelled" : "failed");
          if (signal?.aborted || streamErr.name === "AbortError") {
            throw streamErr;
          }

          const errMsg = streamErr?.message || "";
          const isVisionError =
            errMsg.includes("Playground") ||
            errMsg.includes("browser session") ||
            errMsg.includes("502") ||
            errMsg.includes("bad_gateway") ||
            errMsg.includes("image_url") ||
            errMsg.includes("modality") ||
            errMsg.includes("chrome-headless-shell") ||
            errMsg.includes("Executable doesn't exist");

          const msgWithImages = [...conversationHistory].reverse().find(
            (m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url")
          );

          if (isVisionError && msgWithImages && Array.isArray(msgWithImages.content)) {
            const textParts = msgWithImages.content
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("\n");
            const imgCount = msgWithImages.content.filter((p: any) => p.type === "image_url").length;

            if (msgWithImages.toolObservationId) {
              toolVisionUnavailable = true;
              disableToolObservationImages(conversationHistory);
            }
            msgWithImages.content = msgWithImages.toolObservationId ? UNAVAILABLE_TOOL_VISION : `${textParts}\n\n[PEMBERITAHUAN MEDIA: Pengguna melampirkan ${imgCount} berkas visual (gambar/media). Sistem/model saat ini tidak dapat membuka atau memuat berkas visual tersebut ke model secara langsung. Sampaikan kepada pengguna secara ramah bahwa Anda tidak dapat melihat atau membuka gambar/media tersebut secara langsung, lalu lanjutkan memberikan bantuan atau jawaban atas pertanyaan pengguna berdasarkan konteks teks di atas.]`;

            onEvent({
              type: "status",
              status: "thinking",
              message: "Input visual langsung tidak didukung provider. Mengalihkan ke mode referensi berkas dan melanjutkan respon...",
            });

            currentTurn--;
            consecutiveEmptyRetries = 0;
            continue;
          }

          if (consecutiveEmptyRetries < MAX_EMPTY_RETRIES) {
            consecutiveEmptyRetries++;
            currentTurn--;
            const backoffMs =
              Math.min(1000 * Math.pow(2, consecutiveEmptyRetries - 1), 6000) +
              Math.floor(Math.random() * 400);
            onEvent({
              type: "status",
              status: "thinking",
              message: `Koneksi stream terputus (${streamErr.message || "stream drop"}). Mengulang otomatis (percobaan ${consecutiveEmptyRetries}/${MAX_EMPTY_RETRIES} dalam ${(backoffMs / 1000).toFixed(1)}s)...`,
            });
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw streamErr;
        }

        // Process any trailing data remaining in buffer
        if (buffer.trim().startsWith("data:")) {
          const trimmed = buffer.trim();
          const dataStr = trimmed.slice(5).trim();
          if (dataStr && dataStr !== "[DONE]") {
            let json: any;
            try {
              json = JSON.parse(dataStr);
            } catch {
              json = null;
            }

            if (json?.error) {
              const errorMsg = json.error.message || json.error.msg || (typeof json.error === "string" ? json.error : JSON.stringify(json.error));
              throw new Error(`Const stream error: ${errorMsg}`);
            }

            try {
              if (json?.usage) request.observeUsage(json.usage);
              const choice = json.choices?.[0];
              if (choice?.finish_reason) {
                turnFinishReason = choice.finish_reason;
                hasCleanDone = true;
              }
              const delta = choice?.delta || choice?.message;
              if (delta) {
                request.observeDelta(delta);
                const reasoningDelta =
                  delta.reasoning_content ||
                  delta.reasoning ||
                  delta.thought ||
                  (typeof delta.thinking === "string" ? delta.thinking : "");
                if (reasoningDelta) {
                  turnThinking += reasoningDelta;
                  onEvent({ type: "thinking", thinking: reasoningDelta });
                }
                if (delta.content) {
                  const filtered = streamFilter.push(delta.content);
                  if (filtered.thinking) {
                    turnThinking += filtered.thinking;
                    onEvent({ type: "thinking", thinking: filtered.thinking });
                  }
                  if (filtered.content) {
                    turnContent += filtered.content;
                    onEvent({ type: "token", token: filtered.content });
                  }
                }
                if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsMap.has(idx)) {
                      toolCallsMap.set(idx, {
                        id: tc.id || `call_${Date.now()}_${idx}`,
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                      });
                    } else {
                      const c = toolCallsMap.get(idx)!;
                      if (tc.id) c.id = tc.id;
                      if (tc.function?.name) c.name += tc.function.name;
                      if (tc.function?.arguments) c.arguments += tc.function.arguments;
                    }
                  }
                }
              }
            } catch {}
          }
        }

        // Flush any remaining buffered tokens from streamFilter
        const flushed = streamFilter.flush();
        if (flushed.thinking) {
          turnThinking += flushed.thinking;
          onEvent({ type: "thinking", thinking: flushed.thinking });
        }
        if (flushed.content) {
          turnContent += flushed.content;
          onEvent({ type: "token", token: flushed.content });
        }

        request.finish("completed");

        const rawToolCalls: ToolCall[] = Array.from(toolCallsMap.values())
          .filter((tc) => tc.name && tc.name.trim().length > 0)
          .map((tc) => {
            // Auto-repair synthetic tool calls (e.g. Google Antigravity call:google:run_shell_command)
            if (tc.name === "malformed_tool_call" || tc.name.includes("malformed")) {
              try {
                const parsed = JSON.parse(tc.arguments);
                const msg = parsed.message || parsed.error || "";
                const shellMatch = msg.match(
                  /call:(?:google|default_api):(run_shell_command|run_command)\s*\{(?:\s*command\s*:\s*)?([^}]+)\}/i
                );
                if (shellMatch && shellMatch[2]) {
                  const extractedCmd = shellMatch[2].replace(/^["']|["']$/g, "").trim();
                  return {
                    id: tc.id,
                    type: "function" as const,
                    function: {
                      name: "bash",
                      arguments: JSON.stringify({ command: extractedCmd }),
                    },
                  };
                }
              } catch {}
            }
            return {
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            };
          });

        // Fallback Tool Call Extraction: Recover tool calls from markdown code blocks or text
        if (!isCompanion && rawToolCalls.length === 0 && turnContent) {
          const fallback = extractFallbackToolCalls(turnContent, new Set(activeTools.map((tool) => tool.function.name.toLowerCase())));
          if (fallback.length > 0) {
            rawToolCalls.push(...fallback);
            turnContent = turnContent.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, "").trim();
          }
        }

        if (isCompanion && rawToolCalls.length > 0) {
          throw new Error("The side chat model requested an unavailable tool. Try another model or rephrase the question.");
        }

        // Sequential Deduplication of Tool Calls within the same turn
        const toolCalls: ToolCall[] = [];
        let seenBrowserRequestHelp = false;

        for (const tc of rawToolCalls) {
          const name = tc.function.name;

          // Never execute multiple browser_request_help in the same turn
          if (name === "browser_request_help") {
            if (seenBrowserRequestHelp) continue;
            seenBrowserRequestHelp = true;
          }

          const prev = toolCalls[toolCalls.length - 1];
          if (prev) {
            // Drop duplicate consecutive identical tool calls
            if (prev.function.name === name) {
              try {
                const prevArgs = JSON.stringify(parseToolArguments(prev.function.arguments));
                const currArgs = JSON.stringify(parseToolArguments(tc.function.arguments));
                if (prevArgs === currArgs) {
                  continue;
                }
              } catch {}
            }

            // Drop consecutive browser_snapshot calls in the same turn
            if (name === "browser_snapshot" && prev.function.name === "browser_snapshot") {
              continue;
            }
          }

          toolCalls.push(tc);
        }

        const hasActionableOutput = toolCalls.length > 0 || turnContent.trim().length > 0;
        const hasThinking = turnThinking.trim().length > 0;

        if (hasActionableOutput) {
          consecutiveEmptyRetries = 0;
          consecutiveStreamRetries = 0;
        } else {
          // Model produced no actionable text and no tool calls!
          if (!isCompanion && hasThinking && currentTurn < maxTurns && consecutivePlanningTurns < 3) {
            consecutivePlanningTurns++;
            const thinkingStepMsg: AgentMessage = {
              role: "assistant",
              content: "I have analyzed the workspace requirements and completed the plan. Proceeding now to execute required actions.",
              thinking: turnThinking,
              timestamp: Date.now(),
            };
            conversationHistory.push(thinkingStepMsg);

            conversationHistory.push({
              role: "user",
              content:
                turnFinishReason === "length"
                  ? "Output token limit reached during planning. Without further reasoning, immediately provide your final answer or invoke the required tool call."
                  : "You completed internal analysis but stopped without actionable output. Continue immediately with your response to the user or invoke the next required tool call.",
              timestamp: Date.now(),
            });

            onEvent({
              type: "status",
              status: "thinking",
              message: "Analisis selesai tanpa output. Mengarahkan model untuk memberikan respon final...",
            });
            continue;
          }

          if (consecutiveEmptyRetries < MAX_EMPTY_RETRIES) {
            consecutiveEmptyRetries++;
            currentTurn--; // Don't consume a conversational turn on empty response
            const backoffMs =
              Math.min(1000 * Math.pow(2, consecutiveEmptyRetries - 1), 6000) +
              Math.floor(Math.random() * 400);

            onEvent({
              type: "status",
              status: "thinking",
              message: `Model tidak memberikan respon. Mengulang otomatis (percobaan ${consecutiveEmptyRetries}/${MAX_EMPTY_RETRIES} dalam ${(backoffMs / 1000).toFixed(1)}s)...`,
            });

            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          // Capped after MAX_EMPTY_RETRIES
          const exhaustedErrMsg =
            isCompanion ? "The side chat model returned an empty response. Please try again." : `Model tidak memberikan respon setelah ${MAX_EMPTY_RETRIES}x percobaan. Silakan periksa koneksi atau coba pilih model lain di dropdown.`;
          onEvent({ type: "error", error: exhaustedErrMsg });
          onEvent({ type: "status", status: "error", message: exhaustedErrMsg });
          conversationHistory.push({
            role: "assistant",
            content: exhaustedErrMsg,
            timestamp: Date.now(),
          });
          return conversationHistory;
        }

        if (toolCalls.length > 0) {
          consecutivePlanningTurns = 0;
          consecutiveDraftCutoffs = 0;
        }

        if (toolCalls.length === 0) {
          if (!isCompanion && turnFinishReason === "length" && currentTurn < maxTurns && consecutiveDraftCutoffs < 3) {
            consecutiveDraftCutoffs++;
            // Response was truncated mid-turn while planning or drafting code!
            // Retract streaming tokens from the UI so partial draft doesn't pollute the chat card
            onEvent({ type: "token_reset" });

            // Preserve the draft inside thinking so the model retains its reasoning context
            const combinedThinking = (turnThinking ? turnThinking + "\n\n" : "") + turnContent;
            conversationHistory.push({
              role: "assistant",
              content: "I have prepared the implementation draft. Proceeding now to save the file via tool execution.",
              thinking: combinedThinking,
              timestamp: Date.now(),
            });

            conversationHistory.push({
              role: "user",
              content: "Proceed immediately by invoking the required tool (such as 'write' or 'edit') to save the file.",
              timestamp: Date.now(),
            });

            onEvent({
              type: "status",
              status: "thinking",
              message: "Output reached token limit during draft. Directing model to execute tool calls...",
            });
            continue;
          }

          // If the model had previous tool calls in this session (currentTurn > 1) but output an empty text turn without tools,
          // prompt it to synthesize its findings instead of terminating with an empty message.
          if (turnContent.trim().length === 0 && currentTurn > 1 && currentTurn < maxTurns) {
            conversationHistory.push({
              role: "user",
              content: "All previous tool actions are complete. Now provide your final, complete response to the user summarizing your actions and findings.",
              timestamp: Date.now(),
            });

            onEvent({
              type: "status",
              status: "thinking",
              message: "Tool operations completed. Synthesizing final answer...",
            });
            continue;
          }

          if (turnContent.trim().length === 0 && currentTurn > 1) {
            turnContent = "Semua instruksi dan operasi tools telah selesai dijalankan.";
          }

          const assistantMsg: AgentMessage = {
            role: "assistant",
            content: turnContent,
            thinking: turnThinking || undefined,
            timestamp: Date.now(),
          };
          conversationHistory.push(assistantMsg);

          // Check if any steer messages arrived during generation
          if (this.steeringQueue.length > 0) {
            while (this.steeringQueue.length > 0) {
              const steer = this.steeringQueue.shift()!;
              let steerContent = steer.content || "";
              const imageParts: any[] = [];
              const docSections: string[] = [];

              if (steer.attachments && steer.attachments.length > 0) {
                const attLines = steer.attachments.map((att: any) => {
                  const pathInfo = att.path ? ` [Path: ${att.path}]` : "";
                  const sizeStr = att.size ? ` (${Math.round(att.size / 1024)} KB)` : "";
                  const pagesInfo = att.pages ? ` [${att.pages} Pages]` : "";
                  return `- ${(att.type || "file").toUpperCase()}: "${att.name}"${sizeStr}${pagesInfo}${pathInfo}`;
                });
                const baseText = steerContent.trim() ? steerContent : "Please analyze the attached media/file(s).";
                steerContent = `${baseText}\n\n[Attached media / Lampiran media:\n${attLines.join("\n")}]`;

                for (const att of steer.attachments) {
                  if (att.textContent && att.textContent.trim().length > 0) {
                    docSections.push(
                      `--- DOCUMENT ATTACHMENT: "${att.name}" (${(att.type || "file").toUpperCase()}) ---\n${att.textContent}\n--- END ATTACHMENT ---`
                    );
                  }
                  if (att.type === "image" && (att.base64 || att.url)) {
                    const imgUrl = att.base64 || att.url;
                    if (imgUrl && (imgUrl.startsWith("data:") || imgUrl.startsWith("http"))) {
                      imageParts.push({
                        type: "image_url",
                        image_url: { url: imgUrl },
                      });
                    }
                  }
                }
              }

              if (docSections.length > 0) {
                steerContent += `\n\n${docSections.join("\n\n")}`;
              }

              const steerMsgContent = imageParts.length > 0
                ? [{ type: "text", text: steerContent }, ...imageParts]
                : steerContent;

              const steerMsg: AgentMessage = {
                role: "user",
                content: steerMsgContent,
                timestamp: steer.timestamp,
                instructionId: steer.instructionId,
                sourceSideChatId: steer.sourceSideChatId,
              };
              conversationHistory.push(steerMsg);
              onEvent({
                type: "steer_message",
                conversationId: this.config.conversationId,
                message: steerMsg,
              });
            }
            continue;
          }

          emitContext();
          onEvent({
            type: "done",
            fullContent: turnContent,
            messages: conversationHistory,
          });
          onEvent({ type: "status", status: "done" });
          return conversationHistory;
        }

        const assistantMsg: AgentMessage = {
          role: "assistant",
          content: turnContent,
          thinking: turnThinking || undefined,
          tool_calls: toolCalls,
          timestamp: Date.now(),
        };
        conversationHistory.push(assistantMsg);

        // Emit tool calls and execute native tools
        onEvent({
          type: "status",
          status: "calling_tool",
          message: `Executing ${toolCalls.length} tool(s)...`,
        });

        const isSubAgentToolName = (name?: string) => {
          const norm = (name || "").toLowerCase().replace(/[-_]/g, "");
          return norm === "task" || norm === "spawnagent" || norm === "subagent" || norm === "delegatetask";
        };
        const subagentCallsCount = toolCalls.filter((tc) => isSubAgentToolName(tc.function?.name)).length;
        const spawnedParallelAgents: Array<{
          agentId: string;
          toolCallId: string;
          toolName: string;
        }> = [];

        const toolObservations: ToolObservation[] = [];
        for (const [tcIdx, tc] of toolCalls.entries()) {
          if (signal.aborted || this._isCancelled) {
            throw new Error("User cancelled agent execution.");
          }
          if (this.steeringQueue.some((item) => item.sourceSideChatId)) {
            const result = "This action was skipped because a new user instruction is waiting. Reassess it after reading the instruction.";
            onEvent({ type: "tool_call", toolCallId: tc.id, toolName: tc.function.name, args: parseToolArguments(tc.function.arguments) });
            onEvent({ type: "tool_result", toolCallId: tc.id, toolName: tc.function.name, result, isError: true, durationMs: 0 });
            conversationHistory.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result, timestamp: Date.now() });
            continue;
          }
          const parsedArgs = parseToolArguments(tc.function.arguments);
          const argsHash = JSON.stringify(parsedArgs);

          // Consecutive Doom Loop Detection (OpenCode & Pi alignment)
          const recentCalls = toolCallHistory.slice(-DOOM_LOOP_THRESHOLD);
          const isIdenticalConsecutive =
            recentCalls.length >= DOOM_LOOP_THRESHOLD &&
            recentCalls.every((entry) => entry.name === tc.function.name && entry.argsHash === argsHash);
          const lastFailedConsecutive =
            recentCalls.length >= 2 &&
            recentCalls.slice(-2).every((entry) => entry.name === tc.function.name && entry.argsHash === argsHash && entry.isError);

          // Benign exploration tools like ls, read, find, grep shouldn't be blocked unless spammed consecutively
          const isDoomLoop = (isIdenticalConsecutive || lastFailedConsecutive) && (
            tc.function.name === "bash" || tc.function.name === "powershell" || tc.function.name === "edit" || isIdenticalConsecutive
          );

          if (isDoomLoop) {
            const loopWarning = `[DOOM LOOP INTERCEPTED]: You have called '${tc.function.name}' with identical arguments multiple times without progress or after failing. Execution of this identical call is blocked. You MUST stop repeating this call. Analyze what failed, use 'read' to inspect files if editing failed, or explain the issue clearly to the user.`;

            onEvent({
              type: "tool_call",
              toolCallId: tc.id,
              toolName: tc.function.name,
              args: parsedArgs,
            });

            onEvent({
              type: "tool_result",
              toolCallId: tc.id,
              toolName: tc.function.name,
              result: loopWarning, durationMs: 0, waitingMs: 0,
              isError: true,
            });

            conversationHistory.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.function.name,
              content: `[TOOL ERROR - DOOM LOOP BLOCKED]:\n${loopWarning}`,
              timestamp: Date.now(),
            });

            toolCallHistory.push({
              name: tc.function.name,
              argsHash,
              isError: true,
            });

            continue;
          }

          onEvent({
            type: "tool_call",
            toolCallId: tc.id,
            toolName: tc.function.name,
            args: parsedArgs,
          });

          // Check for Approval in "ask_before_changes" mode for terminal / shell execution, python execution, and file mutations
          const toolLower = normalizeToolName(tc.function.name);
          const actionKind = getToolActionKind(tc.function.name);
          const isTerminalTool = actionKind === "terminal";
          const isPythonTool = actionKind === "python";
          const isFileMutationTool = actionKind === "file_mutation";
          const isExternalTool = tc.function.name.startsWith("mcp_");
          const externalDefinition = activeTools.find((tool) => tool.function.name === tc.function.name);

          let cmd = isTerminalTool ? extractCommandArg(parsedArgs) : undefined;
          let targetCwd = workspacePath;
          let description = isExternalTool ? `Call connected tool: ${tc.function.name}` : "";
          let isOutside = false;
          let targetFilePath = "";

          let diffStats: { added: number; removed: number } | undefined = undefined;
          let fileName = "";
          let dirPath = "";

          if (isTerminalTool) {
            const rawCwd = parsedArgs.cwd || parsedArgs.working_directory || parsedArgs.workdir || parsedArgs.path;
            targetCwd = rawCwd ? path.resolve(workspacePath, rawCwd) : workspacePath;
            description = `Execute terminal command: ${cmd || tc.function.name}`;
          } else if (isPythonTool) {
            const pyCode =
              (typeof parsedArgs.code === "string" ? parsedArgs.code : "") ||
              (typeof parsedArgs.script === "string" ? parsedArgs.script : "") ||
              (typeof parsedArgs.python_code === "string" ? parsedArgs.python_code : "");
            cmd = pyCode ? (pyCode.length > 80 ? pyCode.slice(0, 77) + "..." : pyCode) : "run_python";
            targetCwd = workspacePath;
            description = `Execute Python script: ${cmd}`;
          } else if (isFileMutationTool) {
            targetFilePath = extractPathArg(parsedArgs) || "";
            const resolvedPath = resolveSafePath(targetFilePath, workspacePath);
            isOutside = !isPathWithinWorkspace(resolvedPath, workspacePath);
            cmd = `${tc.function.name}: ${targetFilePath || "file"}`;
            targetCwd = workspacePath;
            description = `Modify file: ${targetFilePath || tc.function.name}`;

            const cleanRelPath = isOutside
              ? targetFilePath
              : path.relative(workspacePath, resolvedPath).replace(/\\/g, "/");
            fileName = cleanRelPath.split("/").filter(Boolean).pop() || targetFilePath;
            dirPath = cleanRelPath.split("/").slice(0, -1).join("/");
            if (dirPath) dirPath = `${dirPath}/`;

            // Compute added / removed lines estimate
            if (toolLower === "write" || toolLower === "writefile") {
              const codeStr = parsedArgs.CodeContent || parsedArgs.code || parsedArgs.content || "";
              const lineCount = typeof codeStr === "string" ? codeStr.split("\n").length : 1;
              diffStats = { added: lineCount, removed: 0 };
            } else if (toolLower === "replaceinfile") {
              const rep = typeof parsedArgs.ReplacementContent === "string" ? parsedArgs.ReplacementContent.split("\n").length : 1;
              const tar = typeof parsedArgs.TargetContent === "string" ? parsedArgs.TargetContent.split("\n").length : 1;
              diffStats = { added: rep, removed: tar };
            } else if (toolLower === "edit" || toolLower === "editfile") {
              const codeStr = parsedArgs.code || parsedArgs.content || "";
              const lineCount = typeof codeStr === "string" ? codeStr.split("\n").length : 1;
              diffStats = { added: lineCount, removed: 0 };
            }
          }

          const isAlreadyAllowed =
            this.sessionAllowedTools.has(toolLower) ||
            (isFileMutationTool && this.sessionAllowedTools.has("file_mutations") && !isOutside) ||
            Boolean(
              targetFilePath &&
                (this.sessionAllowedTools.has(`file:${targetFilePath}`) ||
                  this.sessionAllowedTools.has(`file:${resolveSafePath(targetFilePath, workspacePath)}`))
            ) ||
            Boolean(cmd && this.sessionAllowedTools.has(`cmd:${cmd.trim()}`));

          // Mode behavior:
          // In "request_review", EVERY action (including file edits inside workspace) requires approval.
          // In "ask_before_changes", file mutations INSIDE workspace proceed without interruption,
          // while terminal executions, Python executions, and out-of-workspace writes require approval.
          const isRequestReview = this.config.mode === "request_review";
          const requiresApproval =
            (isExternalTool && externalDefinition?.requiresApproval !== false) || (isRequestReview
              ? isTerminalTool || isPythonTool || isFileMutationTool
              : this.config.mode === "ask_before_changes" && (isTerminalTool || isPythonTool || (isFileMutationTool && isOutside)));

          let approvedThisTurn = false;
          let waitingMs = 0;

          if ((isRequestReview || this.config.mode === "ask_before_changes") && requiresApproval && !isAlreadyAllowed) {
            const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            const approvalReq: ApprovalRequestData = {
              approvalId,
              toolCallId: tc.id,
              toolName: tc.function.name,
              args: parsedArgs,
              command: cmd,
              cwd: targetCwd,
              description,
              createdAt: Date.now(),
              targetFile: fileName || undefined,
              filePath: targetFilePath || undefined,
              dirPath: dirPath || undefined,
              diffStats,
              isMutation: isFileMutationTool,
            };

            // Wait for user approval or abort signal
            const approvalStartedAt = Date.now();
            const userResponse = await new Promise<ApprovalResponseData>((resolve, reject) => {
              const onAbort = () => {
                this.pendingApprovals.delete(approvalId);
                reject(new Error("Operation cancelled"));
              };

              if (signal.aborted) {
                return reject(new Error("Operation cancelled"));
              }
              signal.addEventListener("abort", onAbort, { once: true });

              this.pendingApprovals.set(approvalId, (res) => {
                this.pendingApprovals.delete(approvalId);
                signal.removeEventListener("abort", onAbort);
                resolve(res);
              });

              // Register first: subscribers may respond or change mode synchronously.
              try {
                onEvent({
                  type: "status",
                  status: "waiting_approval",
                  message: `Waiting for approval: ${description || cmd || tc.function.name}`,
                });
                if (!this.pendingApprovals.has(approvalId)) return;
                onEvent({
                  type: "approval_request",
                  id: approvalId,
                  approval: approvalReq,
                  ...approvalReq,
                });
              } catch (error) {
                this.pendingApprovals.delete(approvalId);
                signal.removeEventListener("abort", onAbort);
                reject(error);
              }
            });

            onEvent({
              type: "approval_resolved",
              approvalId,
              decision: userResponse.decision,
            });

            waitingMs += Date.now() - approvalStartedAt;
            if (signal.aborted || this._isCancelled) {
              throw new Error("User cancelled agent execution.");
            }

            if (userResponse.decision === "full_access") {
              this.updateMode("full_access");
              approvedThisTurn = true;
            } else if (
              userResponse.decision === "allow_always" ||
              userResponse.decision === "allow_conversation" ||
              userResponse.decision === "allow_project"
            ) {
              approvedThisTurn = true;
              if (isFileMutationTool) {
                this.sessionAllowedTools.add(toolLower);
                if (targetFilePath) {
                  this.sessionAllowedTools.add(`file:${targetFilePath}`);
                  this.sessionAllowedTools.add(`file:${resolveSafePath(targetFilePath, workspacePath)}`);
                }
                if (!isOutside) {
                  this.sessionAllowedTools.add("file_mutations");
                }
              } else if (isPythonTool) {
                this.sessionAllowedTools.add(toolLower);
                if (cmd && cmd.trim()) this.sessionAllowedTools.add(`cmd:${cmd.trim()}`);
              } else if (cmd && cmd.trim()) {
                this.sessionAllowedTools.add(`cmd:${cmd.trim()}`);
                this.sessionAllowedTools.add(toolLower);
              } else {
                this.sessionAllowedTools.add(toolLower);
              }
            } else if (userResponse.decision === "allow_once") {
              approvedThisTurn = true;
            } else if (userResponse.decision === "deny") {
              const feedbackText = userResponse.feedback?.trim();
              const actionSubject = isFileMutationTool
                ? `file mutation: '${targetFilePath || "file"}'`
                : isPythonTool
                ? `Python execution`
                : `command: '${cmd}'`;
              const rejectionMessage = feedbackText
                ? `[ACTION REJECTED BY USER]: The user denied permission to execute ${actionSubject}. User instruction / feedback: "${feedbackText}". Adapt your plan immediately based on this instruction and proceed without running that action.`
                : `[ACTION REJECTED BY USER]: The user denied permission to execute ${actionSubject}. Do NOT execute this action. Choose a different approach or explain the options clearly.`;

              onEvent({
                type: "tool_result",
                toolCallId: tc.id,
                toolName: tc.function.name,
                result: rejectionMessage, durationMs: 0, waitingMs: waitingMs,
                isError: true,
              });

              conversationHistory.push({
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function.name,
                content: rejectionMessage,
                timestamp: Date.now(),
              });

              toolCallHistory.push({
                name: tc.function.name,
                argsHash,
                isError: true,
              });

              // A denial invalidates the rest of this model-generated plan. Supply
              // a result for every pending call before asking the model to replan.
              for (const skippedTc of toolCalls.slice(tcIdx + 1)) {
                const result = "[ACTION CANCELLED]: An earlier action in this batch was rejected by the user. Replan using their feedback before proposing further actions.";
                onEvent({ type: "tool_result", toolCallId: skippedTc.id, toolName: skippedTc.function.name, result, isError: true });
                conversationHistory.push({ role: "tool", tool_call_id: skippedTc.id, name: skippedTc.function.name, content: result, timestamp: Date.now() });
              }
              break;
            } else if (userResponse.decision === "skip") {
              const actionSubject = isFileMutationTool
                ? `file mutation: '${targetFilePath || "file"}'`
                : isPythonTool
                ? `Python execution`
                : `command: '${cmd}'`;
              const skipMessage = `[ACTION SKIPPED BY USER]: The user skipped execution of ${actionSubject}. Proceed with other tasks or ask the user how to continue.`;

              onEvent({
                type: "tool_result",
                toolCallId: tc.id,
                toolName: tc.function.name,
                result: skipMessage, durationMs: 0, waitingMs: waitingMs,
                isError: true,
              });

              conversationHistory.push({
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function.name,
                content: skipMessage,
                timestamp: Date.now(),
              });

              toolCallHistory.push({
                name: tc.function.name,
                argsHash,
                isError: true,
              });

              continue;
            }
          }

          const allowOutsideWorkspace =
            this.config.mode === "full_access" ||
            isAlreadyAllowed ||
            approvedThisTurn;

          const isTaskTool = isSubAgentToolName(tc.function.name);
          const isExplicitBackground = Boolean(
            parsedArgs.run_in_background === true || parsedArgs.async === true
          );
          const isBatchTaskCall =
            Array.isArray(parsedArgs.tasks) && parsedArgs.tasks.length > 0;
          const shouldRunParallel =
            isTaskTool &&
            !isBatchTaskCall &&
            !isExplicitBackground &&
            subagentCallsCount > 1;
          const effectiveArgs = shouldRunParallel
            ? { ...parsedArgs, run_in_background: true }
            : parsedArgs;

          const toolStartedAt = Date.now();
          let questionWaitingMs = 0;
          const { result, isError, images } = await executeNativeTool(
            tc.function.name,
            effectiveArgs,
            workspacePath,
            {
              signal,
              stepIndex: currentTurn,
              allowOutsideWorkspace,
              conversationId: this.config.conversationId,
              onFileMutation: (record) => {
                onEvent({ type: "file_mutation", record });
              },
              onTodoUpdate: (todos) => {
                onEvent({ type: "todo_update", todos });
              },
              askUser: async (questions) => {
                onEvent({ type: "ask_question", toolCallId: tc.id, questions });
                if (this.config.onAskQuestion) {
                  const questionStartedAt = Date.now();
                  try { return await this.config.onAskQuestion(tc.id, questions); }
                  finally { questionWaitingMs += Date.now() - questionStartedAt; }
                }
                return { status: "submitted" };
              },
              onTaskStarted: (task) => {
                onEvent({ type: "task_started", task });
              },
              onTaskStopped: (taskId, code) => {
                onEvent({ type: "task_stopped", taskId, code });
              },
              onSubAgentStarted: (agent) => {
                onEvent({ type: "subagent_started", agent });
              },
              onSubAgentUpdated: (agent) => {
                onEvent({ type: "subagent_updated", agent });
              },
              onSubAgentFinished: (agentId, result, error, agent) => {
                onEvent({ type: "subagent_finished", agentId, result, error, agent });
              },
              onSubAgentKilled: (agentId, agent) => {
                onEvent({ type: "subagent_killed", agentId, agent });
              },
              parentConfig: this.config,
              learnId: this.config.learnId,
              onSourceCreated: (source) => {
                onEvent({ type: "source_created", source });
              },
              onArtifactCreated: (artifact) => {
                onEvent({ type: "artifact_created", artifact });
              },
              browserHandler: this.config.browserHandler,
              computerHandler: this.config.computerHandler,
              voiceConfig: this.config.voiceConfig,
              imageConfig: this.config.imageConfig,
              speechHandler: this.config.speechHandler,
              imageHandler: this.config.imageHandler,
            }
          );

          onEvent({
            type: "tool_result",
            toolCallId: tc.id,
            toolName: tc.function.name,
            result,
            isError,
            durationMs: Math.max(0, Date.now() - toolStartedAt - questionWaitingMs),
            waitingMs: waitingMs + questionWaitingMs,
          });

          if (!isError && images?.length) {
            toolObservations.push({ id: tc.id, name: tc.function.name, images });
            if (toolObservations.length > 2) toolObservations.shift();
          }
          const rawResultText = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          const toolContent = isError
            ? `[TOOL ERROR - ACTION FAILED]:\n${rawResultText}\n\n(The action failed. Please inspect the error above and adapt your approach. Do NOT repeat the exact same call).`
            : rawResultText;

          conversationHistory.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: toolContent,
            timestamp: Date.now(),
          });

          toolCallHistory.push({
            name: tc.function.name,
            argsHash,
            isError: Boolean(isError),
          });

          if (shouldRunParallel && !isError) {
            const match = typeof result === "string" ? result.match(/id="([^"]+)"/) : null;
            if (match && match[1]) {
              spawnedParallelAgents.push({
                agentId: match[1],
                toolCallId: tc.id,
                toolName: tc.function.name,
              });
            }
          }

          if (signal.aborted || this._isCancelled) {
            throw new Error("User cancelled agent execution.");
          }

          // If user steered with a new message while this tool was running:
          // Safely stop remaining scheduled tool calls in this turn so the agent can pivot immediately
          if (this.steeringQueue.length > 0 && tcIdx < toolCalls.length - 1) {
            for (const skippedTc of toolCalls.slice(tcIdx + 1)) {
              const skipMsg = "[Tool execution stopped: User steered with a new instruction.]";
              onEvent({ type: "tool_call", toolCallId: skippedTc.id, toolName: skippedTc.function.name, args: parseToolArguments(skippedTc.function.arguments) });
              onEvent({
                type: "tool_result",
                toolCallId: skippedTc.id,
                toolName: skippedTc.function.name,
                result: skipMsg,
                isError: true,
              });
              conversationHistory.push({
                role: "tool",
                tool_call_id: skippedTc.id,
                name: skippedTc.function.name,
                content: skipMsg,
                timestamp: Date.now(),
              });
            }
            break;
          }
        }

        const modelInputTypes = this.config.inputTypes ?? DEFAULT_MODELS.find(model => model.id === this.config.model)?.inputTypes;
        appendToolObservations(conversationHistory, toolObservations, !toolVisionUnavailable && (!modelInputTypes || modelInputTypes.includes("image")));

        // If multiple subagents were spawned in parallel, wait for all of them to complete
        if (spawnedParallelAgents.length > 0) {
          onEvent({
            type: "status",
            status: "calling_tool",
            message: `Running ${spawnedParallelAgents.length} subagents in parallel...`,
          });

          await Promise.all(
            spawnedParallelAgents.map((item) =>
              globalSubAgentManager.waitForSubAgent(item.agentId)
            )
          );

          if (signal.aborted || this._isCancelled) {
            throw new Error("User cancelled agent execution.");
          }

          // Finalize task result envelopes for each subagent in conversationHistory AND emit updated tool_result for UI
          for (const item of spawnedParallelAgents) {
            const agent = globalSubAgentManager.getSubAgent(item.agentId);
            if (agent) {
              const durationSec = Math.round(
                ((agent.endTime || Date.now()) - agent.startTime) / 1000
              );
              const finalStatus =
                agent.status === "killed"
                  ? "cancelled"
                  : agent.status === "failed"
                  ? "failed"
                  : "completed";
              const finalEnvelope = formatTaskResultEnvelope({
                id: agent.id,
                name: agent.name,
                agent: agent.role || "task",
                status: finalStatus,
                durationSec,
                output: agent.result || "Completed with no output.",
                error: agent.error,
                artifactPath: agent.artifactPath,
                turnCount: agent.turnCount,
              });
              const finalIsError = finalStatus === "failed" || finalStatus === "cancelled";

              // Emit updated tool_result so ExecutionTrace and saved transcripts reflect final completion
              onEvent({
                type: "tool_result",
                toolCallId: item.toolCallId,
                toolName: item.toolName,
                result: finalEnvelope,
                isError: finalIsError,
              });

              const histIdx = conversationHistory.findIndex(
                (m) =>
                  m.role === "tool" &&
                  (m.tool_call_id === item.toolCallId ||
                    (typeof m.content === "string" && m.content.includes(item.agentId)))
              );
              if (histIdx !== -1) {
                const targetMsg = conversationHistory[histIdx];
                if (targetMsg) {
                  targetMsg.content = finalEnvelope;
                }
              }
            }
          }
        }
      }

      // If loop completed without breaking on a zero-tool turn (e.g. maxTurns reached)
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      const reachedTurnLimit = currentTurn >= maxTurns;
      const fallbackContent: string = reachedTurnLimit
        ? `Task execution reached the maximum limit (${maxTurns} turns). You can send a follow-up message like "continue" or "lanjutkan" to keep going.`
        : lastMsg?.role === "assistant" && lastMsg.content
          ? (typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content))
          : `Finished executing all task operations.`;

      if (lastMsg?.role !== "assistant" || !lastMsg.content || reachedTurnLimit) {
        conversationHistory.push({
          role: "assistant",
          content: fallbackContent,
          timestamp: Date.now(),
        });
      }

      emitContext();
      onEvent({
        type: "done",
        fullContent: fallbackContent,
        messages: conversationHistory,
      });
      onEvent({ type: "status", status: "done" });

      return conversationHistory;
    } catch (err: any) {
      if (deadlineReached) {
        const error = new Error("The side chat request timed out. Please try again.");
        activeRequest?.finish("failed");
        onEvent({ type: "error", error: error.message });
        onEvent({ type: "status", status: "error", message: error.message });
        throw error;
      }
      const isAborted =
        this._isCancelled ||
        signal?.aborted ||
        err?.name === "AbortError" ||
        err?.message?.includes("cancelled") ||
        err?.message?.includes("aborted");

      activeRequest?.finish(isAborted ? "cancelled" : "failed");
      if (isAborted) {
        this._isCancelled = true;
        onEvent({ type: "error", error: "User cancelled agent execution." });
        onEvent({ type: "status", status: "idle", message: "User cancelled agent execution." });
      } else {
        onEvent({ type: "error", error: err.message });
        onEvent({ type: "status", status: "error", message: err.message });
        throw err;
      }
      return conversationHistory;
    } finally {
      if (deadline) clearTimeout(deadline);
      this.isRunning = false;
      this.abortController = null;
      this.pendingApprovals.clear();
      this.steeringQueue = [];
    }
  }
}

export function createConstAgent(config: AgentConfig): ConstAgent {
  return new ConstAgent(config);
}
