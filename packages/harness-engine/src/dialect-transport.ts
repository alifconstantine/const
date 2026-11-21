import { consumeChatStream, type ProviderDialect } from "@const/agent/const";

export interface DialectRequestParams {
  dialect: ProviderDialect;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; [key: string]: any }>;
  tools: Array<{ type: "function"; function: { name: string; description?: string; parameters?: Record<string, any> } }>;
  maxTokens: number;
  thinkingLevel?: string;
  hasBrowserOrComputerTools?: boolean;
  providerHeaders?: Record<string, string>;
  providerAccountId?: string;
  providerProjectId?: string;
  providerAuthType?: "api_key" | "oauth" | "router";
}

export interface DialectHttpRequest {
  url: string;
  headers: Record<string, string>;
  bodyObj: Record<string, any>;
}

/**
 * Resolve effective wire dialect from explicit providerProtocol or endpoint URL heuristics.
 */
export function resolveProviderDialect(
  protocol?: ProviderDialect,
  baseUrl?: string,
  authType?: "api_key" | "oauth" | "router",
): ProviderDialect {
  if (protocol && protocol !== "custom") return protocol;
  const lower = (baseUrl || "").toLowerCase();
  if (lower.includes("chatgpt.com/backend-api/codex")) return "openai-codex";
  if (lower.includes("api.anthropic.com")) return "anthropic-messages";
  if (lower.includes("cloudcode-pa.googleapis.com")) return "google-gemini-cli";
  if (lower.includes("generativelanguage.googleapis.com")) return "google-gemini";
  if (lower.includes("githubcopilot.com")) return "github-copilot";
  if (authType === "oauth" && lower.includes("api.openai.com")) return "openai-responses";
  return "openai-completions";
}

function extractTextFromContent(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n");
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(url);
  if (!match || !match[1] || !match[2]) return null;
  return { mimeType: match[1], data: match[2] };
}

function thinkingBudgetForLevel(level?: string, maxTokens = 16384): number {
  const lower = (level || "").toLowerCase();
  if (!lower || lower === "off") return 0;
  let desired = 4096;
  if (lower === "minimal") desired = 1024;
  else if (lower === "low") desired = 2048;
  else if (lower === "medium") desired = 8192;
  else if (lower === "high") desired = 16384;
  else if (lower === "xhigh" || lower === "max") desired = 32768;
  return Math.max(1024, Math.min(desired, Math.max(1024, maxTokens - 1024)));
}

/**
 * Build endpoint URL, headers, and JSON request body for the selected dialect.
 */
export function buildDialectRequest(params: DialectRequestParams): DialectHttpRequest {
  const cleanBase = params.baseUrl.replace(/\/+$/, "");
  const extraHeaders = params.providerHeaders ?? {};

  // 1. OpenAI Codex / Responses API (ChatGPT Plus/Pro OAuth & OpenAI Responses)
  if (params.dialect === "openai-codex" || params.dialect === "openai-responses") {
    const isCodex = params.dialect === "openai-codex" || cleanBase.includes("chatgpt.com/backend-api/codex");
    const url = cleanBase.endsWith("/responses")
      ? cleanBase
      : isCodex
        ? "https://chatgpt.com/backend-api/codex/responses"
        : `${cleanBase}/responses`;

    const input: any[] = [];
    for (const msg of params.messages) {
      if (msg.role === "system") continue;
      if (msg.role === "user") {
        if (Array.isArray(msg.content)) {
          const parts = msg.content.map((part: any) => {
            if (part?.type === "text") return { type: "input_text", text: part.text || "" };
            if (part?.type === "image_url" && part.image_url?.url) {
              return { type: "input_image", image_url: part.image_url.url };
            }
            return { type: "input_text", text: String(part?.text ?? "") };
          });
          input.push({ role: "user", content: parts });
        } else {
          input.push({ role: "user", content: [{ type: "input_text", text: String(msg.content ?? "") }] });
        }
      } else if (msg.role === "assistant") {
        const text = extractTextFromContent(msg.content);
        if (text) {
          input.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text }],
          });
        }
        if (Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            input.push({
              type: "function_call",
              call_id: tc.id || `call_${Date.now()}`,
              name: tc.function?.name || "",
              arguments: typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments ?? {}),
            });
          }
        }
      } else if (msg.role === "tool") {
        input.push({
          type: "function_call_output",
          call_id: msg.tool_call_id || "call_unknown",
          output: extractTextFromContent(msg.content) || String(msg.content ?? ""),
        });
      }
    }

    const extraSystem = params.messages
      .filter((m) => m.role === "system")
      .map((m) => extractTextFromContent(m.content))
      .filter(Boolean);
    const instructions = [params.systemPrompt, ...extraSystem].filter(Boolean).join("\n\n");

    const tools = params.tools.map((t) => ({
      type: "function",
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} },
    }));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
      ...(isCodex && params.providerAccountId ? { "chatgpt-account-id": params.providerAccountId } : {}),
      ...(isCodex ? { originator: "const-harness", "OpenAI-Beta": "responses=experimental" } : {}),
      ...extraHeaders,
    };

    const effort = params.thinkingLevel && params.thinkingLevel !== "off"
      ? (params.thinkingLevel === "max" || params.thinkingLevel === "xhigh" ? "high" : params.thinkingLevel)
      : undefined;

    const bodyObj: Record<string, any> = {
      model: params.model,
      instructions: instructions || "You are a helpful coding assistant.",
      input,
      stream: true,
      store: false,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      ...(params.hasBrowserOrComputerTools ? { parallel_tool_calls: false } : {}),
      ...(effort ? { reasoning: { effort, summary: "auto" } } : {}),
      ...(!isCodex ? { max_output_tokens: params.maxTokens } : {}),
    };

    return { url, headers, bodyObj };
  }

  // 2. Anthropic Messages API (Claude Pro/Max OAuth & Anthropic BYOK)
  if (params.dialect === "anthropic-messages") {
    const url = cleanBase.endsWith("/messages")
      ? cleanBase
      : cleanBase.endsWith("/v1")
        ? `${cleanBase}/messages`
        : `${cleanBase}/v1/messages`;

    const isOAuth = params.providerAuthType === "oauth" || params.apiKey.startsWith("sk-ant-oat");
    const extraSystem = params.messages
      .filter((m) => m.role === "system")
      .map((m) => extractTextFromContent(m.content))
      .filter(Boolean);
    const fullSystem = [params.systemPrompt, ...extraSystem].filter(Boolean).join("\n\n");

    const anthropicMessages: any[] = [];
    for (const msg of params.messages) {
      if (msg.role === "system") continue;
      if (msg.role === "user") {
        const blocks: any[] = [];
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part?.type === "text" && part.text) {
              blocks.push({ type: "text", text: part.text });
            } else if (part?.type === "image_url" && part.image_url?.url) {
              const parsed = parseDataUrl(part.image_url.url);
              if (parsed) {
                blocks.push({
                  type: "image",
                  source: { type: "base64", media_type: parsed.mimeType, data: parsed.data },
                });
              }
            }
          }
        } else if (typeof msg.content === "string" && msg.content.length > 0) {
          blocks.push({ type: "text", text: msg.content });
        }
        if (blocks.length === 0) blocks.push({ type: "text", text: " " });
        const prev = anthropicMessages[anthropicMessages.length - 1];
        if (prev && prev.role === "user") {
          prev.content.push(...blocks);
        } else {
          anthropicMessages.push({ role: "user", content: blocks });
        }
      } else if (msg.role === "assistant") {
        const blocks: any[] = [];
        const text = extractTextFromContent(msg.content);
        if (text) blocks.push({ type: "text", text });
        if (Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            let inputObj: Record<string, any> = {};
            try {
              inputObj = typeof tc.function?.arguments === "string"
                ? JSON.parse(tc.function.arguments || "{}")
                : (tc.function?.arguments ?? {});
            } catch {
              inputObj = {};
            }
            blocks.push({
              type: "tool_use",
              id: tc.id || `toolu_${Date.now()}`,
              name: tc.function?.name || "",
              input: inputObj && typeof inputObj === "object" ? inputObj : {},
            });
          }
        }
        if (blocks.length > 0) {
          anthropicMessages.push({ role: "assistant", content: blocks });
        }
      } else if (msg.role === "tool") {
        const block = {
          type: "tool_result",
          tool_use_id: msg.tool_call_id || "toolu_unknown",
          content: extractTextFromContent(msg.content) || String(msg.content ?? ""),
        };
        const prev = anthropicMessages[anthropicMessages.length - 1];
        if (prev && prev.role === "user") {
          prev.content.push(block);
        } else {
          anthropicMessages.push({ role: "user", content: [block] });
        }
      }
    }

    const anthropicTools = params.tools.map((t, idx) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters || { type: "object", properties: {} },
      ...(idx === params.tools.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
    }));

    const thinkingBudget = thinkingBudgetForLevel(params.thinkingLevel, params.maxTokens);
    const betaFlags = [
      ...(isOAuth ? ["oauth-2025-04-20", "claude-code-20250219"] : []),
      "prompt-caching-2024-07-31",
      ...(thinkingBudget > 0 ? ["interleaved-thinking-2025-05-14"] : []),
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": betaFlags.join(","),
      ...(isOAuth
        ? {
            Authorization: `Bearer ${params.apiKey}`,
            "User-Agent": "claude-code/2.1.76",
          }
        : { "x-api-key": params.apiKey }),
      ...extraHeaders,
    };

    const bodyObj: Record<string, any> = {
      model: params.model,
      max_tokens: Math.max(1024, Math.min(params.maxTokens, 64_000)),
      stream: true,
      ...(fullSystem
        ? {
            system: [
              {
                type: "text",
                text: fullSystem,
                cache_control: { type: "ephemeral" },
              },
            ],
          }
        : {}),
      messages: anthropicMessages,
      ...(anthropicTools.length ? { tools: anthropicTools } : {}),
      ...(thinkingBudget > 0
        ? { thinking: { type: "enabled", budget_tokens: thinkingBudget } }
        : {}),
    };

    return { url, headers, bodyObj };
  }

  // 3. Google Gemini / Cloud Code Assist (Gemini CLI OAuth & AI Studio BYOK)
  if (params.dialect === "google-gemini-cli" || params.dialect === "google-gemini") {
    const isCodeAssist =
      params.dialect === "google-gemini-cli" || cleanBase.includes("cloudcode-pa.googleapis.com");
    const extraSystem = params.messages
      .filter((m) => m.role === "system")
      .map((m) => extractTextFromContent(m.content))
      .filter(Boolean);
    const fullSystem = [params.systemPrompt, ...extraSystem].filter(Boolean).join("\n\n");

    const toolIdToName = new Map<string, string>();
    const contents: any[] = [];
    for (const msg of params.messages) {
      if (msg.role === "system") continue;
      if (msg.role === "user") {
        const parts: any[] = [];
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part?.type === "text" && part.text) parts.push({ text: part.text });
            else if (part?.type === "image_url" && part.image_url?.url) {
              const parsed = parseDataUrl(part.image_url.url);
              if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
            }
          }
        } else if (typeof msg.content === "string" && msg.content.length > 0) {
          parts.push({ text: msg.content });
        }
        if (parts.length > 0) contents.push({ role: "user", parts });
      } else if (msg.role === "assistant") {
        const parts: any[] = [];
        const text = extractTextFromContent(msg.content);
        if (text) parts.push({ text });
        if (Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            const name = tc.function?.name || "";
            if (tc.id) toolIdToName.set(tc.id, name);
            let argsObj: Record<string, any> = {};
            try {
              argsObj = typeof tc.function?.arguments === "string"
                ? JSON.parse(tc.function.arguments || "{}")
                : (tc.function?.arguments ?? {});
            } catch {
              argsObj = {};
            }
            parts.push({ functionCall: { id: tc.id, name, args: argsObj } });
          }
        }
        if (parts.length > 0) contents.push({ role: "model", parts });
      } else if (msg.role === "tool") {
        const fnName = msg.name || toolIdToName.get(msg.tool_call_id) || "tool";
        const respPart = {
          functionResponse: {
            id: msg.tool_call_id,
            name: fnName,
            response: { output: extractTextFromContent(msg.content) || String(msg.content ?? "") },
          },
        };
        const prev = contents[contents.length - 1];
        if (prev && prev.role === "user" && prev.parts.some((p: any) => p.functionResponse)) {
          prev.parts.push(respPart);
        } else {
          contents.push({ role: "user", parts: [respPart] });
        }
      }
    }

    const geminiRequest: Record<string, any> = {
      contents,
      ...(fullSystem ? { systemInstruction: { role: "user", parts: [{ text: fullSystem }] } } : {}),
      ...(params.tools.length
        ? {
            tools: [
              {
                functionDeclarations: params.tools.map((t) => ({
                  name: t.function.name,
                  description: t.function.description || "",
                  parameters: sanitizeGeminiSchema(t.function.parameters || { type: "object", properties: {} }),
                })),
              },
            ],
          }
        : {}),
      generationConfig: {
        maxOutputTokens: Math.max(1024, Math.min(params.maxTokens, 65_536)),
      },
    };

    if (isCodeAssist) {
      const url = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
        "X-Goog-Api-Client": "gl-node/22.17.0",
        "Client-Metadata": JSON.stringify({
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
        }),
        ...extraHeaders,
      };
      return {
        url,
        headers,
        bodyObj: {
          project: params.providerProjectId || "",
          model: params.model,
          request: geminiRequest,
        },
      };
    }

    const modelPath = params.model.startsWith("models/") ? params.model : `models/${params.model}`;
    const url = `${cleanBase || "https://generativelanguage.googleapis.com/v1beta"}/${modelPath}:streamGenerateContent?alt=sse`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
      ...extraHeaders,
    };
    return { url, headers, bodyObj: geminiRequest };
  }

  // 4. OpenAI-Compatible Completions (Const Router, OpenAI BYOK, DeepSeek, OpenRouter, Groq, Ollama, GitHub Copilot)
  const isCopilot = params.dialect === "github-copilot" || cleanBase.includes("githubcopilot.com");
  const url = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
  const useMaxCompletionTokensOnly = url.includes("api.openai.com");
  const formattedMessages = [
    { role: "system", content: params.systemPrompt },
    ...params.messages,
  ];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
    ...(isCopilot
      ? {
          "Editor-Version": "vscode/1.100.0",
          "Editor-Plugin-Version": "copilot-chat/0.26.7",
          "Copilot-Integration-Id": "vscode-chat",
          "Openai-Intent": "conversation-panel",
          "User-Agent": "GitHubCopilotChat/0.26.7",
        }
      : {}),
    ...extraHeaders,
  };
  const bodyObj: Record<string, any> = {
    model: params.model,
    messages: formattedMessages,
    ...(params.tools.length ? { tools: params.tools } : {}),
    ...(params.hasBrowserOrComputerTools ? { parallel_tool_calls: false } : {}),
    stream: true,
    stream_options: { include_usage: true },
    ...(useMaxCompletionTokensOnly
      ? { max_completion_tokens: params.maxTokens }
      : { max_tokens: params.maxTokens }),
    ...(params.thinkingLevel && params.thinkingLevel !== "off"
      ? { reasoning: params.thinkingLevel, reasoning_effort: params.thinkingLevel }
      : {}),
  };
  return { url, headers, bodyObj };
}

function sanitizeGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeGeminiSchema);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties" || k === "$schema" || k === "default") continue;
    out[k] = sanitizeGeminiSchema(v);
  }
  return out;
}

/**
 * Consume an SSE response stream in any supported dialect and emit normalized
 * OpenAI-compatible delta chunks to `onChunk`.
 */
export async function consumeDialectStream(
  dialect: ProviderDialect,
  body: ReadableStream<Uint8Array>,
  onChunk: (openAiChunk: any) => void,
  signal: AbortSignal,
): Promise<void> {
  if (dialect === "openai-completions" || dialect === "github-copilot" || dialect === "custom") {
    await consumeChatStream(body, onChunk, signal);
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // State trackers for non-OpenAI SSE protocols
  let nextToolIdx = 0;
  const responsesCallIndexByItemId = new Map<string, number>();
  const anthropicToolIdxByBlock = new Map<number, number>();
  let anthropicInputTokens = 0;
  let anthropicCacheRead = 0;
  let anthropicCacheWrite = 0;

  const processEventData = (rawData: string) => {
    const data = rawData.trim();
    if (!data || data === "[DONE]") return;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }

    if (dialect === "openai-codex" || dialect === "openai-responses") {
      const type = json.type;
      if (type === "response.output_text.delta" && typeof json.delta === "string") {
        onChunk({ choices: [{ delta: { content: json.delta } }] });
      } else if (
        (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") &&
        typeof json.delta === "string"
      ) {
        onChunk({ choices: [{ delta: { reasoning_content: json.delta } }] });
      } else if (type === "response.output_item.added" && json.item?.type === "function_call") {
        const idx = nextToolIdx++;
        if (json.item.id) responsesCallIndexByItemId.set(json.item.id, idx);
        onChunk({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: idx,
                    id: json.item.call_id || json.item.id || `call_${Date.now()}_${idx}`,
                    function: { name: json.item.name || "", arguments: json.item.arguments || "" },
                  },
                ],
              },
            },
          ],
        });
      } else if (type === "response.function_call_arguments.delta" && typeof json.delta === "string") {
        const idx = responsesCallIndexByItemId.get(json.item_id) ?? Math.max(0, nextToolIdx - 1);
        onChunk({
          choices: [
            {
              delta: {
                tool_calls: [{ index: idx, function: { arguments: json.delta } }],
              },
            },
          ],
        });
      } else if (type === "response.completed" || type === "response.done") {
        const u = json.response?.usage;
        if (u) {
          onChunk({
            usage: {
              prompt_tokens: u.input_tokens ?? 0,
              completion_tokens: u.output_tokens ?? 0,
              total_tokens: u.total_tokens ?? (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
              prompt_tokens_details: {
                cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
              },
              completion_tokens_details: {
                reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
              },
            },
            choices: [{ finish_reason: responsesCallIndexByItemId.size > 0 ? "tool_calls" : "stop" }],
          });
        } else {
          onChunk({
            choices: [{ finish_reason: responsesCallIndexByItemId.size > 0 ? "tool_calls" : "stop" }],
          });
        }
      } else if (type === "error" || type === "response.failed") {
        const msg = json.error?.message || json.response?.error?.message || "OpenAI Responses stream failed";
        throw new Error(msg);
      }
      return;
    }

    if (dialect === "anthropic-messages") {
      const type = json.type;
      if (type === "message_start" && json.message?.usage) {
        const u = json.message.usage;
        anthropicInputTokens = u.input_tokens ?? 0;
        anthropicCacheRead = u.cache_read_input_tokens ?? 0;
        anthropicCacheWrite = u.cache_creation_input_tokens ?? 0;
      } else if (type === "content_block_start" && json.content_block?.type === "tool_use") {
        const idx = nextToolIdx++;
        anthropicToolIdxByBlock.set(json.index ?? idx, idx);
        onChunk({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: idx,
                    id: json.content_block.id || `toolu_${Date.now()}_${idx}`,
                    function: { name: json.content_block.name || "", arguments: "" },
                  },
                ],
              },
            },
          ],
        });
      } else if (type === "content_block_delta" && json.delta) {
        if (json.delta.type === "text_delta" && typeof json.delta.text === "string") {
          onChunk({ choices: [{ delta: { content: json.delta.text } }] });
        } else if (json.delta.type === "thinking_delta" && typeof json.delta.thinking === "string") {
          onChunk({ choices: [{ delta: { reasoning_content: json.delta.thinking } }] });
        } else if (json.delta.type === "input_json_delta" && typeof json.delta.partial_json === "string") {
          const idx = anthropicToolIdxByBlock.get(json.index) ?? Math.max(0, nextToolIdx - 1);
          onChunk({
            choices: [
              {
                delta: {
                  tool_calls: [{ index: idx, function: { arguments: json.delta.partial_json } }],
                },
              },
            ],
          });
        }
      } else if (type === "message_delta") {
        const outTokens = json.usage?.output_tokens ?? 0;
        const stopReason = json.delta?.stop_reason;
        const mappedFinish =
          stopReason === "tool_use"
            ? "tool_calls"
            : stopReason === "max_tokens"
              ? "length"
              : "stop";
        onChunk({
          usage: {
            prompt_tokens: anthropicInputTokens + anthropicCacheRead + anthropicCacheWrite,
            completion_tokens: outTokens,
            total_tokens: anthropicInputTokens + anthropicCacheRead + anthropicCacheWrite + outTokens,
            cache_read_input_tokens: anthropicCacheRead,
            cache_creation_input_tokens: anthropicCacheWrite,
          },
          choices: [{ finish_reason: mappedFinish }],
        });
      } else if (type === "error") {
        throw new Error(json.error?.message || "Anthropic stream error");
      }
      return;
    }

    if (dialect === "google-gemini" || dialect === "google-gemini-cli") {
      const payload = json.response ?? json;
      const cand = payload.candidates?.[0];
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.thought && typeof part.text === "string") {
            onChunk({ choices: [{ delta: { reasoning_content: part.text } }] });
          } else if (typeof part.text === "string") {
            onChunk({ choices: [{ delta: { content: part.text } }] });
          } else if (part.functionCall) {
            const idx = nextToolIdx++;
            onChunk({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: idx,
                        id: part.functionCall.id || `call_gemini_${Date.now()}_${idx}`,
                        function: {
                          name: part.functionCall.name || "",
                          arguments: JSON.stringify(part.functionCall.args ?? {}),
                        },
                      },
                    ],
                  },
                },
              ],
            });
          }
        }
      }
      if (payload.usageMetadata) {
        const u = payload.usageMetadata;
        onChunk({
          usage: {
            prompt_tokens: u.promptTokenCount ?? 0,
            completion_tokens: u.candidatesTokenCount ?? 0,
            total_tokens: u.totalTokenCount ?? 0,
            prompt_tokens_details: { cached_tokens: u.cachedContentTokenCount ?? 0 },
            completion_tokens_details: { reasoning_tokens: u.thoughtsTokenCount ?? 0 },
          },
        });
      }
      if (cand?.finishReason) {
        const mappedFinish =
          cand.finishReason === "MAX_TOKENS"
            ? "length"
            : nextToolIdx > 0
              ? "tool_calls"
              : "stop";
        onChunk({ choices: [{ finish_reason: mappedFinish }] });
      }
    }
  };

  try {
    while (true) {
      if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (rawLine.startsWith("data:")) {
          processEventData(rawLine.slice(5));
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      processEventData(tail.slice(5));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}
