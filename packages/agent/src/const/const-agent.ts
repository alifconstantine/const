
import fs from "node:fs";
import path from "node:path";
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  ToolCall,
  ApprovalDecision,
  ApprovalRequestData,
  ApprovalResponseData,
} from "./types.js";
import { CONST_DEFAULT_TOOLS, CONST_LEARN_TOOLS, executeNativeTool, extractCommandArg } from "./tools.js";

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
]);

export function extractFallbackToolCalls(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
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
      if (name && VALID_FALLBACK_TOOLS.has(name)) {
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
      if (name && VALID_FALLBACK_TOOLS.has(name)) {
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
      if (VALID_FALLBACK_TOOLS.has(name)) {
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
    if (messages[i]?.role === "user") {
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
      index !== latestUserIndex &&
      typeof compacted.content === "string" &&
      compacted.content.length > 800
    ) {
      const originalLen = compacted.content.length;
      const head = compacted.content.slice(0, 300);
      const tail = compacted.content.slice(-150);
      compacted.content = `${head}\n\n... [Prior task instructions: ${originalLen} characters compacted for context optimization] ...\n\n${tail}`;
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

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.8));
}

export function estimateToolSchemasTokens(tools: any[] = CONST_DEFAULT_TOOLS): number {
  try {
    const raw = JSON.stringify(tools);
    return Math.ceil(raw.length / 3.8);
  } catch {
    return 950;
  }
}

export function buildConstSystemPrompt(workspacePath: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;

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

  return `You are Const Agent, an expert autonomous coding and software engineering assistant operating inside Const Harness. You help users by reading files, executing commands, editing code, creating folders, and developing complete software applications.

Current working directory: ${normalizedCwd}

Available tools:
- read: Read file contents (supports source code, text, JSON, markdown, images, and PDF documents with automated text extraction).
- write: Create or overwrite files with specified content. Parent directories are created automatically if needed.
- edit: Make surgical edits to existing files by exact string replacement (old_content -> new_content).
- bash: Execute terminal shell commands (Git Bash on Windows, bash on Unix).
- powershell: Execute PowerShell commands (Windows PowerShell or pwsh).
- ls: List files and directories in a directory with file types and sizes. Essential for discovering workspace layout.
- find: Search for files and directories matching a glob pattern or filename (e.g. '*.ts', '**/*.json', 'src/**/*.tsx').
- grep: Search file contents for regex or text patterns across files in the workspace.
- mkdir: Explicitly create a new directory or folder structure recursively.


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
  4. If an operation is blocked or impossible, explain the blocker clearly to the user rather than repeating failing tool calls.${projectContext ? `\n\n<project_context>${projectContext}</project_context>` : ""}`;
}

export function buildLearnSystemPrompt(workspacePath: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;

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

  return `You are Const Learn Agent, an expert adaptive educational research tutor, academic mentor, and interactive learning producer operating inside Const Learn.

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
4. Error Recovery:
   - If a tool call fails, read error details and adjust. Do not blindly repeat failing arguments.${projectContext ? `\n\n<learning_context>${projectContext}</learning_context>` : ""}`;
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

      if (attempt < maxRetries) {
        attempt++;
        const delayMs =
          Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs) +
          Math.floor(Math.random() * 300);
        const reason = err.message || "Network connection failed";
        options.onRetry?.(attempt, maxRetries, reason);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw err;
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
  }

  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  public resolveApproval(approvalId: string, response: ApprovalResponseData): boolean {
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

  public abort(): void {
    this._isCancelled = true;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
    }
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

    const conversationHistory: AgentMessage[] = [...messages];
    let currentTurn = 0;
    let consecutiveStreamRetries = 0;
    let consecutivePlanningTurns = 0;
    let consecutiveDraftCutoffs = 0;
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
        onEvent({ type: "status", status: "thinking" });

        const activeTools =
          this.config.tools ??
          (this.config.preset === "learn" ? CONST_LEARN_TOOLS : CONST_DEFAULT_TOOLS);

        const systemPrompt =
          this.config.preset === "learn"
            ? buildLearnSystemPrompt(workspacePath, this.config.systemPrompt)
            : buildConstSystemPrompt(workspacePath, this.config.systemPrompt);

        let effectiveSystemPrompt = systemPrompt;
        if (consecutivePlanningTurns >= 2) {
          effectiveSystemPrompt +=
            "\n\n[CRITICAL DIRECTIVE: You have completed all initial planning and analysis. You are REQUIRED to invoke tools now ('write', 'edit', 'bash', etc.) to make concrete file modifications. Do not output conversational planning without tool calls.]";
        }

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
              tools: activeTools,
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
            maxRetries: 4,
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

        try {
          while (true) {
            const { done, value } = await reader.read();
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

              try {
                const json = JSON.parse(dataStr);
                if (json.usage) {
                  const promptTokens = Math.max(0, Math.round(Number(json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0) || 0));
                  const completionTokens = Math.max(0, Math.round(Number(json.usage.completion_tokens ?? json.usage.output_tokens ?? 0) || 0));
                  const totalTokens = Math.max(0, Math.round(Number(json.usage.total_tokens ?? (promptTokens + completionTokens)) || (promptTokens + completionTokens)));
                  if (totalTokens > 0) {
                    onEvent({
                      type: "usage",
                      promptTokens,
                      completionTokens,
                      totalTokens,
                    });
                  }
                }
                const choice = json.choices?.[0];
                if (choice?.finish_reason) {
                  turnFinishReason = choice.finish_reason;
                  hasCleanDone = true;
                }

                const delta = choice?.delta || choice?.message;
                if (!delta) continue;

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
          if (signal?.aborted || streamErr.name === "AbortError") {
            throw streamErr;
          }
          if (consecutiveStreamRetries < 3) {
            consecutiveStreamRetries++;
            currentTurn--;
            const backoffMs = Math.min(1000 * Math.pow(2, consecutiveStreamRetries - 1), 4000);
            onEvent({
              type: "status",
              status: "thinking",
              message: `Stream read interrupted (${streamErr.message || "connection drop"}). Reconnecting turn (attempt ${consecutiveStreamRetries}/3 in ${backoffMs / 1000}s)...`,
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
            try {
              const json = JSON.parse(dataStr);
              if (json.usage) {
                const promptTokens = Math.max(0, Math.round(Number(json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0) || 0));
                const completionTokens = Math.max(0, Math.round(Number(json.usage.completion_tokens ?? json.usage.output_tokens ?? 0) || 0));
                const totalTokens = Math.max(0, Math.round(Number(json.usage.total_tokens ?? (promptTokens + completionTokens)) || (promptTokens + completionTokens)));
                if (totalTokens > 0) {
                  onEvent({
                    type: "usage",
                    promptTokens,
                    completionTokens,
                    totalTokens,
                  });
                }
              }
              const choice = json.choices?.[0];
              if (choice?.finish_reason) {
                turnFinishReason = choice.finish_reason;
                hasCleanDone = true;
              }
              const delta = choice?.delta || choice?.message;
              if (delta) {
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

        const toolCalls: ToolCall[] = Array.from(toolCallsMap.values())
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
        if (toolCalls.length === 0 && turnContent) {
          const fallback = extractFallbackToolCalls(turnContent);
          if (fallback.length > 0) {
            toolCalls.push(...fallback);
            turnContent = turnContent.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, "").trim();
          }
        }

        // Handle case where model paused after thinking without emitting tool calls or content
        if (toolCalls.length === 0 && !turnContent) {
          // If no content, no thinking, and no tool calls arrived, check if it's an abrupt stream drop
          if (!turnThinking && !hasReceivedAnyData && consecutiveStreamRetries < 3) {
            consecutiveStreamRetries++;
            currentTurn--; // Don't consume a turn on connection drop
            const backoffMs = Math.min(1000 * Math.pow(2, consecutiveStreamRetries - 1), 4000);
            onEvent({
              type: "status",
              status: "thinking",
              message: `Stream connection interrupted. Reconnecting (attempt ${consecutiveStreamRetries}/3 in ${backoffMs / 1000}s)...`,
            });
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          // If stream closed with zero data received across all retry attempts, report error instead of done
          if (!turnThinking && !hasReceivedAnyData) {
            const timeoutErrMsg =
              "Connection to model provider timed out or dropped with no response. Please verify network connectivity and retry.";
            onEvent({ type: "error", error: timeoutErrMsg });
            onEvent({ type: "status", status: "error", message: timeoutErrMsg });
            conversationHistory.push({
              role: "assistant",
              content: timeoutErrMsg,
              timestamp: Date.now(),
            });
            return conversationHistory;
          }

          if (turnThinking && currentTurn < maxTurns && consecutivePlanningTurns < 3) {
            consecutivePlanningTurns++;
            // Model generated internal reasoning but paused before calling tools or outputting text.
            // Retain the native reasoning on the assistant message so the multi-turn context
            // is preserved natively with reasoning_content without synthetic text pollution.
            const thinkingStepMsg: AgentMessage = {
              role: "assistant",
              content: "I have analyzed the workspace requirements and completed the implementation plan. Proceeding now to invoke the required tool calls.",
              thinking: turnThinking,
              timestamp: Date.now(),
            };
            conversationHistory.push(thinkingStepMsg);

            // Maintain strictly alternating user/assistant turns in API payload
            conversationHistory.push({
              role: "user",
              content:
                turnFinishReason === "length"
                  ? "Output token limit reached during planning. Without further reasoning, immediately invoke the required tool call (such as 'write' or 'edit')."
                  : "Proceed immediately with the required tool calls (e.g. 'write' or 'edit') based on your analysis to complete the task.",
              timestamp: Date.now(),
            });

            onEvent({
              type: "status",
              status: "thinking",
              message: "Planning concluded. Proceeding directly to tool execution...",
            });
            continue;
          }

          if (turnFinishReason === "length") {
            turnContent =
              "The response reached the model token limit. Please ask to continue or break down the request into smaller parts.";
          } else if (turnThinking) {
            turnContent = `Completed thinking analysis:\n\n${turnThinking.slice(0, 500)}...\n\nPlease confirm if you would like me to proceed with creating the requested files.`;
          } else {
            turnContent =
              "No response was received from the model provider. Please verify provider connectivity or retry your request.";
          }
          onEvent({ type: "token", token: turnContent });
        } else {
          // Reset retry counter on successful data receipt
          consecutiveStreamRetries = 0;
        }

        if (toolCalls.length > 0) {
          consecutivePlanningTurns = 0;
          consecutiveDraftCutoffs = 0;
        }

        if (toolCalls.length === 0) {
          if (turnFinishReason === "length" && currentTurn < maxTurns && consecutiveDraftCutoffs < 3) {
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

          const assistantMsg: AgentMessage = {
            role: "assistant",
            content: turnContent,
            thinking: turnThinking || undefined,
            timestamp: Date.now(),
          };
          conversationHistory.push(assistantMsg);

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

        for (const tc of toolCalls) {
          if (signal.aborted || this._isCancelled) {
            throw new Error("User cancelled agent execution.");
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
              result: loopWarning,
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

          // Check for Approval in "ask_before_changes" mode for terminal / shell execution
          const toolLower = tc.function.name.toLowerCase();
          const isTerminalTool =
            toolLower === "bash" ||
            toolLower === "powershell" ||
            toolLower === "exec" ||
            toolLower === "terminal" ||
            toolLower === "sh" ||
            toolLower === "run_command" ||
            toolLower === "runcommand";

          const cmd = isTerminalTool ? extractCommandArg(parsedArgs) : undefined;
          const rawCwd = parsedArgs.cwd || parsedArgs.working_directory || parsedArgs.workdir || parsedArgs.path;
          const targetCwd = rawCwd ? path.resolve(workspacePath, rawCwd) : workspacePath;

          const isAlreadyAllowed =
            this.sessionAllowedTools.has(toolLower) ||
            Boolean(cmd && this.sessionAllowedTools.has(`cmd:${cmd.trim()}`));

          if (this.config.mode === "ask_before_changes" && isTerminalTool && !isAlreadyAllowed) {
            const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            onEvent({
              type: "status",
              status: "waiting_approval",
              message: `Waiting for approval to execute: ${cmd || tc.function.name}`,
            });

            const approvalReq: ApprovalRequestData = {
              approvalId,
              toolCallId: tc.id,
              toolName: tc.function.name,
              args: parsedArgs,
              command: cmd,
              cwd: targetCwd,
              description: `Execute terminal command: ${cmd || tc.function.name}`,
              createdAt: Date.now(),
            };

            onEvent({
              type: "approval_request",
              id: approvalId,
              approval: approvalReq,
              ...approvalReq,
            });

            // Wait for user approval or abort signal
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
                signal.removeEventListener("abort", onAbort);
                resolve(res);
              });
            });

            onEvent({
              type: "approval_resolved",
              approvalId,
              decision: userResponse.decision,
            });

            if (
              userResponse.decision === "allow_always" ||
              userResponse.decision === "allow_conversation" ||
              userResponse.decision === "allow_project"
            ) {
              if (cmd && cmd.trim()) {
                this.sessionAllowedTools.add(`cmd:${cmd.trim()}`);
              } else {
                this.sessionAllowedTools.add(toolLower);
              }
            } else if (userResponse.decision === "deny") {
              const feedbackText = userResponse.feedback?.trim();
              const rejectionMessage = feedbackText
                ? `[ACTION REJECTED BY USER]: The user denied permission to execute command: '${cmd}'. User instruction / feedback: "${feedbackText}". Adapt your plan immediately based on this instruction and proceed without running that command.`
                : `[ACTION REJECTED BY USER]: The user denied permission to execute command: '${cmd}'. Do NOT execute this command. Choose a different approach or explain the options clearly.`;

              onEvent({
                type: "tool_result",
                toolCallId: tc.id,
                toolName: tc.function.name,
                result: rejectionMessage,
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

              continue;
            } else if (userResponse.decision === "skip") {
              const skipMessage = `[ACTION SKIPPED BY USER]: The user skipped execution of command: '${cmd}'. Proceed with other tasks or ask the user how to continue.`;

              onEvent({
                type: "tool_result",
                toolCallId: tc.id,
                toolName: tc.function.name,
                result: skipMessage,
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
            // If "allow_once", proceed below to executeNativeTool!
          }

          const { result, isError } = await executeNativeTool(
            tc.function.name,
            parsedArgs,
            workspacePath,
            {
              signal,
              stepIndex: currentTurn,
              onFileMutation: (record) => {
                onEvent({ type: "file_mutation", record });
              },
              onTodoUpdate: (todos) => {
                onEvent({ type: "todo_update", todos });
              },
              askUser: async (questions) => {
                onEvent({ type: "ask_question", toolCallId: tc.id, questions });
                if (this.config.onAskQuestion) {
                  return await this.config.onAskQuestion(tc.id, questions);
                }
                return { status: "submitted" };
              },
              onTaskStarted: (task) => {
                onEvent({ type: "task_started", task });
              },
              onTaskStopped: (taskId, code) => {
                onEvent({ type: "task_stopped", taskId, code });
              },
            }
          );

          onEvent({
            type: "tool_result",
            toolCallId: tc.id,
            toolName: tc.function.name,
            result,
            isError,
          });

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

          if (signal.aborted || this._isCancelled) {
            throw new Error("User cancelled agent execution.");
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

      onEvent({
        type: "done",
        fullContent: fallbackContent,
        messages: conversationHistory,
      });
      onEvent({ type: "status", status: "done" });

      return conversationHistory;
    } catch (err: any) {
      const isAborted =
        this._isCancelled ||
        signal?.aborted ||
        err?.name === "AbortError" ||
        err?.message?.includes("cancelled") ||
        err?.message?.includes("aborted");

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
      this.isRunning = false;
      this.abortController = null;
      this.pendingApprovals.clear();
    }
  }
}

export function createConstAgent(config: AgentConfig): ConstAgent {
  return new ConstAgent(config);
}
