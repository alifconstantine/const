
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

  return `You are Const Learn Agent, an expert autonomous coding and software engineering assistant. You help users by reading files, executing commands, editing code, and creating new files and applications.

Current working directory: ${normalizedCwd}

Available tools:
- read: Read file contents (supports source code, text, JSON, markdown, images, and PDF documents with automated text extraction).
- write: Create or overwrite files with specified content. Parent directories are created automatically.
- edit: Make surgical edits to existing files by exact string replacement (old_content -> new_content).
- bash: Execute terminal shell commands (Git Bash on Windows, bash on Unix).

CRITICAL INSTRUCTIONS FOR FILE CREATION & PROJECT GENERATION:
- When asked to create, generate, or build files, websites, or projects (including prompts like "buat folder baru", "create project", "build website", or when given design/code specifications):
  1. DO NOT wander or explore with shell commands (do NOT run ls, pwd, mkdir, or dir). The 'write' tool automatically creates any missing parent directories recursively.
  2. DO NOT pre-draft or formulate full file contents inside your internal reasoning/thinking. Keep your internal thought brief and concise (under 30 words).
  3. Immediately invoke the 'write' tool to create the target file (e.g. index.html or target path) with the complete, functional code in the 'content' argument.
  4. Never output raw project source code as conversational chat text when asked to write or create files. Always use the 'write' tool.

GENERAL WORKFLOW & TOOL GUIDELINES:
- Use 'read' to inspect existing files before editing them, or to read document files (including PDFs).
- Use 'edit' for surgical modifications to existing files. Provide exact matching old_content.
- Use 'write' for creating new files or complete rewrites.
- Use 'bash' only when execution is truly needed (e.g. running tests, starting dev servers, or inspecting runtime errors).
- Prefer native tools ('read', 'write', 'edit') over shell commands for file operations.
- Be concise and direct in your responses. After tool operations are complete, provide a brief summary of what was accomplished.${projectContext ? `\n\n<project_context>${projectContext}</project_context>` : ""}`;
}

export class ConstAgent {
  private config: AgentConfig;
  private abortController: AbortController | null = null;
  private isRunning = false;

  constructor(config: AgentConfig) {
    this.config = {
      maxTurns: 25,
      workspacePath: process.cwd(),
      ...config,
    };
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
    const maxTurns = this.config.maxTurns || 25;
    const workspacePath = this.config.workspacePath || process.cwd();

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
          }),
          signal,
        });

        if (!response.ok) {
          const err = await response.text().catch(() => "Unknown error");
          throw new Error(`Const error (${response.status}): ${err}`);
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
        const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const choice = json.choices?.[0];
              if (choice?.finish_reason) {
                turnFinishReason = choice.finish_reason;
              }

              const delta = choice?.delta;
              if (!delta) continue;

              if (delta.reasoning_content) {
                turnThinking += delta.reasoning_content;
                onEvent({ type: "thinking", thinking: delta.reasoning_content });
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

        const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        }));

        // Guard against token exhaustion truncation or silent completion
        if (toolCalls.length === 0 && !turnContent) {
          if (turnFinishReason === "length") {
            turnContent =
              "The response reached the model token limit during reasoning. Please ask to continue or specify a more targeted request.";
          } else {
            turnContent = "Completed executing all requested actions.";
          }
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

          conversationHistory.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            timestamp: Date.now(),
          });
        }
      }

      // If loop completed without breaking on a zero-tool turn (e.g. maxTurns reached)
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      const fallbackContent =
        lastMsg?.role === "assistant" && lastMsg.content
          ? lastMsg.content
          : `Finished executing all task operations (${currentTurn} turns executed).`;

      if (lastMsg?.role !== "assistant" || !lastMsg.content) {
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
