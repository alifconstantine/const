import path from "node:path";
import { nativeCapabilityForTool, nativePluginLoader, type NativeCapability } from "./deferred-tools.js";
import { OmpRpc, harnessToolName, ompToolName, record } from "./omp-rpc.js";
import { RunProgress } from "./run-progress.js";
import { resolveSkillRegistry } from "./skill-registry.js";
import { ToolAuthorization } from "./tool-authorization.js";
import { normalizeToolName } from "./tool-policy.js";
import { CONST_DEFAULT_TOOLS, executeNativeTool, extractPathArg } from "./tools.js";
import type { AgentConfig, AgentEvent, NativeToolDefinition, ToolExecutionResult } from "./types.js";

const observationTools = new Set(["read", "ls", "find", "grep", "jfind", "astgrep", "gitstatus", "gitdiff", "gitlog",
  "browsersnapshot", "browserfind", "browserverifytext", "computergetappstate", "computerlistwindows", "computerlistapps"]);

export class OmpHostTools {
  private readonly base: NativeToolDefinition[];
  private readonly capabilities: NativeCapability[];
  private readonly loaded = new Set<NativeCapability>();
  private readonly progress = new RunProgress();
  private definitions = new Map<string, NativeToolDefinition>();
  private rejectedTurn = -1;
  private repeated = false;
  readonly useNativeTodo: boolean;

  constructor(
    private readonly config: AgentConfig,
    private readonly authorization: ToolAuthorization,
    private readonly workspace: string,
    private readonly emit: (event: AgentEvent) => void,
  ) {
    this.base = config.sessionKind === "companion" ? [] : config.tools ?? CONST_DEFAULT_TOOLS;
    this.useNativeTodo = this.base.some(tool => tool.function.name === "todo_write");
    this.capabilities = [...new Set(this.base.map(tool => nativeCapabilityForTool(tool.function.name)))]
      .filter((value): value is NativeCapability => !!value && config.nativeCapabilityEnabled?.(value) !== false);
  }

  async initialize(signal: AbortSignal): Promise<NativeToolDefinition[]> {
    const external = this.config.sessionKind === "companion" ? [] : await this.config.externalTools?.(signal) ?? [];
    signal.throwIfAborted();
    for (const tool of [...this.base, ...external]) {
      const name = tool.function.name;
      if (name !== "todo_write" && name !== "todo") this.definitions.set(name, tool);
    }
    if (this.config.deferNativeTools && this.capabilities.length) {
      this.definitions.set("load_plugin_tools", nativePluginLoader(this.capabilities));
    }
    return this.activeTools();
  }

  private activeTools(): NativeToolDefinition[] {
    return [...this.definitions.values()].filter(tool => {
      const capability = nativeCapabilityForTool(tool.function.name);
      return !capability || (this.capabilities.includes(capability) &&
        this.config.nativeCapabilityEnabled?.(capability) !== false &&
        (!this.config.deferNativeTools || this.loaded.has(capability)));
    });
  }

  register(rpc: OmpRpc): Promise<Record<string, unknown>> {
    const tools = this.activeTools().map(({ function: definition }) => ({
      ...definition, name: ompToolName(definition.name), label: definition.name, loadMode: "essential",
    }));
    return rpc.request("set_host_tools", { tools });
  }

  resetProgress(): void {
    this.progress.reset();
    this.repeated = false;
  }

  async execute(
    rpc: OmpRpc, name: string, callId: string, args: Record<string, unknown>, turn: number, signal: AbortSignal,
  ): Promise<ToolExecutionResult & { stopRun: boolean }> {
    signal.throwIfAborted();
    this.emit({ type: "status", status: "calling_tool" });
    this.emit({ type: "tool_call", toolCallId: callId, toolName: name, args });
    const started = Date.now();
    let waitingMs = 0;
    let result: ToolExecutionResult;
    let stopRun = false;
    try {
      const definition = this.activeTools().find(tool => tool.function.name === name);
      if (!definition) throw new Error("This tool is unavailable in the current Harness session.");
      if (this.rejectedTurn === turn) throw new Error("A previous action in this batch was denied. Review the user's feedback before proposing another action.");
      const allowed = await this.authorization.authorize(
        { id: callId, type: "function", function: { name, arguments: JSON.stringify(args) } },
        args, this.workspace, definition, signal, this.emit,
      );
      waitingMs = allowed.waitingMs;
      signal.throwIfAborted();
      if (allowed.rejection) {
        if (allowed.rejection.decision === "deny") this.rejectedTurn = turn;
        result = { result: allowed.rejection.text, isError: true };
      } else if (name === "load_plugin_tools") {
        const capability = args.plugin as NativeCapability;
        if (!this.capabilities.includes(capability) || this.config.nativeCapabilityEnabled?.(capability) === false) {
          throw new Error("This plugin is unavailable or disabled.");
        }
        this.loaded.add(capability);
        await this.register(rpc);
        result = { result: `Loaded ${capability} tools for the next model request.`, isError: false };
      } else {
        result = await executeNativeTool(name, args, this.workspace, {
          signal, stepIndex: turn, conversationId: this.config.conversationId,
          allowOutsideWorkspace: allowed.allowOutsideWorkspace,
          parentConfig: this.config,
          browserHandler: this.config.browserHandler, computerHandler: this.config.computerHandler,
          voiceConfig: this.config.voiceConfig, imageConfig: this.config.imageConfig, learnId: this.config.learnId,
          speechHandler: this.config.speechHandler, imageHandler: this.config.imageHandler,
          onFileMutation: mutation => this.emit({ type: "file_mutation", record: mutation, toolCallId: callId }),
          onTaskStarted: task => this.emit({ type: "task_started", task }),
          onTaskStopped: (taskId, code) => this.emit({ type: "task_stopped", taskId, code }),
          onSubAgentStarted: agent => this.emit({ type: "subagent_started", agent }),
          onSubAgentUpdated: agent => this.emit({ type: "subagent_updated", agent }),
          onSubAgentFinished: (agentId, content, error, agent) => this.emit({ type: "subagent_finished", agentId, result: content, error, agent }),
          onSubAgentKilled: (agentId, agent) => this.emit({ type: "subagent_killed", agentId, agent }),
          onSourceCreated: source => this.emit({ type: "source_created", source }),
          onArtifactCreated: artifact => this.emit({ type: "artifact_created", artifact }),
          askUser: async questions => {
            this.emit({ type: "ask_question", toolCallId: callId, questions });
            const asked = Date.now();
            const cancelled = Promise.withResolvers<{ status: string }>();
            const cancel = () => cancelled.resolve({ status: "cancelled" });
            signal.addEventListener("abort", cancel, { once: true });
            try {
              signal.throwIfAborted();
              const reply = this.config.onAskQuestion?.(callId, questions);
              return reply ? await Promise.race([reply, cancelled.promise]) : { status: "submitted" };
            } finally {
              signal.removeEventListener("abort", cancel);
              waitingMs += Date.now() - asked;
            }
          },
        });
        if (!result.isError && this.config.deferNativeTools && normalizeToolName(name) === "read") {
          await this.loadSkillTools(rpc, args);
        }
        const normalized = normalizeToolName(name);
        if (result.isError || observationTools.has(normalized)) {
          this.progress.record(name, args, result.result, result.isError);
          if (this.progress.repeatedCycle()) {
            stopRun = this.repeated;
            this.repeated = true;
            this.emit({ type: "progress_checkpoint", kind: "repeated_result", turn, toolName: name });
            result = { ...result, result: `${toolText(result.result)}\nIdentical actions and results have repeated. Change the approach or report the evidence you have.` };
          } else {
            this.repeated = false;
          }
        } else if (!["wait", "managetask", "agentstatus"].includes(normalized)) {
          this.resetProgress();
        }
      }
    } catch (error) {
      result = { result: signal.aborted ? "Tool execution was interrupted." : error instanceof Error ? error.message : String(error), isError: true };
    }
    this.emit({ type: "tool_result", toolCallId: callId, toolName: name, result: result.result, isError: result.isError,
      durationMs: Math.max(0, Date.now() - started - waitingMs), waitingMs });
    return { ...result, stopRun };
  }

  private async loadSkillTools(rpc: OmpRpc, args: Record<string, unknown>): Promise<void> {
    const skillPath = extractPathArg(args);
    if (!skillPath) return;
    const resolved = path.resolve(this.workspace, skillPath);
    const found = resolveSkillRegistry(this.workspace).plugins.find(plugin => plugin.isEffective && plugin.isEnabled &&
      plugin.skills.some(skill => skill.isEnabled && path.resolve(skill.filePath) === resolved));
    const count = this.loaded.size;
    for (const capability of found?.nativeCapabilities ?? []) {
      if (this.capabilities.includes(capability)) this.loaded.add(capability);
    }
    if (count !== this.loaded.size) await this.register(rpc);
  }
}

export function toolText(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result) ?? "";
}

export function toolCallFromFrame(frame: Record<string, unknown>) {
  if (typeof frame.id !== "string" || typeof frame.toolName !== "string" || typeof frame.toolCallId !== "string") return;
  return { id: frame.id, name: harnessToolName(frame.toolName), callId: frame.toolCallId, args: record(frame.arguments) };
}
