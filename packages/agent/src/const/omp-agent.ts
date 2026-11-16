import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildConstSystemPrompt } from "./const-agent.js";
import { isContextWindowError, isUnsupportedImageError } from "./model-retry.js";
import { OmpHostTools, toolCallFromFrame, toolText } from "./omp-host-tools.js";
import { OmpRpc, record, type OmpFrame } from "./omp-rpc.js";
import { messageFromOmp, ompPrompt, ompText, ompToolImages, prepareOmpSession, todoPhases, todosFromOmp, toOmpContent } from "./omp-session.js";
import { LANGUAGE_GUIDANCE } from "./prompt-guidance.js";
import { AgentRequestError, PAYLOAD_ERROR_MESSAGE } from "./request-payload.js";
import { trackLlmRequest } from "./request-telemetry.js";
import { globalSubAgentManager } from "./subagent.js";
import { calculateContextBreakdown } from "./token-meter.js";
import { ToolAuthorization } from "./tool-authorization.js";
import { appendToolObservations } from "./tool-observations.js";
import { latestTodoState } from "./todo-state.js";
import type { AgentConfig, AgentErrorCategory, AgentEvent, AgentMessage, AgentOutcome, ApprovalResponseData, CodingAgentRuntime } from "./types.js";

type CancelSource = NonNullable<Extract<AgentEvent, { type: "run_end" }>["cancelSource"]>;
type SteeringMetadata = Pick<AgentMessage, "instructionId" | "sourceSideChatId">;
const MODEL_IDLE_MS = 240_000;

/** OMP owns model turns, provider retries and Todo. Harness is the tool and UI host. */
export class OmpAgent implements CodingAgentRuntime {
  private readonly authorization: ToolAuthorization;
  private readonly config: AgentConfig;
  private controller?: AbortController;
  private sendSteer?: (message: AgentMessage) => void;
  private readonly queuedSteers: AgentMessage[] = [];
  private cancelSource?: CancelSource;

  constructor(config: AgentConfig, private readonly executable: string) {
    this.config = { mode: "ask_before_changes", ...config,
      createChildAgent: options => new OmpAgent(options, this.executable) };
    this.authorization = new ToolAuthorization(this.config);
  }

  get isCancelled(): boolean {
    return this.cancelSource !== undefined;
  }

  updateMode(mode: NonNullable<AgentConfig["mode"]>): void {
    this.authorization.updateMode(mode);
  }

  resolveApproval(id: string, response: ApprovalResponseData): boolean {
    return this.authorization.resolveApproval(id, response);
  }

  abort(source: CancelSource = "unknown"): void {
    this.cancelSource ??= source;
    this.controller?.abort(new Error("User cancelled agent execution."));
    if (!this.config.parentAgentId) globalSubAgentManager.killAllRunningSubAgents(undefined, this.config.conversationId);
  }

  steer(content: string, attachments: unknown[] = [], metadata?: SteeringMetadata): boolean {
    if (!this.controller || this.controller.signal.aborted) return false;
    const parts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    let text = content;
    for (const value of attachments) {
      const { name, path: filePath, textContent, type, base64, url } = record(value);
      text += `\n\nAttachment: ${String(name ?? "file")}${typeof filePath === "string" ? ` (${filePath})` : ""}`;
      if (typeof textContent === "string" && textContent.trim()) text += `\n${textContent}`;
      const source = base64 || url;
      if (type === "image" && typeof source === "string") {
        parts.push({ type: "image_url", image_url: { url: source } });
      }
    }
    const message: AgentMessage = { role: "user", content: [{ type: "text", text }, ...parts], timestamp: Date.now(), ...metadata };
    if (metadata) this.authorization.denyPending("A new instruction arrived; reconsider this action before proceeding.");
    if (this.sendSteer) this.sendSteer(message);
    else this.queuedSteers.push(message);
    return true;
  }

  async run(messages: AgentMessage[], publish: (event: AgentEvent) => void): Promise<AgentMessage[]> {
    if (this.controller) throw new Error("Agent is already running a session.");
    this.cancelSource = undefined;
    const controller = this.controller = new AbortController();
    const { signal } = controller;
    const runId = this.config.runId ?? randomUUID();
    const emit = (event: AgentEvent) => publish({ ...event, runId });
    const history = [...messages];
    const workspace = this.config.workspacePath ?? process.cwd();
    const companion = this.config.sessionKind === "companion";
    const terminal = Promise.withResolvers<OmpFrame | Error>();
    let rpc: OmpRpc | undefined;
    let root: string | undefined;
    let outcome: AgentOutcome = "failed";
    let errorCategory: AgentErrorCategory | undefined;
    let errorMessage: string | undefined;
    let modelTimer: NodeJS.Timeout | undefined;
    let request: ReturnType<typeof trackLlmRequest> | undefined;
    let requestStoppedAt: number | undefined;
    let requestFailed = false;
    let endpointHost = "";
    let finalText = "";
    let turns = 0;
    let latestAssistant: AgentMessage | undefined;
    let pendingResult: OmpFrame | undefined;
    let toolQueue = Promise.resolve();
    let steerQueue = Promise.resolve();
    const hostCalls = new Map<string, AbortController>();
    const nativeCalls = new Map<string, number>();
    const pendingSteers: Array<{ text: string; message: AgentMessage }> = [];
    const fail = (error: Error) => controller.abort(error);
    const host = new OmpHostTools(this.config, this.authorization, workspace, emit);
    const stopOnSignal = () => {
      rpc?.send({ id: "abort", type: "abort" });
      terminal.resolve(signal.reason instanceof Error ? signal.reason : new Error("oh-my-pi execution was interrupted."));
    };
    signal.addEventListener("abort", stopOnSignal, { once: true });
    const timeoutMs = this.config.sessionTimeoutMs ?? (companion ? 120_000 : 0);
    const deadline = timeoutMs > 0 ? setTimeout(() => fail(new Error("The agent session timed out. Please try again.")), timeoutMs) : undefined;
    const resetModelTimer = () => {
      clearTimeout(modelTimer);
      modelTimer = setTimeout(() => fail(new Error("The model stopped sending progress. Please try again.")), MODEL_IDLE_MS);
    };

    const onFrame = (frame: OmpFrame) => {
      if (signal.aborted) return;
      if (frame.type === "turn_start") {
        if (++turns > (this.config.maxTurns || 200)) {
          fail(new AgentRequestError("Task execution reached the maximum turn limit. You can continue from the last result.", "model"));
          return;
        }
        if (finalText) emit({ type: "token_reset" });
        finalText = "";
        request?.finish(requestFailed ? "failed" : "completed");
        requestStoppedAt = undefined;
        requestFailed = false;
        request = trackLlmRequest(`${runId}_${turns}`, this.config.model, emit, () => requestStoppedAt ?? Date.now(), { runId, endpointHost });
        emit({ type: "status", status: "thinking" });
        resetModelTimer();
      } else if (frame.type === "message_update") {
        const delta = record(frame.assistantMessageEvent);
        resetModelTimer();
        if (delta.type === "text_delta" && typeof delta.delta === "string") {
          request?.observeDelta({ content: delta.delta });
          emit({ type: "token", token: delta.delta });
        } else if (delta.type === "thinking_delta" && typeof delta.delta === "string") {
          request?.observeDelta({ thinking: delta.delta });
          emit({ type: "thinking", thinking: delta.delta });
        } else if (delta.type === "toolcall_start") {
          request?.observeDelta({ tool_calls: [true] });
        }
      } else if (frame.type === "message_end") {
        const message = record(frame.message);
        const mapped = messageFromOmp(message);
        if (mapped) history.push(mapped);
        if (mapped?.role === "assistant") {
          clearTimeout(modelTimer);
          latestAssistant = mapped;
          const usage = record(message.usage);
          request?.observeUsage({ prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.totalTokens,
            cache_read_input_tokens: usage.cacheRead, cache_creation_input_tokens: usage.cacheWrite });
          requestStoppedAt = Date.now();
          requestFailed = message.stopReason === "error" || message.stopReason === "length";
          if (!requestFailed) request?.finish(message.stopReason === "aborted" ? "cancelled" : "completed");
          if (mapped.tool_calls?.length) {
            emit({ type: "commentary", content: String(mapped.content) });
          } else if (message.stopReason === "stop") {
            finalText = String(mapped.content);
            resetModelTimer();
          }
        } else if (mapped?.role === "tool") {
          const images = (Array.isArray(message.content) ? message.content : []).map(record).flatMap(part => part.type === "image" &&
            typeof part.data === "string" && typeof part.mimeType === "string" ? [{ data: part.data, mimeType: part.mimeType }] : []);
          if (images.length) appendToolObservations(history, [{ id: mapped.tool_call_id!, name: mapped.name!, images }]);
        } else if (message.role === "user") {
          const index = pendingSteers.findIndex(item => item.text === ompText(message.content));
          if (index >= 0) {
            const [steer] = pendingSteers.splice(index, 1);
            history.push(steer!.message);
            host.resetProgress();
            emit({ type: "steer_message", conversationId: this.config.conversationId, message: steer!.message });
          }
        }
      } else if (frame.type === "host_tool_call") {
        const call = toolCallFromFrame(frame);
        if (!call || hostCalls.has(call.id)) throw new Error("Invalid oh-my-pi host tool call.");
        clearTimeout(modelTimer);
        const turn = turns;
        const cancellation = new AbortController();
        hostCalls.set(call.id, cancellation);
        const toolSignal = AbortSignal.any([signal, cancellation.signal]);
        // A rejection invalidates the rest of that model turn, including concurrently proposed tools.
        toolQueue = toolQueue.then(async () => {
          if (toolSignal.aborted) return;
          const result = await host.execute(rpc!, call.name, call.callId, call.args, turn, toolSignal);
          if (toolSignal.aborted) return;
          const body = toolText(result.result);
          if (result.stopRun) {
            // Keep the last observation locally. Replying over RPC would let OMP start another model request.
            history.push({ role: "tool", tool_call_id: call.callId, name: call.name, content: body, isError: result.isError, timestamp: Date.now() });
            if (result.images?.length) appendToolObservations(history, [{ id: call.callId, name: call.name, images: result.images }]);
            fail(new AgentRequestError("The agent stopped after repeating a tool cycle without progress.", "model"));
            return;
          }
          const content = [{ type: "text", text: body },
            ...await ompToolImages(result.images ?? [], this.config, toolSignal)];
          if (!toolSignal.aborted) {
            rpc!.send({ type: "host_tool_result", id: call.id, result: { content }, isError: result.isError });
            if (hostCalls.size === 1) resetModelTimer();
          }
        }).catch(error => { if (!toolSignal.aborted) fail(error); }).finally(() => hostCalls.delete(call.id));
      } else if (frame.type === "host_tool_cancel" && typeof frame.targetId === "string") {
        hostCalls.get(frame.targetId)?.abort();
      } else if (frame.type === "tool_execution_start" && frame.toolName === "todo" && typeof frame.toolCallId === "string") {
        nativeCalls.set(frame.toolCallId, Date.now());
        emit({ type: "tool_call", toolCallId: frame.toolCallId, toolName: "todo", args: frame.args });
      } else if (frame.type === "tool_execution_end" && frame.toolName === "todo" && typeof frame.toolCallId === "string") {
        const started = nativeCalls.get(frame.toolCallId);
        nativeCalls.delete(frame.toolCallId);
        const result = record(frame.result);
        const details = record(result.details);
        const isError = frame.isError === true || result.isError === true;
        const todos = !isError && typeof details.op === "string" && details.op !== "view" ? todosFromOmp(details.phases) : undefined;
        if (todos) {
          if (latestAssistant) latestAssistant.todos = todos;
          emit({ type: "todo_update", todos, toolCallId: frame.toolCallId });
        }
        emit({ type: "tool_result", toolCallId: frame.toolCallId, toolName: "todo", result: ompText(result.content),
          durationMs: started === undefined ? undefined : Date.now() - started, isError });
      } else if (frame.type === "todo_reminder") {
        emit({ type: "progress_checkpoint", turn: turns, kind: "todo_reconcile" });
      } else if (frame.type === "prompt_result" && frame.id === "harness-prompt") {
        if (frame.status === "completed" && frame.sessionSettled === false) pendingResult = frame;
        else terminal.resolve(frame);
      } else if (frame.type === "session_settled" && pendingResult) {
        terminal.resolve(pendingResult);
      }
    };

    try {
      emit({ type: "status", status: "thinking" });
      const index = messages.findLastIndex(message => message.role === "user" && !message.toolObservationId);
      if (index < 0) throw new Error("The conversation has no user prompt.");
      const activeTools = await host.initialize(signal);
      const systemContext = messages.filter(message => message.role === "system").map(message => ompText(message.content)).join("\n");
      const hostToolGuidance = activeTools.length ? "Use the advertised tool names exactly. Tools prefixed with harness_ are the corresponding workspace tools (for example harness_read and harness_bash)." : undefined;
      const customPrompt = [this.config.systemPrompt, hostToolGuidance, systemContext, host.useNativeTodo ?
        "For longer work, maintain progress with the todo tool. Mark items complete when you have verified the corresponding work." : undefined].filter(Boolean).join("\n\n");
      const memoryWorkspace = this.config.isolateWorkspace && this.config.sourceProjectPath && this.config.sourceProjectPath !== "Outside Project"
        ? this.config.sourceProjectPath : workspace;
      const systemPrompt = companion
        ? `Answer the user as a read-only side chat companion using the supplied parent task snapshot.\n${LANGUAGE_GUIDANCE}\n${customPrompt}`
        : buildConstSystemPrompt(workspace, customPrompt, activeTools, memoryWorkspace);
      root = await mkdtemp(path.join(os.tmpdir(), "const-omp-"));
      endpointHost = new URL(this.config.baseUrl).hostname;
      const prepared = await prepareOmpSession(root, messages.slice(0, index), this.config, systemPrompt, host.useNativeTodo ? ["todo"] : [], signal);
      const prompt = ompPrompt(await toOmpContent(messages[index]!.content, this.config, signal));
      signal.throwIfAborted();
      rpc = new OmpRpc(this.executable, prepared.args, { cwd: root, env: prepared.env }, onFrame, fail);
      const negotiate = rpc.request("negotiate_protocol", { protocolVersion: 2 });
      await Promise.race([negotiate, terminal.promise.then(frame => { if (frame instanceof Error) throw frame; return {}; })]);
      signal.throwIfAborted();
      await rpc.request("set_event_filter", { messageUpdates: "delta", events: [
        "turn_start", "message_update", "message_end", "tool_execution_start", "tool_execution_end", "todo_reminder",
      ] });
      await host.register(rpc);
      const todos = host.useNativeTodo ? latestTodoState(history) : undefined;
      if (todos) {
        await rpc.request("set_todos", { phases: todoPhases(todos) });
        emit({ type: "todo_update", todos });
      }
      signal.throwIfAborted();
      const acknowledgement = rpc.request("prompt", prompt, "harness-prompt");
      resetModelTimer();
      this.sendSteer = message => {
        steerQueue = steerQueue.then(async () => {
          signal.throwIfAborted();
          const next = ompPrompt(await toOmpContent(message.content, this.config, signal));
          pendingSteers.push({ text: next.message, message });
          await rpc!.request("steer", next);
        }).catch(error => { if (!signal.aborted) fail(error); });
      };
      for (const message of this.queuedSteers.splice(0)) this.sendSteer(message);
      const result = await Promise.race([
        terminal.promise,
        acknowledgement.then(() => terminal.promise, error => error instanceof Error ? error : new Error(String(error))),
      ]);
      if (result instanceof Error) throw result;
      if (result.status !== "completed") {
        const error = record(result.error);
        const detail = typeof error.message === "string" ? error.message : "oh-my-pi stopped before delivering a final answer.";
        const category = error.httpStatus === 413 ? "payload" : isContextWindowError(detail) ? "context" :
          isUnsupportedImageError(detail) ? "image" : error.retryable === true ? "transport" : "model";
        const httpStatus = typeof error.httpStatus === "number" ? error.httpStatus : undefined;
        throw new AgentRequestError(category === "payload" ? PAYLOAD_ERROR_MESSAGE : detail, category, httpStatus);
      }
      if (!finalText.trim()) throw new AgentRequestError("The model returned no final answer. You can continue from the last result.", "model");
      const context = calculateContextBreakdown({ systemPrompt, tools: activeTools, messages: history });
      emit({ type: "context_update", model: this.config.model,
        usedTokens: context.totalHeuristicTokens, totalTokens: this.config.contextWindow ?? 128_000,
        systemPromptTokens: context.systemTokens, toolsTokens: context.toolsTokens, messagesTokens: context.messageTokens });
      outcome = "completed";
      emit({ type: "done", fullContent: finalText, messages: history });
      emit({ type: "status", status: "done" });
      return history;
    } catch (failure) {
      const error = signal.aborted && signal.reason instanceof Error ? signal.reason : failure;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage = this.config.apiKey ? message.split(this.config.apiKey).join("[redacted]") : message;
      errorCategory = this.isCancelled ? "cancelled" : error instanceof AgentRequestError ? error.category : "transport";
      outcome = this.isCancelled ? "cancelled" : "failed";
      request?.updateDiagnostics({ errorCategory, httpStatus: error instanceof AgentRequestError ? error.httpStatus : undefined });
      request?.finish(this.isCancelled ? "cancelled" : "failed");
      emit({ type: "error", error: errorMessage, category: errorCategory });
      emit({ type: "status", status: this.isCancelled ? "idle" : "error", message: errorMessage });
      return history;
    } finally {
      clearTimeout(deadline);
      clearTimeout(modelTimer);
      this.sendSteer = undefined;
      this.queuedSteers.length = 0;
      signal.removeEventListener("abort", stopOnSignal);
      controller.abort();
      this.authorization.denyPending("Agent execution ended.");
      await Promise.all([rpc?.stop(), toolQueue, steerQueue]);
      if (root) await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      this.controller = undefined;
      emit({ type: "run_end", runId, outcome, error: errorMessage, errorCategory,
        ...(outcome === "cancelled" ? { cancelSource: this.cancelSource } : {}) });
    }
  }
}
