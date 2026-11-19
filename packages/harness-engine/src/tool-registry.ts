import {
  CONST_DEFAULT_TOOLS,
  globalSubAgentManager,
  globalTaskManager,
  nativeCapabilityForTool,
  nativePluginLoader,
  type NativeCapability,
  type NativeToolDefinition,
} from "@const/agent/const";

/** Core coding tools always advertised on every Harness turn (~2.5K tokens vs ~7.5K previously). */
const CORE_TOOL_NAMES = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "find",
  "grep",
  "ls",
  "todo_write",
  "ask_question",
  "web_search",
  "web_fetch",
  "task",
]);

/** Dynamic tools that appear automatically once a background job or subagent exists in the session. */
const JOB_TOOL_NAMES = new Set(["wait", "manage_task"]);
const SUBAGENT_CONTROL_TOOL_NAMES = new Set(["agent_status", "kill_agent"]);

/** Specialist tools kept out of the default prompt until activated via `tool_search` (inspired by oh-my-pi & deepseek-harness). */
export const DEFERRED_SPECIALIST_TOOLS: Readonly<Record<string, string>> = {
  ast_grep: "Search code structurally using AST patterns",
  ast_edit: "Rewrite code structurally using AST patterns",
  lsp: "Language Server Protocol queries (definitions, references, diagnostics, symbols)",
  eval: "Evaluate sandboxed JS/TS or Python snippets for quick calculation/verification",
  gh: "Query and act on GitHub PRs, issues, and workflows via gh CLI",
  apply_patch: "Apply unified diff patches across files",
  checkpoint: "Save a named workspace snapshot checkpoint",
  restore_checkpoint: "Restore workspace files to a saved checkpoint",
  rollback_mutation: "Revert a specific recorded file mutation",
  retain: "Store durable facts into workspace long-term memory",
  recall: "Search workspace long-term memory",
  reflect: "Synthesize structured insights from workspace memory",
};

/** Redundant legacy tools intentionally omitted from the default Harness toolset. */
export const RETIRED_REDUNDANT_TOOLS = new Set([
  "run_command",
  "mkdir",
  "jfind",
  "git_status",
  "git_diff",
  "git_commit",
  "git_log",
  "think",
]);

export function createToolSearchDefinition(): NativeToolDefinition {
  const catalog = Object.keys(DEFERRED_SPECIALIST_TOOLS).join(", ");
  return {
    type: "function",
    function: {
      name: "tool_search",
      description: `Discover or activate deferred specialist tools for the next turn. Available deferred tools: ${catalog}.`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword to search deferred tools (e.g. 'ast', 'lsp', 'github', 'memory', 'checkpoint').",
          },
          activate: {
            type: "array",
            description: "Exact deferred tool names to activate immediately for subsequent turns.",
            items: { type: "string" },
          },
        },
      },
    },
  };
}

export function executeToolSearch(
  args: Record<string, unknown>,
  activatedTools: Set<string>,
): { result: string; isError: boolean } {
  const catalogEntries = Object.entries(DEFERRED_SPECIALIST_TOOLS);
  const requested = Array.isArray(args.activate)
    ? args.activate.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";

  const newlyActivated: string[] = [];
  const unknown: string[] = [];

  for (const name of requested) {
    if (name in DEFERRED_SPECIALIST_TOOLS || JOB_TOOL_NAMES.has(name) || SUBAGENT_CONTROL_TOOL_NAMES.has(name)) {
      if (!activatedTools.has(name)) {
        activatedTools.add(name);
        newlyActivated.push(name);
      }
    } else {
      unknown.push(name);
    }
  }

  const matches = query
    ? catalogEntries.filter(
        ([name, summary]) => name.toLowerCase().includes(query) || summary.toLowerCase().includes(query),
      )
    : catalogEntries;

  // Auto-activate when a targeted query matches <= 3 tools directly so the model needs no extra turn.
  if (query && requested.length === 0 && matches.length > 0 && matches.length <= 3) {
    for (const [name] of matches) {
      if (!activatedTools.has(name)) {
        activatedTools.add(name);
        newlyActivated.push(name);
      }
    }
  }

  const lines: string[] = [];
  if (newlyActivated.length > 0) {
    lines.push(`Activated for next turn: ${newlyActivated.join(", ")}.`);
  }
  if (unknown.length > 0) {
    lines.push(`Unknown deferred tool(s): ${unknown.join(", ")}.`);
  }
  if (matches.length === 0) {
    lines.push(`No deferred tools matched '${query}'. Available: ${Object.keys(DEFERRED_SPECIALIST_TOOLS).join(", ")}.`);
  } else {
    lines.push("Deferred tools:");
    for (const [name, summary] of matches) {
      const state = activatedTools.has(name) ? "active" : "deferred";
      lines.push(`- ${name} [${state}]: ${summary}`);
    }
  }
  return { result: lines.join("\n"), isError: false };
}

export interface ResolveHarnessToolsOptions {
  isCompanion: boolean;
  explicitTools?: NativeToolDefinition[];
  externalTools?: NativeToolDefinition[];
  deferNativeTools?: boolean;
  nativeCapabilityEnabled?: (capability: NativeCapability) => boolean;
  loadedNativePlugins: ReadonlySet<NativeCapability>;
  activatedDeferredTools: ReadonlySet<string>;
  conversationId?: string;
  platform?: NodeJS.Platform;
}

export function resolveHarnessToolDefinitions(options: ResolveHarnessToolsOptions): {
  definitions: NativeToolDefinition[];
  enabledNativePlugins: NativeCapability[];
  hasBrowserOrComputerTools: boolean;
} {
  if (options.isCompanion) {
    return { definitions: [], enabledNativePlugins: [], hasBrowserOrComputerTools: false };
  }

  const platform = options.platform ?? process.platform;

  // If the caller supplied an explicit tool list (e.g. read-only scout/reviewer subagent), honor it strictly.
  if (options.explicitTools) {
    const enabledNativePlugins = [...new Set(options.explicitTools.map((t) => nativeCapabilityForTool(t.function.name)))]
      .filter((cap): cap is NativeCapability => !!cap && options.nativeCapabilityEnabled?.(cap) !== false);
    const definitions = [
      ...options.explicitTools.filter((tool) => {
        const cap = nativeCapabilityForTool(tool.function.name);
        return !cap || (enabledNativePlugins.includes(cap) && (!options.deferNativeTools || options.loadedNativePlugins.has(cap)));
      }),
      ...(options.externalTools ?? []),
    ];
    if (options.deferNativeTools && enabledNativePlugins.length > 0) {
      definitions.push(nativePluginLoader(enabledNativePlugins));
    }
    const hasBrowserOrComputerTools = definitions.some((t) => Boolean(nativeCapabilityForTool(t.function.name)));
    return { definitions, enabledNativePlugins, hasBrowserOrComputerTools };
  }

  const enabledNativePlugins = [...new Set(CONST_DEFAULT_TOOLS.map((t) => nativeCapabilityForTool(t.function.name)))]
    .filter((cap): cap is NativeCapability => !!cap && options.nativeCapabilityEnabled?.(cap) !== false);

  const hasJobs = Boolean(options.conversationId && globalTaskManager.listTasks(options.conversationId).length > 0);
  const hasSubAgents = Boolean(options.conversationId && globalSubAgentManager.listSubAgents(options.conversationId).length > 0);

  const definitions: NativeToolDefinition[] = [];
  for (const tool of CONST_DEFAULT_TOOLS) {
    const name = tool.function.name;
    if (RETIRED_REDUNDANT_TOOLS.has(name)) continue;

    const nativeCap = nativeCapabilityForTool(name);
    if (nativeCap) {
      if (enabledNativePlugins.includes(nativeCap) && (!options.deferNativeTools || options.loadedNativePlugins.has(nativeCap))) {
        definitions.push(tool);
      }
      continue;
    }

    if (name === "powershell") {
      if (platform === "win32" || options.activatedDeferredTools.has(name)) {
        definitions.push(tool);
      }
      continue;
    }

    if (CORE_TOOL_NAMES.has(name)) {
      definitions.push(tool);
      continue;
    }

    if (JOB_TOOL_NAMES.has(name)) {
      if (hasJobs || hasSubAgents || options.activatedDeferredTools.has(name)) {
        definitions.push(tool);
      }
      continue;
    }

    if (SUBAGENT_CONTROL_TOOL_NAMES.has(name)) {
      if (hasSubAgents || options.activatedDeferredTools.has(name)) {
        definitions.push(tool);
      }
      continue;
    }

    if (name in DEFERRED_SPECIALIST_TOOLS) {
      if (options.activatedDeferredTools.has(name)) {
        definitions.push(tool);
      }
      continue;
    }

    // Any other newly added native tool defaults to active unless retired/deferred.
    definitions.push(tool);
  }

  definitions.push(createToolSearchDefinition());

  if (options.externalTools?.length) {
    definitions.push(...options.externalTools);
  }
  if (options.deferNativeTools && enabledNativePlugins.length > 0) {
    definitions.push(nativePluginLoader(enabledNativePlugins));
  }

  const hasBrowserOrComputerTools = definitions.some((t) => Boolean(nativeCapabilityForTool(t.function.name)));
  return { definitions, enabledNativePlugins, hasBrowserOrComputerTools };
}
