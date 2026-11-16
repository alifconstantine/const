import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_MODELS } from "./models.js";
import { harnessToolName, ompToolName, record } from "./omp-rpc.js";
import { UNAVAILABLE_TOOL_VISION } from "./tool-observations.js";
import { parseTodoItems } from "./todo-state.js";
import type { AgentConfig, AgentMessage, TodoItem, ToolCall, ToolResultImage } from "./types.js";

export type OmpContent =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

const provider = "const-harness";
const credentialVariable = "CONST_HARNESS_MODEL_KEY";
const imageUrl = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

function textPart(text: string): OmpContent {
  return { type: "text", text };
}

export function supportsOmpImages(config: AgentConfig): boolean {
  const inputs = config.inputTypes ?? DEFAULT_MODELS.find(model => model.id === config.model)?.inputTypes;
  return !inputs || inputs.includes("image");
}

async function inlineImage(url: string, config: AgentConfig, signal: AbortSignal): Promise<OmpContent> {
  if (!supportsOmpImages(config)) return textPart(UNAVAILABLE_TOOL_VISION);
  let match = imageUrl.exec(url);
  if (!match) return textPart(`Image reference (inspect using an available tool): ${url.startsWith("https://") || url.startsWith("http://") ? url : "(inline image unavailable)"}`);
  if (config.normalizeImage && match[2]!.length > 580_000) {
    try {
      const normalized = await config.normalizeImage(url, { maxBytes: 400 * 1024, maxDimension: 1568 }, signal);
      match = imageUrl.exec(normalized.dataUrl);
    } catch {
      signal.throwIfAborted();
      return textPart("The attached image could not fit the model request. Inspect a smaller crop or an available text representation.");
    }
  }
  if (!match || match[2]!.length > 8 * 1024 * 1024) return textPart("The attached image exceeds the model request size.");
  return { type: "image", mimeType: match[1]!, data: match[2]! };
}

export async function toOmpContent(content: AgentMessage["content"], config: AgentConfig, signal: AbortSignal): Promise<OmpContent[]> {
  if (typeof content === "string") return [textPart(content)];
  const parts: OmpContent[] = [];
  for (const raw of content) {
    signal.throwIfAborted();
    const part = record(raw);
    if (part.type === "text" && typeof part.text === "string") parts.push(textPart(part.text));
    if (part.type === "image_url") {
      const url = record(part.image_url).url;
      if (typeof url === "string") parts.push(await inlineImage(url, config, signal));
    }
  }
  return parts;
}

export async function ompToolImages(images: ToolResultImage[], config: AgentConfig, signal: AbortSignal): Promise<OmpContent[]> {
  const parts: OmpContent[] = [];
  if (images.length && !supportsOmpImages(config)) return [textPart(UNAVAILABLE_TOOL_VISION)];
  for (const image of images.slice(-2)) {
    parts.push(await inlineImage(`data:${image.mimeType};base64,${image.data}`, config, signal));
  }
  return parts;
}

export function ompText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map(record).filter(part => part.type === "text" && typeof part.text === "string").map(part => part.text).join("\n");
}

export function ompPrompt(parts: OmpContent[]): { message: string; images?: OmpContent[] } {
  const text = ompText(parts);
  const images = parts.filter(part => part.type === "image");
  // Harness messages can start with slash commands, which OMP RPC otherwise executes locally.
  return { message: /^\s*\//.test(text) ? `User request:\n${text}` : text, ...(images.length && { images }) };
}

export function messageFromOmp(message: Record<string, unknown>): AgentMessage | undefined {
  const timestamp = typeof message.timestamp === "number" ? message.timestamp : Date.now();
  if (message.role === "toolResult" && typeof message.toolCallId === "string" && typeof message.toolName === "string") {
    return { role: "tool", timestamp, name: harnessToolName(message.toolName), tool_call_id: message.toolCallId, content: ompText(message.content), isError: message.isError === true };
  }
  if (message.role !== "assistant") return;
  const parts = Array.isArray(message.content) ? message.content.map(record) : [];
  const thinking = parts.filter(part => part.type === "thinking").map(part => part.thinking).join("\n") || undefined;
  const calls = parts.flatMap<ToolCall>(part =>
    part.type === "toolCall" && typeof part.id === "string" && typeof part.name === "string"
      ? [{ id: part.id, type: "function", function: { name: harnessToolName(part.name), arguments: JSON.stringify(record(part.arguments)) } }]
      : [],
  );
  return { role: "assistant", timestamp, content: ompText(parts), thinking,
    ...(message.stopReason === "toolUse" && calls.length ? { tool_calls: calls } : {}) };
}

export function todoPhases(todos: TodoItem[]): Array<{ name: string; tasks: TodoItem[] }> {
  const phases = new Map<string, TodoItem[]>();
  for (const { phase = "Task", content, status } of todos) {
    const tasks = phases.get(phase) ?? [];
    tasks.push({ content, status });
    phases.set(phase, tasks);
  }
  return [...phases].map(([name, tasks]) => ({ name, tasks }));
}

export function todosFromOmp(value: unknown): TodoItem[] | undefined {
  if (!Array.isArray(value)) return;
  const items: unknown[] = [];
  for (const raw of value) {
    const { name, tasks } = record(raw);
    if (typeof name !== "string" || !Array.isArray(tasks)) return;
    for (const task of tasks.map(record)) {
      if (task.status !== "abandoned") items.push({ ...task, phase: name });
    }
  }
  return parseTodoItems(items);
}

async function seedHistory(file: string, cwd: string, history: AgentMessage[], config: AgentConfig, signal: AbortSignal) {
  const timestamp = new Date().toISOString();
  const lines = [JSON.stringify({ type: "session", version: 3, id: randomUUID(), timestamp, cwd })];
  let parentId: string | null = null;
  // Saved transcripts can end at a cancelled tool call. Replay only tool calls with known results.
  const results = new Set(history.filter(message => message.role === "tool").map(message => message.tool_call_id));
  const calls = new Set<string>();
  for (const source of history) {
    if (source.role === "system" || (source.role === "tool" && (!source.tool_call_id || !calls.has(source.tool_call_id)))) continue;
    const content = await toOmpContent(source.content, config, signal);
    const time = source.timestamp ?? Date.now();
    let message: Record<string, unknown>;
    if (source.role === "assistant") {
      const toolCalls = (source.tool_calls ?? []).flatMap(call => {
        if (!results.has(call.id) || calls.has(call.id)) return [];
        try {
          const args: unknown = JSON.parse(call.function.arguments);
          calls.add(call.id);
          return [{ type: "toolCall", id: call.id, name: ompToolName(call.function.name), arguments: record(args) }];
        } catch {
          return [];
        }
      });
      if (!ompText(content) && !toolCalls.length) continue;
      message = { role: "assistant", content: [...content, ...toolCalls], usage, api: "openai-completions",
        provider, model: config.model, stopReason: toolCalls.length ? "toolUse" : "stop", timestamp: time };
    } else if (source.role === "tool") {
      calls.delete(source.tool_call_id!);
      message = { role: "toolResult", content, toolCallId: source.tool_call_id, toolName: ompToolName(source.name ?? "unknown"),
        isError: source.isError === true, timestamp: time };
    } else {
      message = { role: "user", content, timestamp: time };
    }
    const id = randomBytes(4).toString("hex");
    lines.push(JSON.stringify({ type: "message", id, parentId, timestamp, message }));
    parentId = id;
  }
  await writeFile(file, lines.join("\n") + "\n", { mode: 0o600 });
}

export async function prepareOmpSession(
  root: string, history: AgentMessage[], config: AgentConfig, systemPrompt: string, builtinTools: string[], signal: AbortSignal,
) {
  const home = path.join(root, "agent");
  const prompt = path.join(root, "system.md");
  const sessionFile = path.join(root, "history.jsonl");
  const model = DEFAULT_MODELS.find(candidate => candidate.id === config.model);
  const endpoint = new URL(config.baseUrl);
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error("Invalid oh-my-pi provider URL.");
  }
  const baseUrl = endpoint.href.replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, "");
  const env: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "TZ",
    "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, {
    HOME: root, USERPROFILE: root, XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_CONFIG_HOME: path.join(root, "xdg"), XDG_DATA_HOME: path.join(root, "data"),
    PI_CONFIG_DIR: path.join(root, "config"), PI_CODING_AGENT_DIR: home,
    [credentialVariable]: config.apiKey,
  });
  await mkdir(home, { mode: 0o700 });
  await Promise.all([
    writeFile(prompt, systemPrompt, { mode: 0o600 }),
    seedHistory(sessionFile, root, history, config, signal),
    writeFile(path.join(home, "models.yml"), JSON.stringify({ providers: { [provider]: {
      api: "openai-completions",
      auth: config.apiKey ? "apiKey" : "none",
      ...(config.apiKey ? { apiKey: credentialVariable } : {}),
      baseUrl,
      models: [{
        id: config.model, name: config.model,
        input: supportsOmpImages(config) ? ["text", "image"] : ["text"],
        reasoning: model?.supportsThinking ?? Boolean(config.thinkingLevel && config.thinkingLevel !== "off"),
        contextWindow: config.contextWindow ?? model?.contextWindow ?? 128_000,
        maxTokens: config.maxOutputTokens ?? config.maxTokens ?? model?.maxOutputTokens ?? 8192,
        compat: {
          supportsStore: false, supportsDeveloperRole: false, alwaysSendMaxTokens: true,
          maxTokensField: /^(?:gpt-5|o[134](?:-|$))/i.test(config.model) ? "max_completion_tokens" : "max_tokens",
          extraBody: { parallel_tool_calls: false },
        },
      }],
    } } }), { mode: 0o600 }),
  ]);
  const args = ["--mode", "rpc", "--no-ui", "--no-extensions", "--no-context-files", "--no-rules", "--no-skills",
    "--no-lsp", "--no-prewalk", "--no-judge", "--no-title", "--no-spotlight",
    "--model", `${provider}/${config.model}`, "--session", sessionFile, "--system-prompt", prompt];
  if (builtinTools.length) args.push("--tools", builtinTools.join(","));
  else args.push("--no-tools");
  if (config.thinkingLevel && /^(off|minimal|low|medium|high|xhigh|max)$/.test(config.thinkingLevel)) {
    args.push("--thinking", config.thinkingLevel);
  }
  return { args, env };
}
