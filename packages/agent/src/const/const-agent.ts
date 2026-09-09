
import fs from "node:fs";
import path from "node:path";
import type { AgentConfig, AgentEvent, AgentMessage, ToolCall } from "./types.js";
import { CONST_DEFAULT_TOOLS, executeNativeTool } from "./tools.js";

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

function buildConstSystemPrompt(workspacePath: string, customPrompt?: string): string {
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

GENERAL WORKFLOW & TOOL GUIDELINES:
- When asked to create new folders or directories (e.g. "buat folder", "mkdir", "create directory"):
  Use 'mkdir' to create the directory directly, or use 'write' to create files inside the intended directory path.
- Use 'ls', 'find', and 'grep' for file exploration, project discovery, and locating relevant code.
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

export class ConstAgent {
  private config: AgentConfig;
  private abortController: AbortController | null = null;
  private isRunning = false;

  constructor(config: AgentConfig) {
    this.config = {
      maxTurns: 200,
      workspacePath: process.cwd(),
      ...config,
    };
  }

  public get maxTurns(): number {
    return this.config.maxTurns || 200;
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const conversationHistory: AgentMessage[] = [...messages];
    let currentTurn = 0;
    let consecutiveStreamRetries = 0;
    const maxTurns = this.config.maxTurns || 200;
    const workspacePath = this.config.workspacePath || process.cwd();
    const toolCallHistory: Array<{ name: string; argsHash: string; isError: boolean }> = [];
    const DOOM_LOOP_THRESHOLD = 3;

    const endpoint = this.config.baseUrl.endsWith("/chat/completions")
      ? this.config.baseUrl
      : `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    try {
      while (currentTurn < maxTurns) {
        currentTurn++;
        onEvent({ type: "status", status: "thinking" });

        const systemPrompt = buildConstSystemPrompt(
          workspacePath,
          this.config.systemPrompt
        );

        const formattedMessages = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationHistory.map((m) => {
            const item: Record<string, any> = {
              role: m.role,
              content: m.content ?? "",
            };
            if (m.role === "assistant" && m.thinking) {
              item.reasoning_content = m.thinking;
            }
            if (m.name) item.name = m.name;
            if (m.tool_call_id) item.tool_call_id = m.tool_call_id;
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

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: formattedMessages,
            tools: CONST_DEFAULT_TOOLS,
            stream: true,
            max_tokens: resolvedMaxTokens,
            max_completion_tokens: resolvedMaxTokens,
            ...(this.config.thinkingLevel && this.config.thinkingLevel !== "off"
              ? {
                  reasoning: this.config.thinkingLevel,
                  reasoning_effort: this.config.thinkingLevel,
                }
              : {}),
          }),
          signal,
        });

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
            response.status === 502
          ) {
            cleanMessage =
              "Const Engine server is offline or unreachable (502 Bad Gateway).";
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
        const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

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
                turnContent += delta.content;
                onEvent({ type: "token", token: delta.content });
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

        // Process any trailing data remaining in buffer
        if (buffer.trim().startsWith("data:")) {
          const trimmed = buffer.trim();
          const dataStr = trimmed.slice(5).trim();
          if (dataStr && dataStr !== "[DONE]") {
            try {
              const json = JSON.parse(dataStr);
              const choice = json.choices?.[0];
              if (choice?.finish_reason) {
                turnFinishReason = choice.finish_reason;
                hasCleanDone = true;
              }
              const delta = choice?.delta || choice?.message;
              if (delta) {
                if (delta.content) {
                  turnContent += delta.content;
                  onEvent({ type: "token", token: delta.content });
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

        // Handle case where model paused after thinking without emitting tool calls or content
        if (toolCalls.length === 0 && !turnContent) {
          // If no content, no thinking, and no tool calls arrived, check if it's an abrupt stream drop
          if (!turnThinking && !hasReceivedAnyData && consecutiveStreamRetries < 2) {
            consecutiveStreamRetries++;
            currentTurn--; // Don't consume a turn on connection drop
            onEvent({
              type: "status",
              status: "thinking",
              message: `Stream connection refreshed. Reconnecting (attempt ${consecutiveStreamRetries}/2)...`,
            });
            await new Promise((resolve) => setTimeout(resolve, 800));
            continue;
          }

          if (turnThinking && currentTurn < maxTurns) {
            // Model generated internal reasoning but paused before calling tools or outputting text.
            // Retain the native reasoning on the assistant message so the multi-turn context
            // is preserved natively with reasoning_content without synthetic text pollution.
            const thinkingStepMsg: AgentMessage = {
              role: "assistant",
              content: "",
              thinking: turnThinking,
              timestamp: Date.now(),
            };
            conversationHistory.push(thinkingStepMsg);
            conversationHistory.push({
              role: "user",
              content:
                turnFinishReason === "length"
                  ? "Output token limit reached during planning. Without further reasoning, immediately invoke the required tool call (such as 'write' or 'edit')."
                  : "Proceed immediately with the required tool calls (e.g. 'write' or 'edit') based on your analysis to complete the task.",
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

        const assistantMsg: AgentMessage = {
          role: "assistant",
          content: turnContent,
          thinking: turnThinking || undefined,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          timestamp: Date.now(),
        };
        conversationHistory.push(assistantMsg);

        if (toolCalls.length === 0) {
          onEvent({
            type: "done",
            fullContent: turnContent,
            messages: conversationHistory,
          });
          onEvent({ type: "status", status: "done" });
          return conversationHistory;
        }

        // Emit tool calls and execute native tools
        onEvent({
          type: "status",
          status: "calling_tool",
          message: `Executing ${toolCalls.length} tool(s)...`,
        });

        for (const tc of toolCalls) {
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
      if (err.name === "AbortError") {
        onEvent({ type: "status", status: "idle", message: "Dibatalkan" });
      } else {
        onEvent({ type: "error", error: err.message });
        onEvent({ type: "status", status: "error", message: err.message });
      }
      return conversationHistory;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }
}

export function createConstAgent(config: AgentConfig): ConstAgent {
  return new ConstAgent(config);
}
